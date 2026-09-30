import { randomUUID } from 'node:crypto';
import { Readable } from 'node:stream';
import { Register, Route, Service, handler, t } from '@3flows/platform';
import { ConversationMessageEntity, Intelligence } from '@3flows/intelligence';
import { Department, Triage, triage } from './triage.js';

export const Ticket = t.object({
    email: t.string(),
    subject: t.string(),
    body: t.string()
});

export const StoredTicket = Ticket.extend({
    id: t.string(),
    status: t.enum(['new', 'triaged', 'triage-failed']),
    triage: Triage.nullable()
});
export type StoredTicket = t.infer<typeof StoredTicket>;

export const ChatMessage = t.object({ ticketId: t.string(), message: t.string() });
export const ChatAnswer = t.object({ answer: t.string() });
const Message = t.object({ role: t.string(), content: t.string() });

/** The assistant for one ticket: its conversation, its prompt, and the ticket as context. */
const assistant = (ticket: StoredTicket) => Intelligence.conversations()
    .conversation(`ticket-${ticket.id}`)
    .prompt('support.chat', { shop: 'Velo' })
    .with({ subject: ticket.subject, body: ticket.body, triage: ticket.triage });

const replies = Intelligence.inference()
    .chat()
    .prompt('support.reply', { shop: 'Velo' });

@Register()
export class SupportService extends Service {
    handlers = () => [
        handler('ask', t.object({ question: t.string() }), t.object({ answer: t.string() }), async ({ question }, trigger) => {
            const answer = await Intelligence.inference().chat().ask(question);
            await trigger.ok({ answer: answer.text ?? '' });
        }),

        handler('draftReply', Ticket, t.object({ reply: t.string() }), async (ticket, trigger) => {
            const answer = await replies.with(ticket).ask('Draft a reply to this ticket.');
            await trigger.ok({ reply: answer.text ?? '' });
        }),

        handler('createTicket', Ticket, StoredTicket, async (ticket, trigger) => {
            const { doc, mq } = trigger.context;
            const stored: StoredTicket = { id: randomUUID(), ...ticket, status: 'new', triage: null };

            // Received is what the customer needs to know. Triage follows from the queue.
            await doc().collection('tickets').by(stored.id).set(stored);
            await mq().queue('ticket-created').send({ id: stored.id });
            await trigger.ok(stored);
        }),

        handler('getTicket', t.object({ id: t.string() }), StoredTicket, async ({ id }, trigger) => {
            await trigger.ok(await trigger.context.doc().collection('tickets').by(id).get<StoredTicket>());
        }),

        handler('topicReport', t.object({}).optional(), t.record(t.string(), t.number()), async (_input, trigger) => {
            const tickets = await trigger.context.doc().collection('tickets').find({ status: 'triaged' }).all<StoredTicket>();
            const counts: Record<string, number> = {};
            for (const topic of tickets.flatMap((ticket) => ticket.triage?.topics ?? [])) counts[topic] = (counts[topic] ?? 0) + 1;
            await trigger.ok(counts);
        }),

        handler('queue', t.object({ department: Department }), t.array(StoredTicket), async ({ department }, trigger) => {
            const tickets = await trigger.context.doc().collection('tickets')
                .find({ status: 'triaged', 'triage.department': department })
                .all<StoredTicket>();
            await trigger.ok(tickets.sort((a, b) => Number(b.triage?.priority === 'high') - Number(a.triage?.priority === 'high')));
        }),

        handler('chat', ChatMessage, ChatAnswer, async ({ ticketId, message }, trigger) => {
            const ticket = await trigger.context.doc().collection('tickets').by(ticketId).get<StoredTicket>();
            if (!ticket) return trigger.notFound(`Ticket ${ticketId} not found`);

            const answer = await assistant(ticket).ask(message);
            await trigger.ok({ answer: answer.text ?? '' });
        }),

        handler('transcript', t.object({ ticketId: t.string() }), t.array(Message), async ({ ticketId }, trigger) => {
            const messages = await ConversationMessageEntity
                .find({ conversationKey: `ticket-${ticketId}` })
                .sort({ index: 1 })
                .all();
            await trigger.ok(messages.map((message: any) => ({ role: message.data.role, content: message.data.content })));
        }),

        // Everything the model hasn't (successfully) routed: a person works through it.
        handler('generalQueue', t.object({}).optional(), t.array(StoredTicket), async (_input, trigger) => {
            await trigger.ok(await trigger.context.doc().collection('tickets').find({ status: { $ne: 'triaged' } }).all<StoredTicket>());
        })
    ];

    routes(): Route {
        const route = super.routes();

        // The same assistant, streamed: the text is sent as it's generated.
        route.http().post('/chat/stream').do(async (params, trigger) => {
            const { ticketId, message } = ChatMessage.parse(params);
            const ticket = await trigger.context.doc().collection('tickets').by(ticketId).get<StoredTicket>();
            if (!ticket) return trigger.notFound(`Ticket ${ticketId} not found`);

            const events = await assistant(ticket).stream(message);

            async function* text() {
                for await (const event of events) {
                    if (event.type === 'text.delta') yield event.text;
                }
            }

            trigger.setReadble(Readable.from(text()), { mimeType: 'text/plain; charset=utf-8' });
            await trigger.ok();
        });

        route.mq().queue('ticket-created').do(async (message, trigger) => {
            const { doc, log } = trigger.context;
            const tickets = doc().collection('tickets');
            const ticket = await tickets.by((message as { id: string }).id).get<StoredTicket>();
            if (!ticket) return;

            try {
                await tickets.by(ticket.id).set({ ...ticket, status: 'triaged', triage: await triage(ticket) });
            } catch (error) {
                // Without an answer, the ticket goes to the general queue. The customer never notices.
                log().stack(`triage of ${ticket.id} failed: ${(error as Error).message}`).error();
                await tickets.by(ticket.id).set({ ...ticket, status: 'triage-failed' });
            }
        });
        return route;
    }
}

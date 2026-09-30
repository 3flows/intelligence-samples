import { randomUUID } from 'node:crypto';
import { Readable } from 'node:stream';
import { Register, Route, t } from '@3flows/platform';
import { ConversationMessageEntity } from '@3flows/intelligence';
import { IntelligenceContext, IntelligenceService, handler, intelligence } from '../_shared/intelligence-service.js';
import { Department, Triage, triage } from './triage.js';

export const Ticket = t.object({
    email: t.string(),
    subject: t.string(),
    body: t.string()
});

// The ticket keeps this shape from here on. What the model finds out lives under `triage`.
export const StoredTicket = Ticket.extend({ id: t.string(), triage: Triage });
export type StoredTicket = t.infer<typeof StoredTicket>;

export const ChatMessage = t.object({ ticketId: t.string(), message: t.string() });
export const ChatAnswer = t.object({ answer: t.string() });
const Message = t.object({ role: t.string(), content: t.string() });

/** The assistant for one ticket: its conversation, its prompt, and the ticket as context. */
const assistant = (context: Pick<IntelligenceContext, 'conversations'>, ticket: StoredTicket) => context.conversations()
    .conversation(`ticket-${ticket.id}`)
    .prompt('support.chat', { shop: 'Velo' })
    .with({ subject: ticket.subject, body: ticket.body, triage: ticket.triage });

@Register()
export class SupportService extends IntelligenceService {
    handlers = () => [
        handler('draftReply', Ticket, t.object({ reply: t.string() }), async (ticket, trigger) => {
            const answer = await trigger.context.inference()
                .chat()
                .prompt('support.reply', { shop: 'Velo' })
                .with(ticket)
                .ask('Draft a reply to this ticket.');
            await trigger.ok({ reply: answer.text ?? '' });
        }),

        handler('createTicket', Ticket, StoredTicket, async (ticket, trigger) => {
            // The model decides what the ticket means ...
            const stored: StoredTicket = { id: randomUUID(), ...ticket, triage: await triage(trigger.context, ticket) };
            // ... the code decides what happens with it.
            await trigger.context.doc().collection('tickets').by(stored.id).set(stored);
            await trigger.ok(stored);
        }),

        handler('getTicket', t.object({ id: t.string() }), StoredTicket, async ({ id }, trigger) => {
            await trigger.ok(await trigger.context.doc().collection('tickets').by(id).get<StoredTicket>());
        }),

        handler('topicReport', t.object({}).optional(), t.record(t.string(), t.number()), async (_input, trigger) => {
            const tickets = await trigger.context.doc().collection('tickets').find({}).all<StoredTicket>();
            const counts: Record<string, number> = {};
            for (const topic of tickets.flatMap((ticket) => ticket.triage.topics)) counts[topic] = (counts[topic] ?? 0) + 1;
            await trigger.ok(counts);
        }),

        handler('chat', ChatMessage, ChatAnswer, async ({ ticketId, message }, trigger) => {
            const ticket = await trigger.context.doc().collection('tickets').by(ticketId).get<StoredTicket>();
            if (!ticket) return trigger.notFound(`Ticket ${ticketId} not found`);

            const answer = await assistant(trigger.context, ticket).ask(message);
            await trigger.ok({ answer: answer.text ?? '' });
        }),

        handler('transcript', t.object({ ticketId: t.string() }), t.array(Message), async ({ ticketId }, trigger) => {
            const messages = await ConversationMessageEntity
                .find({ conversationKey: `ticket-${ticketId}` })
                .sort({ index: 1 })
                .all();
            await trigger.ok(messages.map((message: any) => ({ role: message.data.role, content: message.data.content })));
        }),

        // Business rule at work: a department's tickets, high priority first.
        handler('queue', t.object({ department: Department }), t.array(StoredTicket), async ({ department }, trigger) => {
            const tickets = await trigger.context.doc().collection('tickets').find({ 'triage.department': department }).all<StoredTicket>();
            await trigger.ok(tickets.sort((a, b) => Number(b.triage.priority === 'high') - Number(a.triage.priority === 'high')));
        })
    ];

    routes(): Route {
        const route = super.routes();

        // The same assistant, streamed: the text is sent while it's generated.
        route.http().post('/chat/stream').do(async (params, trigger) => {
            const context = intelligence(trigger.context);
            const { ticketId, message } = ChatMessage.parse(params);   // routes don't validate: do it here
            const ticket = await context.doc().collection('tickets').by(ticketId).get<StoredTicket>();
            if (!ticket) return trigger.notFound(`Ticket ${ticketId} not found`);

            const events = await assistant(context, ticket).stream(message);

            async function* text() {
                for await (const event of events) {
                    if (event.type === 'text.delta') yield event.text;
                }
            }

            trigger.setReadble(Readable.from(text()), { mimeType: 'text/plain; charset=utf-8' });
            await trigger.ok();
        });

        return route;
    }
}

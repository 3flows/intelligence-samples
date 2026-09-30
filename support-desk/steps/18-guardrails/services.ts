import { randomUUID } from 'node:crypto';
import { Readable } from 'node:stream';
import { Register, Route, Service, TriggerContext, handler, t } from '@3flows/platform';
import { ConversationMessageEntity, InferenceTool, Intelligence } from '@3flows/intelligence';
import { Passage } from './help-center.js';
import { screen } from './guardrails.js';
import { Department, Triage, triage, withAttachments } from './triage.js';

export const Attachment = t.object({ name: t.string(), content: t.string().describe('Text content') });

export const Ticket = t.object({
    email: t.string(),
    subject: t.string(),
    body: t.string(),
    attachments: t.array(Attachment).optional()
});

export const StoredTicket = Ticket.omit({ attachments: true }).extend({
    id: t.string(),
    attachments: t.array(t.string()),   // file names in blobs: attachments/<ticket id>/<name>
    status: t.enum(['new', 'triaged', 'triage-failed', 'needs-routing', 'needs-human']),
    triage: Triage.nullable(),
    escalation: t.string().nullable()
});
export type StoredTicket = t.infer<typeof StoredTicket>;

export const ChatMessage = t.object({ ticketId: t.string(), message: t.string() });
export const ChatAnswer = t.object({ answer: t.string(), sources: t.array(t.string()) });
const Message = t.object({ role: t.string(), content: t.string() });

/** The assistant for one ticket: its conversation, its prompt, and the ticket as context. */
const assistant = (ticket: StoredTicket) => withAttachments(
    Intelligence.conversations()
        .conversation(`ticket-${ticket.id}`)
        .prompt('support.chat', { shop: 'Velo' })
        .with({ subject: ticket.subject, body: ticket.body, triage: ticket.triage }),
    ticket
);

/** The help center passages most relevant to a question. */
const helpCenter = (context: TriggerContext, query: string) => context.service('HelpCenterService')
    .method('searchArticles')
    .input({ query, limit: 4 })
    .call<Passage[]>();

/** Look up orders of this ticket's customer only. The model chooses the number, never the email. */
const ordersOf = (ticket: StoredTicket, context: TriggerContext): InferenceTool => ({
    name: 'lookupOrder',
    description: 'Look up one of the customer’s orders by number: status, items and shipping date.',
    parameters: {
        type: 'object',
        properties: { number: { type: 'string', description: 'Order number like A-1042' } },
        required: ['number'],
        additionalProperties: false
    },
    execute: async (args) => context.service('OrdersService').method('lookupOrder')
        .input({ number: (args as { number: string }).number, email: ticket.email })
        .call()
});

/** Business rule: below this, a person routes the ticket. */
const ROUTING_CONFIDENCE = 0.6;

/** What the customer reads when the assistant may not answer. Written by us, not by a model. */
const HANDOVER = 'Thanks. A colleague will take it from here.';

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

        handler('createTicket', Ticket, StoredTicket, async ({ attachments = [], ...ticket }, trigger) => {
            const { doc, mq, blob } = trigger.context;
            const id = randomUUID();

            // Files go into blobs. The ticket only keeps their names.
            for (const { name, content } of attachments) {
                await blob().container('attachments').file(`${id}/${name}`).upload(Readable.from([Buffer.from(content)]));
            }

            const stored: StoredTicket = { id, ...ticket, attachments: attachments.map((a) => a.name), status: 'new', triage: null, escalation: null };
            await doc().collection('tickets').by(id).set(stored);
            await mq().queue('ticket-created').send({ id });
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
            const tickets = trigger.context.doc().collection('tickets');
            const ticket = await tickets.by(ticketId).get<StoredTicket>();
            if (!ticket) return trigger.notFound(`Ticket ${ticketId} not found`);

            // Decide before the model: some messages must not reach the assistant at all.
            const verdict = await screen(message);
            if (!verdict.allowed) {
                await tickets.by(ticketId).set({ ...ticket, status: 'needs-human', escalation: verdict.reason });
                await trigger.ok({ answer: HANDOVER, sources: [] });
                return;
            }

            // Retrieve first, then answer from what was retrieved.
            const articles = await helpCenter(trigger.context, message);

            const answer = await assistant(ticket)
                .tools(ordersOf(ticket, trigger.context))
                .with({ articles })
                .ask(message);

            await trigger.ok({ answer: answer.text ?? '', sources: articles.map((article) => article.id) });
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

            const verdict = await screen(message);
            if (!verdict.allowed) {
                await trigger.context.doc().collection('tickets').by(ticketId).set({ ...ticket, status: 'needs-human', escalation: verdict.reason });
                trigger.setReadble(Readable.from([HANDOVER]), { mimeType: 'text/plain; charset=utf-8' });
                return trigger.ok();
            }

            const articles = await helpCenter(trigger.context, message);
            const events = await assistant(ticket).with({ articles }).stream(message);

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
                // Act only when sure: below the threshold, a person confirms the model's suggestion.
                const result = await triage(ticket);
                const status = result.departmentConfidence >= ROUTING_CONFIDENCE ? 'triaged' : 'needs-routing';
                await tickets.by(ticket.id).set({ ...ticket, status, triage: result });
            } catch (error) {
                // Without an answer, the ticket goes to the general queue. The customer never notices.
                log().stack(`triage of ${ticket.id} failed: ${(error as Error).message}`).error();
                await tickets.by(ticket.id).set({ ...ticket, status: 'triage-failed' });
            }
        });
        return route;
    }
}

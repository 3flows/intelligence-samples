import { randomUUID } from 'node:crypto';
import { Readable } from 'node:stream';
import { Register, Route, TriggerContext, t } from '@3flows/platform';
import { ConversationMessageEntity, InferenceTool } from '@3flows/intelligence';
import { IntelligenceContext, IntelligenceService, handler, intelligence } from '../_shared/intelligence-service.js';
import { Passage } from './help-center.js';
import { HANDOVER, review, screen } from './guardrails.js';
import { Department, Triage, triage, withAttachments } from './triage.js';

export const Attachment = t.object({ name: t.string(), content: t.string().describe('Text content') });

export const Ticket = t.object({
    email: t.string(),
    subject: t.string(),
    body: t.string(),
    attachments: t.array(Attachment).optional()
});

// What the model finds out lives under `triage`. Attachments live in blobs; the ticket keeps their names.
export const StoredTicket = Ticket.omit({ attachments: true }).extend({
    id: t.string(),
    attachments: t.array(t.string()),   // blobs: attachments/<ticket id>/<name>
    triage: Triage,
    status: t.enum(['open', 'needs-routing', 'needs-human']),
    escalation: t.string().nullable()      // why a person took over; null otherwise
});
export type StoredTicket = t.infer<typeof StoredTicket>;

export const ChatMessage = t.object({ ticketId: t.string(), message: t.string() });
export const ChatAnswer = t.object({ answer: t.string(), sources: t.array(t.string()) });
const Message = t.object({ role: t.string(), content: t.string() });

/** The assistant for one ticket: its conversation, its prompt, and the ticket as context. */
const assistant = (context: Pick<IntelligenceContext, 'conversations'>, ticket: StoredTicket) => withAttachments(
    context.conversations()
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

/** An agent's decision where the model was unsure or wrong. Tomorrow's evaluation case. */
export const Correction = t.object({
    ticketId: t.string(),
    subject: t.string(),
    body: t.string(),
    suggested: Department,
    chosen: Department,
    at: t.string()
});
export type Correction = t.infer<typeof Correction>;

@Register()
export class SupportService extends IntelligenceService {
    handlers = () => [
        handler('draftReply', Ticket.omit({ attachments: true }), t.object({ reply: t.string() }), async (ticket, trigger) => {
            const answer = await trigger.context.inference()
                .chat()
                .prompt('support.reply', { shop: 'Velo' })
                .with(ticket)
                .ask('Draft a reply to this ticket.');
            await trigger.ok({ reply: answer.text ?? '' });
        }),

        // Platform handlers validate input but don't apply Zod defaults: default in code.
        handler('createTicket', Ticket, StoredTicket, async ({ attachments = [], ...ticket }, trigger) => {
            const { blob, doc } = trigger.context;
            const id = randomUUID();

            // Files go into blobs first, so triage can read them.
            for (const { name, content } of attachments) {
                await blob().container('attachments').file(`${id}/${name}`).upload(Readable.from([Buffer.from(content)]));
            }

            const received = { id, ...ticket, attachments: attachments.map((a) => a.name) };
            const result = await triage(trigger.context, received);
            // Act only when sure: below the threshold, a person confirms the model's suggestion.
            const status = result.departmentConfidence >= ROUTING_CONFIDENCE ? 'open' : 'needs-routing';
            const stored: StoredTicket = { ...received, triage: result, status, escalation: null };
            await doc().collection('tickets').by(id).set(stored);
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
            const tickets = trigger.context.doc().collection('tickets');
            const ticket = await tickets.by(ticketId).get<StoredTicket>();
            if (!ticket) return trigger.notFound(`Ticket ${ticketId} not found`);

            // Before the model: some messages must not reach the assistant at all.
            const verdict = await screen(trigger.context, message);
            if (!verdict.allowed) {
                await tickets.by(ticketId).set({ ...ticket, status: 'needs-human', escalation: verdict.reason });
                return trigger.ok({ answer: HANDOVER, sources: [] });
            }

            // Retrieve first, then answer from what was retrieved.
            const articles = await helpCenter(trigger.context, message);

            const answer = await assistant(trigger.context, ticket)
                .tools(ordersOf(ticket, trigger.context))
                .with({ articles })
                .ask(message);

            // After the model: the reply is checked before the customer sees it.
            const checked = await review(trigger.context, answer.text ?? '', articles);
            if (!checked.allowed) {
                await tickets.by(ticketId).set({ ...ticket, status: 'needs-human', escalation: checked.reason });
                return trigger.ok({ answer: HANDOVER, sources: [] });
            }

            await trigger.ok({ answer: answer.text ?? '', sources: articles.map((article) => article.id) });
        }),

        handler('transcript', t.object({ ticketId: t.string() }), t.array(Message), async ({ ticketId }, trigger) => {
            const messages = await ConversationMessageEntity
                .find({ conversationKey: `ticket-${ticketId}` })
                .sort({ index: 1 })
                .all();
            await trigger.ok(messages.map((message: any) => ({ role: message.data.role, content: message.data.content })));
        }),

        // Everything a person has to look at: unsure routing, and messages or replies the guardrails stopped.
        handler('generalQueue', t.object({}).optional(), t.array(StoredTicket), async (_input, trigger) => {
            await trigger.ok(await trigger.context.doc().collection('tickets').find({ status: { $ne: 'open' } }).all<StoredTicket>());
        }),

        // An agent routes a ticket. Where that differs from the model, it's recorded as a correction.
        handler('routeTicket', t.object({ ticketId: t.string(), department: Department }), StoredTicket, async ({ ticketId, department }, trigger) => {
            const { doc } = trigger.context;
            const ticket = await doc().collection('tickets').by(ticketId).get<StoredTicket>();
            if (!ticket) return trigger.notFound(`Ticket ${ticketId} not found`);

            if (department !== ticket.triage.department) {
                const correction: Correction = {
                    ticketId, subject: ticket.subject, body: ticket.body,
                    suggested: ticket.triage.department, chosen: department, at: new Date().toISOString()
                };
                await doc().collection('corrections').by(ticketId).set(correction);
            }

            const routed: StoredTicket = { ...ticket, status: 'open', escalation: null, triage: { ...ticket.triage, department } };
            await doc().collection('tickets').by(ticketId).set(routed);
            await trigger.ok(routed);
        }),

        // Corrections in the format of evals/tickets.json: the evaluation set grows with real cases.
        handler('evaluationCases', t.object({}).optional(), t.object({ cases: t.array(t.any()) }), async (_input, trigger) => {
            const corrections = await trigger.context.doc().collection('corrections').find({}).all<Correction>();
            await trigger.ok({
                cases: corrections.map((c) => ({ id: `correction-${c.ticketId}`, input: { subject: c.subject, body: c.body }, expected: { department: c.chosen } }))
            });
        }),

        // Business rule at work: a department's tickets, high priority first.
        handler('queue', t.object({ department: Department }), t.array(StoredTicket), async ({ department }, trigger) => {
            const tickets = await trigger.context.doc().collection('tickets').find({ status: 'open', 'triage.department': department }).all<StoredTicket>();
            await trigger.ok(tickets.sort((a, b) => Number(b.triage.priority === 'high') - Number(a.triage.priority === 'high')));
        })
    ];

    routes(): Route {
        const route = super.routes();

        // The same assistant, streamed: the text is sent while it's generated.
        // A streamed reply can't be reviewed before it's sent: stream only where that's acceptable.
        route.http().post('/chat/stream').do(async (params, trigger) => {
            const context = intelligence(trigger.context);
            const { ticketId, message } = ChatMessage.parse(params);   // routes don't validate: do it here
            const ticket = await context.doc().collection('tickets').by(ticketId).get<StoredTicket>();
            if (!ticket) return trigger.notFound(`Ticket ${ticketId} not found`);

            const verdict = await screen(context, message);
            if (!verdict.allowed) {
                await context.doc().collection('tickets').by(ticketId).set({ ...ticket, status: 'needs-human', escalation: verdict.reason });
                trigger.setReadble(Readable.from([HANDOVER]), { mimeType: 'text/plain; charset=utf-8' });
                return trigger.ok();
            }

            const articles = await helpCenter(context, message);
            const events = await assistant(context, ticket).with({ articles }).stream(message);

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
import { randomUUID } from 'node:crypto';
import { Readable } from 'node:stream';
import { Register, Route, TriggerContext, t } from '@3flows/platform';
import { ConversationMessageEntity, InferenceTool } from '@3flows/intelligence';
import { IntelligenceContext, IntelligenceService, handler, intelligence } from '../_shared/intelligence-service.js';
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
    triage: Triage
});
export type StoredTicket = t.infer<typeof StoredTicket>;

export const ChatMessage = t.object({ ticketId: t.string(), message: t.string() });
export const ChatAnswer = t.object({ answer: t.string() });
const Message = t.object({ role: t.string(), content: t.string() });

/** The assistant for one ticket: its conversation, its prompt, and the ticket as context. */
const assistant = (context: Pick<IntelligenceContext, 'conversations'>, ticket: StoredTicket) => withAttachments(
    context.conversations()
        .conversation(`ticket-${ticket.id}`)
        .prompt('support.chat', { shop: 'Velo' })
        .with({ subject: ticket.subject, body: ticket.body, triage: ticket.triage }),
    ticket
);

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
            const stored: StoredTicket = { ...received, triage: await triage(trigger.context, received) };
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
            const ticket = await trigger.context.doc().collection('tickets').by(ticketId).get<StoredTicket>();
            if (!ticket) return trigger.notFound(`Ticket ${ticketId} not found`);

            const answer = await assistant(trigger.context, ticket)
                .tools(ordersOf(ticket, trigger.context))
                .ask(message);
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

import { randomUUID } from 'node:crypto';
import { Register, t } from '@3flows/platform';
import { IntelligenceServiceContext, IntelligenceService, handler } from '@3flows/intelligence';
import { ChatTurn, chatOf, recent, remember } from './chat.js';
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

/** The assistant for one ticket: its history, its prompt, and the ticket as context. */
const assistant = (context: Pick<IntelligenceServiceContext, 'inference'>, ticket: StoredTicket, history: ChatTurn[]) => context.inference()
    .chat()
    .messages(recent(history))
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
                .question('Draft a reply to this ticket.')
                .answer();
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

            const history = await chatOf(trigger.context, ticketId);
            const answer = await assistant(trigger.context, ticket, history).question(message).answer();
            await remember(trigger.context, ticketId, message, answer.text ?? '');
            await trigger.ok({ answer: answer.text ?? '' });
        }),

        handler('transcript', t.object({ ticketId: t.string() }), t.array(Message), async ({ ticketId }, trigger) => {
            await trigger.ok(await chatOf(trigger.context, ticketId));
        }),

        // Business rule at work: a department's tickets, high priority first.
        handler('queue', t.object({ department: Department }), t.array(StoredTicket), async ({ department }, trigger) => {
            const tickets = await trigger.context.doc().collection('tickets').find({ 'triage.department': department }).all<StoredTicket>();
            await trigger.ok(tickets.sort((a, b) => Number(b.triage.priority === 'high') - Number(a.triage.priority === 'high')));
        })
    ];
}

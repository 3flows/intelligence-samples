import { randomUUID } from 'node:crypto';
import { Register, t } from '@3flows/platform';
import { IntelligenceService, handler } from '../_shared/intelligence-service.js';
import { Department, Triage, triage } from './triage.js';

export const Ticket = t.object({
    email: t.string(),
    subject: t.string(),
    body: t.string()
});

// The ticket keeps this shape from here on. What the model finds out lives under `triage`.
export const StoredTicket = Ticket.extend({ id: t.string(), triage: Triage });
export type StoredTicket = t.infer<typeof StoredTicket>;

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

        // Business rule at work: a department's tickets, high priority first.
        handler('queue', t.object({ department: Department }), t.array(StoredTicket), async ({ department }, trigger) => {
            const tickets = await trigger.context.doc().collection('tickets').find({ 'triage.department': department }).all<StoredTicket>();
            await trigger.ok(tickets.sort((a, b) => Number(b.triage.priority === 'high') - Number(a.triage.priority === 'high')));
        })
    ];
}

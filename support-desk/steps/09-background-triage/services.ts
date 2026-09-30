import { randomUUID } from 'node:crypto';
import { Register, Route, Service, handler, t } from '@3flows/platform';
import { Intelligence } from '@3flows/intelligence';
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

        // Everything the model hasn't (successfully) routed: a person works through it.
        handler('generalQueue', t.object({}).optional(), t.array(StoredTicket), async (_input, trigger) => {
            await trigger.ok(await trigger.context.doc().collection('tickets').find({ status: { $ne: 'triaged' } }).all<StoredTicket>());
        })
    ];

    routes(): Route {
        const route = super.routes();
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

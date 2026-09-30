import { randomUUID } from 'node:crypto';
import { Register, Service, handler, t } from '@3flows/platform';
import { Intelligence } from '@3flows/intelligence';

export const Ticket = t.object({
    email: t.string(),
    subject: t.string(),
    body: t.string()
});

export const Department = t.enum(['billing', 'technical', 'sales']);
export type Department = t.infer<typeof Department>;

export const Topic = t.enum(['delivery', 'refund', 'invoice', 'defect', 'assembly', 'spare-parts', 'product-advice']);
export type Topic = t.infer<typeof Topic>;

// What each team handles. This is what a new colleague would need to know, too.
const departments: Record<Department, string> = {
    billing: 'Payments, invoices, refunds and prices',
    technical: 'Defects, repairs, assembly and spare parts',
    sales: 'Product advice and orders that have not been placed yet'
};

export const StoredTicket = Ticket.extend({
    id: t.string(),
    department: Department,
    departmentReason: t.string().nullable(),
    topics: t.array(Topic)
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
            const ai = Intelligence.inference();
            const text = { subject: ticket.subject, body: ticket.body };

            const department = await ai.choice('department')
                .oneOf(departments)
                .with(text)
                .ask('Which team should handle this ticket?');

            const topics = await ai.choice('topics')
                .manyOf(Topic.options)
                .with(text)
                .ask('Which topics does this ticket mention?');

            const stored: StoredTicket = {
                id: randomUUID(),
                ...ticket,
                department: department.value,
                departmentReason: department.reason ?? null,
                topics: topics.value
            };
            await trigger.context.doc().collection('tickets').by(stored.id).set(stored);
            await trigger.ok(stored);
        }),

        handler('getTicket', t.object({ id: t.string() }), StoredTicket, async ({ id }, trigger) => {
            await trigger.ok(await trigger.context.doc().collection('tickets').by(id).get<StoredTicket>());
        }),

        handler('topicReport', t.object({}).optional(), t.record(t.string(), t.number()), async (_input, trigger) => {
            const tickets = await trigger.context.doc().collection('tickets').find({}).all<StoredTicket>();
            const counts: Record<string, number> = {};
            for (const topic of tickets.flatMap((ticket) => ticket.topics)) counts[topic] = (counts[topic] ?? 0) + 1;
            await trigger.ok(counts);
        })
    ];
}

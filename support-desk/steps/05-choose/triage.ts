import { t } from '@3flows/platform';
import { IntelligenceContext } from '../_shared/intelligence-service.js';
// The desk's triage policy: what the model decides about a ticket. Each chapter adds one question.

export const Department = t.enum(['billing', 'technical', 'sales']);
export type Department = t.infer<typeof Department>;

// What each team handles. This is what a new colleague would need to know, too.
const departments: Record<Department, string> = {
    billing: 'Payments, invoices, refunds and prices',
    technical: 'Defects, repairs, assembly and spare parts',
    sales: 'Product advice and orders that have not been placed yet'
};

export const Topic = t.enum(['delivery', 'refund', 'invoice', 'defect', 'assembly', 'spare-parts', 'product-advice']);
export type Topic = t.infer<typeof Topic>;

export const Triage = t.object({
    department: Department,
    departmentReason: t.string().nullable(),
    topics: t.array(Topic)
});
export type Triage = t.infer<typeof Triage>;

/** Everything the desk wants to know about a ticket, decided by the model. */
export async function triage(context: Pick<IntelligenceContext, 'inference'>, ticket: { subject: string; body: string }): Promise<Triage> {
    const ai = context.inference();
    const text = { subject: ticket.subject, body: ticket.body };

    // Independent questions about the same text: ask them in parallel.
    const [department, topics] = await Promise.all([
        ai.choice('department').oneOf(departments).with(text)
            .ask('Which team should handle this ticket?'),
        ai.choice('topics').manyOf(Topic.options).with(text)
            .ask('Which topics does this ticket mention?')
    ]);

    return {
        department: department.value,
        departmentReason: department.reason ?? null,
        topics: topics.value
    };
}

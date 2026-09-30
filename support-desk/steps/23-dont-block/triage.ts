import { t } from '@3flows/platform';
import { IntelligenceContext } from '../_shared/intelligence-service.js';
import { Priority, priorityOf } from './rules.js';
// The desk's triage policy: what the model decides about a ticket. Each chapter adds one question.

export const Department = t.enum(['billing', 'technical', 'sales']);
export type Department = t.infer<typeof Department>;

// What each team handles. This is what a new colleague would need to know, too.
// v2, after the evaluation in step 16: placed orders belong to billing, buying anything belongs to sales.
const departments: Record<Department, string> = {
    billing: 'Payments, invoices, refunds of unused returns, and orders already placed: delivery status, cancellations, address changes',
    technical: 'Defects, repairs, assembly, and warranty claims, including returns of defective items',
    sales: 'Advice before buying: sizes, prices, availability and discounts, also for spare parts and accessories'
};

export const Topic = t.enum(['delivery', 'refund', 'invoice', 'defect', 'assembly', 'spare-parts', 'product-advice']);
export type Topic = t.infer<typeof Topic>;

// What the ends and the middle of the frustration scale mean.
const frustrationScale = [
    '0: calm and friendly',
    '5: annoyed, but patient',
    '10: angry, feels ignored or threatens to leave'
];

// Nullable: information that may be missing. Otherwise the model invents it.
export const Facts = t.object({
    orderNumber: t.string().nullable().describe('The customer’s order number, the letter A, a dash and four digits (A-1042). null if the ticket contains none. Never a product name.'),
    product: t.string().nullable().describe('The product the ticket is about, if any'),
    summary: t.string().describe('One sentence in English, for the agents’ queue')
});

export const Triage = Facts.extend({
    department: Department,
    departmentReason: t.string().nullable(),
    departmentConfidence: t.number(),
    topics: t.array(Topic),
    urgent: t.boolean(),
    urgentReason: t.string().nullable(),
    frustration: t.number(),
    priority: Priority
});
export type Triage = t.infer<typeof Triage>;

/** The AI for all triage questions. Which model that is, is decided in YAML. */
export const TRIAGE = 'triage';

/** What triage needs of a ticket: its text, and the names of its attachments in blobs. */
export type TriageInput = { id: string; subject: string; body: string; attachments: string[] };

/** Adds the ticket's attachments to any chain. */
export function withAttachments<C extends { withBlob(container: string, path: string): C }>(chain: C, ticket: Pick<TriageInput, 'id' | 'attachments'>): C {
    return ticket.attachments.reduce((current, name) => current.withBlob('attachments', `${ticket.id}/${name}`), chain);
}

export const isOrderNumber = (value: string | null): value is string => value !== null && /^A-\d{4}$/.test(value);

/** Everything the desk wants to know about a ticket, decided by the model. */
export async function triage(context: Pick<IntelligenceContext, 'inference'>, ticket: TriageInput): Promise<Triage> {
    const ai = context.inference();
    const text = { subject: ticket.subject, body: ticket.body };

    // Independent questions about the same text: ask them in parallel.
    const [department, topics, urgent, frustration, facts] = await Promise.all([
        ai.choice('department').model(TRIAGE).prompt('support.routing').oneOf(departments).with(text)
            .ask('Which team should handle this ticket?'),
        ai.choice('topics').model(TRIAGE).manyOf(Topic.options).with(text)
            .ask('Which topics does this ticket mention?'),
        ai.check('urgent').model(TRIAGE).with(text)
            .ask('Does the customer need an answer today? Only if there is a deadline in the next days, a safety issue (for example a cracked frame or failing brakes), or a bike they cannot ride. Payment problems and late refunds alone are not urgent.'),
        ai.score('frustration').model(TRIAGE).between(0, 10).criteria(...frustrationScale).with(text)
            .ask('How frustrated is the customer?'),
        // The facts may be in an attachment: the extraction reads them too.
        withAttachments(ai.extract('facts').model(TRIAGE).schema(Facts).with(text), ticket)
            .ask('Extract the facts of this ticket.')
    ]);

    return {
        ...facts,
        // A rule, not a prompt: whatever doesn't look like an order number isn't one.
        orderNumber: isOrderNumber(facts.orderNumber) ? facts.orderNumber : null,
        department: department.value,
        departmentReason: department.reason ?? null,
        departmentConfidence: department.confidence ?? 0,
        topics: topics.value,
        urgent: urgent.value,
        urgentReason: urgent.reason ?? null,
        frustration: frustration.value,
        // The model measured; our rule decides.
        priority: priorityOf(urgent.value, frustration.value)
    };
}

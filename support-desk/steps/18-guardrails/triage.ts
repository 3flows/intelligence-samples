import { t } from '@3flows/platform';
import { Intelligence } from '@3flows/intelligence';

// The desk's triage policy, in one place: what the model decides about a ticket.

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

export const Priority = t.enum(['normal', 'high']);
export type Priority = t.infer<typeof Priority>;

// What the ends and the middle of the frustration scale mean.
const frustrationScale = [
    '0: calm and friendly',
    '5: annoyed, but patient',
    '10: angry, feels ignored or threatens to leave'
];

/** Business rule: urgent tickets and very frustrated customers go first. */
export function priorityOf(urgent: boolean, frustration: number): Priority {
    return urgent || frustration >= 7 ? 'high' : 'normal';
}

// Nullable: information that may be missing. Otherwise the model invents it.
export const Facts = t.object({
    orderNumber: t.string().nullable().describe('Order number like A-1042, if the customer mentions one'),
    product: t.string().nullable().describe('The product the ticket is about, if any'),
    summary: t.string().describe('One sentence in English, for the agents’ queue')
});

export const Triage = Facts.extend({
    department: Department,
    departmentReason: t.string().nullable(),
    topics: t.array(Topic),
    departmentConfidence: t.number(),
    urgent: t.boolean(),
    urgentReason: t.string().nullable(),
    frustration: t.number(),
    priority: Priority
});
export type Triage = t.infer<typeof Triage>;

/** The AI for all triage questions. Which model that is, is decided in YAML. */
const TRIAGE = 'triage';

/** What triage needs of a ticket: its text, and the names of its attachments in blobs. */
export type TriageInput = { id: string; subject: string; body: string; attachments: string[] };

/** Adds the ticket's attachments to any chain. */
export function withAttachments<C extends { withBlob(container: string, path: string): C }>(chain: C, ticket: Pick<TriageInput, 'id' | 'attachments'>): C {
    return ticket.attachments.reduce((current, name) => current.withBlob('attachments', `${ticket.id}/${name}`), chain);
}

/** Everything the desk wants to know about a ticket, decided by the model. */
export async function triage(ticket: TriageInput): Promise<Triage> {
    const ai = Intelligence.inference();
    const text = { subject: ticket.subject, body: ticket.body };

    // Independent questions about the same text: ask them in parallel.
    const [department, topics, urgent, frustration, facts] = await Promise.all([
        ai.choice('department').model(TRIAGE).oneOf(departments).with(text)
            .ask('Which team should handle this ticket?'),
        ai.choice('topics').model(TRIAGE).manyOf(Topic.options).with(text)
            .ask('Which topics does this ticket mention?'),
        ai.check('urgent').model(TRIAGE).with(text)
            .ask('Does the customer need an answer today, for example because of a deadline, a safety issue or a bike they cannot ride?'),
        ai.score('frustration').model(TRIAGE).between(0, 10).criteria(...frustrationScale).with(text)
            .ask('How frustrated is the customer?'),
        // The facts may be in an attachment: the extraction reads them too.
        withAttachments(ai.extract('facts').model(TRIAGE).schema(Facts).with(text), ticket)
            .ask('Extract the facts of this ticket.')
    ]);

    return {
        ...facts,
        department: department.value,
        departmentReason: department.reason ?? null,
        departmentConfidence: department.confidence ?? 0,
        topics: topics.value,
        urgent: urgent.value,
        urgentReason: urgent.reason ?? null,
        frustration: frustration.value,
        priority: priorityOf(urgent.value, frustration.value)
    };
}

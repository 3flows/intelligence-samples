import { t } from '@3flows/platform';

// Business rules: ordinary code, reviewed and tested like any other. The model only delivers the inputs.

export const Priority = t.enum(['normal', 'high']);
export type Priority = t.infer<typeof Priority>;

/** Urgent tickets and very frustrated customers go first. */
export function priorityOf(urgent: boolean, frustration: number): Priority {
    return urgent || frustration >= 7 ? 'high' : 'normal';
}

/** Below this confidence in the department, a person routes the ticket. */
export const ROUTING_CONFIDENCE = 0.6;

export function statusAfterTriage(triage: { departmentConfidence: number }): 'open' | 'needs-routing' {
    return triage.departmentConfidence >= ROUTING_CONFIDENCE ? 'open' : 'needs-routing';
}

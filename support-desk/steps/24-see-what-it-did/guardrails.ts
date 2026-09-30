import { IntelligenceContext } from '../_shared/intelligence-service.js';
import { Source, grounded } from './judges.js';
import { TRIAGE } from './triage.js';

/** What the customer reads when the assistant may not answer. Written by us, not by a model. */
export const HANDOVER = 'Thanks. A colleague will take it from here.';

export type Verdict = { allowed: true } | { allowed: false; reason: string };

/** Before the model: may the assistant answer this message at all? */
export async function screen(context: Pick<IntelligenceContext, 'inference'>, message: string, ticketId: string): Promise<Verdict> {
    const ai = context.inference();
    const tag = { ticketId, job: 'guardrails' };

    // The provider's safety categories: abuse, hate, violence, self-harm, …
    const moderation = await ai.moderation().metadata(tag).check(message);
    if (moderation.flagged) return { allowed: false, reason: 'moderation' };

    // Our own red line: payment details are handled by people only.
    const payment = await ai.check('payment-details')
        .model(TRIAGE)
        .metadata(tag)
        .with(message)
        .ask('Does the message ask to change bank, payment or refund details, or contain card numbers?');
    if (payment.value) return { allowed: false, reason: 'payment-details' };

    return { allowed: true };
}

/** After the model: may the customer see this reply? */
export async function review(context: Pick<IntelligenceContext, 'inference'>, reply: string, sources: Source[], ticketId: string): Promise<Verdict> {
    const [promises, isGrounded] = await Promise.all([
        context.inference()
            .check('promises')
            .model(TRIAGE)
            .metadata({ ticketId, job: 'guardrails' })
            .with({ reply })
            .ask('Does the reply promise a refund, a discount, a replacement or a delivery date?'),
        grounded(context, reply, sources, { ticketId, job: 'guardrails' })
    ]);
    if (promises.value) return { allowed: false, reason: 'reply-promises' };
    if (!isGrounded.value) return { allowed: false, reason: 'reply-not-grounded' };
    return { allowed: true };
}

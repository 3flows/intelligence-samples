import { IntelligenceContext } from '../_shared/intelligence-service.js';

/** What the customer reads when the assistant may not answer. Written by us, not by a model. */
export const HANDOVER = 'Thanks. A colleague will take it from here.';

export type Verdict = { allowed: true } | { allowed: false; reason: string };

/** Before the model: may the assistant answer this message at all? */
export async function screen(context: Pick<IntelligenceContext, 'inference'>, message: string): Promise<Verdict> {
    const ai = context.inference();

    // The provider's safety categories: abuse, hate, violence, self-harm, …
    const moderation = await ai.moderation().check(message);
    if (moderation.flagged) return { allowed: false, reason: 'moderation' };

    // Our own red line: payment details are handled by people only.
    const payment = await ai.check('payment-details')
        .with(message)
        .ask('Does the message ask to change bank, payment or refund details, or contain card numbers?');
    if (payment.value) return { allowed: false, reason: 'payment-details' };

    return { allowed: true };
}

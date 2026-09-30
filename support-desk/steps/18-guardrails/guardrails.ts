import { Intelligence } from '@3flows/intelligence';

export type Verdict = { allowed: true } | { allowed: false; reason: string };

/** Decides whether the assistant may answer a chat message at all. */
export async function screen(message: string): Promise<Verdict> {
    const ai = Intelligence.inference();

    // The provider's safety categories: abuse, hate, violence, self-harm, …
    const moderation = await ai.moderation().check(message);
    if (moderation.flagged) return { allowed: false, reason: 'moderation' };

    // Our own red line: payment details are handled by people only.
    const payment = await ai.check('payment-details')
        .model('triage')
        .with(message)
        .ask('Does the message ask to change bank, payment or refund details, or contain card numbers?');
    if (payment.value) return { allowed: false, reason: 'payment-details' };

    return { allowed: true };
}

import { Intelligence } from '@3flows/intelligence';

export type Verdict = { allowed: true } | { allowed: false; reason: string };

/** Decides whether the assistant may answer a chat message at all. */
export async function screen(message: string, ticketId: string): Promise<Verdict> {
    const ai = Intelligence.inference();
    const tag = { ticketId, job: 'guardrails' };

    // The provider's safety categories: abuse, hate, violence, self-harm, …
    const moderation = await ai.moderation().metadata(tag).check(message);
    if (moderation.flagged) return { allowed: false, reason: 'moderation' };

    // Our own red line: payment details are handled by people only.
    const payment = await ai.check('payment-details')
        .model('triage')
        .metadata(tag)
        .with(message)
        .ask('Does the message ask to change bank, payment or refund details, or contain card numbers?');
    if (payment.value) return { allowed: false, reason: 'payment-details' };

    return { allowed: true };
}

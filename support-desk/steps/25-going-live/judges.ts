import { IntelligenceContext } from '../_shared/intelligence-service.js';
import { TRIAGE } from './triage.js';

// Judges: the model reviewing an answer against written rules. The same judges run in evaluations and,
// from step 20, on every reply before it's sent.

export type Source = { title: string; text: string };

/** Is every statement of fact in the reply backed by the sources the assistant was given? */
export const grounded = (context: Pick<IntelligenceContext, 'inference'>, reply: string, sources: Source[], tag: Record<string, unknown> = {}) =>
    context.inference()
        .check('grounded')
        .model(TRIAGE)
        .metadata(tag)
        .with({ reply, sources })
        // Sharpened after step 18's evaluation: the judge had punished replies for leaving things out.
        .ask('Is every statement of fact in the reply supported by the sources? Leaving out information is fine. Greetings, questions to the customer and offers to hand over to a colleague need no support.');

/** How well does the reply follow the tone rules of support.reply? 1 to 5. */
export const tone = (context: Pick<IntelligenceContext, 'inference'>, reply: string) =>
    context.inference()
        .score('tone')
        .model(TRIAGE)
        .between(1, 5)
        .criteria(
            '1: long, vague, pushy, or it promises refunds, discounts or delivery dates',
            '3: acceptable, but could be shorter or more concrete',
            '5: brief, friendly and concrete, with no promises'
        )
        .with({ reply })
        .ask('How well does this support reply follow the rules?');

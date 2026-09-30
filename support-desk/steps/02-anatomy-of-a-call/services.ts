import { Register, t } from '@3flows/platform';
import { IntelligenceService, handler } from '../_shared/intelligence-service.js';

export const Ticket = t.object({
    email: t.string(),
    subject: t.string(),
    body: t.string()
});

export const Reply = t.object({ reply: t.string() });

@Register()
export class SupportService extends IntelligenceService {
    handlers = () => [
        handler('ask', t.object({ question: t.string() }), t.object({ answer: t.string() }), async ({ question }, trigger) => {
            const answer = await trigger.context.inference().chat().ask(question);
            await trigger.ok({ answer: answer.text ?? '' });
        }),

        handler('draftReply', Ticket, Reply, async (ticket, trigger) => {
            const { inference } = trigger.context;

            const answer = await inference()
                .chat()
                // Instructions: policy, the same for every ticket.
                .instructions(
                    'You draft replies for the support team of Velo, a bike shop.',
                    'Be brief, friendly and concrete. Never promise refunds or delivery dates.'
                )
                // Input: the data this call works on.
                .with(ticket)
                // Question: the task of this call.
                .ask('Draft a reply to this ticket.');

            await trigger.ok({ reply: answer.text ?? '' });
        })
    ];
}

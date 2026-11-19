import { Register, t } from '@3flows/platform';
import { IntelligenceService, handler } from '@3flows/intelligence';

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
            const answer = await trigger.context.inference().chat().question(question).answer();
            await trigger.ok({ answer: answer.text ?? '' });
        }),

        handler('draftReply', Ticket, Reply, async (ticket, trigger) => {
            const { inference } = trigger.context;

            const answer = await inference()
                .chat()
                // Policy lives in YAML now: the reviewed, versioned prompt support.reply.
                .prompt('support.reply', { shop: 'Velo' })
                .with(ticket)
                .question('Draft a reply to this ticket.')
                .answer();

            await trigger.ok({ reply: answer.text ?? '' });
        })
    ];
}

import { Register, Service, handler, t } from '@3flows/platform';
import { Intelligence } from '@3flows/intelligence';

export const Ticket = t.object({
    email: t.string(),
    subject: t.string(),
    body: t.string()
});

// Policy: the same for every ticket. Chains are immutable, so one shared chain is safe.
const replies = Intelligence.inference()
    .chat()
    .instructions(
        'You draft replies for the support team of Velo, a bike shop.',
        'Be brief, friendly and concrete. Never promise refunds or delivery dates.'
    );

@Register()
export class SupportService extends Service {
    handlers = () => [
        handler('ask', t.object({ question: t.string() }), t.object({ answer: t.string() }), async ({ question }, trigger) => {
            const answer = await Intelligence.inference().chat().ask(question);
            await trigger.ok({ answer: answer.text ?? '' });
        }),

        handler('draftReply', Ticket, t.object({ reply: t.string() }), async (ticket, trigger) => {
            // Data: this ticket. Task: this call.
            const answer = await replies
                .with(ticket)
                .ask('Draft a reply to this ticket.');
            await trigger.ok({ reply: answer.text ?? '' });
        })
    ];
}

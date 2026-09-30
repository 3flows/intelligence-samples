import { Register, Service, handler, t } from '@3flows/platform';
import { Intelligence } from '@3flows/intelligence';

@Register()
export class SupportService extends Service {
    handlers = () => [
        handler(
            'ask',
            t.object({ question: t.string() }),
            t.object({ answer: t.string() }),
            async ({ question }, trigger) => {
                const answer = await Intelligence.inference().chat().ask(question);
                await trigger.ok({ answer: answer.text ?? '' });
            }
        )
    ];
}

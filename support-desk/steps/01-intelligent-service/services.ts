import { Register, t } from '@3flows/platform';
import { IntelligenceService, handler } from '../_shared/intelligence-service.js';

@Register()
export class SupportService extends IntelligenceService {
    handlers = () => [
        handler(
            'ask',
            t.object({ question: t.string() }),
            t.object({ answer: t.string() }),
            async ({ question }, trigger) => {
                const { inference } = trigger.context;
                const answer = await inference().chat().ask(question);
                await trigger.ok({ answer: answer.text ?? '' });
            }
        )
    ];
}

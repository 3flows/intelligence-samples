/**
 * PREVIEW of a proposed @3flows/intelligence change, kept in the samples until the library ships it:
 * an intelligence service whose trigger context carries inference(), conversations() and prompts(),
 * next to the platform's doc(), mq(), blob() and service().
 *
 * Once it's in the library, import IntelligenceService and handler from '@3flows/intelligence' instead.
 */
import { Handler, Trigger, TriggerContext, handler as platformHandler, t } from '@3flows/platform';
import { Conversations, Inference, IntelligenceService as LibraryIntelligenceService, Prompts } from '@3flows/intelligence';

/** What an intelligence service adds to the trigger context. */
export type IntelligenceContext = {
    inference: () => Inference;
    conversations: () => Conversations;
    prompts: () => Prompts;
};

export type IntelligenceTriggerContext = TriggerContext & IntelligenceContext;

export type IntelligenceTrigger<O> = Omit<Trigger<O>, 'context'> & { context: IntelligenceTriggerContext };

export abstract class IntelligenceService extends LibraryIntelligenceService {
    constructor() {
        super();
        const platformContext = this.getServiceContext;
        this.getServiceContext = () => ({
            ...platformContext(),
            inference: this.inference,
            conversations: this.conversations,
            prompts: this.prompts
        }) as ReturnType<typeof platformContext>;
    }

    // The library's IntelligenceService still requires the older signal API. Nothing here uses it.
    async handle(): Promise<void> {}
}

/** The platform's handler, with the intelligence trigger context. */
export function handler<I, O>(
    method: string,
    input: t.Schema<I>,
    output: t.Schema<O>,
    fn: (params: I, trigger: IntelligenceTrigger<O>) => Promise<void>,
    description?: string
): Handler<I, O> {
    return platformHandler(method, input, output, fn as unknown as (params: I, trigger: Trigger<O>) => Promise<void>, description);
}

/** For routes (HTTP, queues), whose trigger is typed by the platform. */
export const intelligence = (context: TriggerContext): IntelligenceTriggerContext => context as IntelligenceTriggerContext;

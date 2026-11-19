import { IntelligenceService, handler, tool } from '@3flows/intelligence';
import { Register, t } from '@3flows/intelligence/platform';
import { quickAnswerWorkflow } from './workflows.js';

const AskInput = t.object({ question: t.string() });
const AskOutput = t.object({ answer: t.string() });
const OrderInput = t.object({ number: t.string() });
const OrderOutput = t.object({ number: t.string(), status: t.string() });
const AgentInput = t.object({ task: t.string() });
const AgentOutput = t.object({ runId: t.string(), status: t.string(), text: t.string().optional() });

@Register()
export class SupportService extends IntelligenceService {
    private workflowsRegistered = false;

    handlers = () => [
        handler('ask', AskInput, AskOutput, async ({ question }, trigger) => {
            const response = await trigger.context
                .inference()
                .chat()
                .instructions('Answer as a concise starter-app support assistant.')
                .metadata({ purpose: 'starter.ask' })
                .timeout(10_000)
                .ask(question);

            await trigger.ok({ answer: response.text ?? '' });
        }),

        handler('askWithWorkflow', AskInput, AskOutput, async (input, trigger) => {
            this.ensureWorkflows();
            const output = (await trigger.context.workflow('starter.quickAnswer').input(input).run()) as {
                answer: string;
            };
            await trigger.ok(output);
        }),

        handler('runAgent', AgentInput, AgentOutput, async ({ task }, trigger) => {
            const run = await trigger.context.agent('starter_agent').task(task).run();
            await trigger.ok({ runId: run.runId, status: run.status, text: run.text });
        }),

        tool(
            'lookupOrder',
            OrderInput,
            OrderOutput,
            async ({ number }, trigger) => {
                await trigger.ok({ number, status: number === 'A-1042' ? 'shipped' : 'unknown' });
            },
            {
                description: 'Look up a sample order status by order number.',
                readOnly: true,
                tags: ['public', 'orders']
            }
        )
    ];

    private ensureWorkflows(): void {
        if (this.workflowsRegistered) return;
        this.workflows().register(quickAnswerWorkflow);
        this.workflowsRegistered = true;
    }
}

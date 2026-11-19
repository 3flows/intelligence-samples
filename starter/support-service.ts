import { IntelligenceService, handler, tool } from '@3flows/intelligence';
import { Register, t } from '@3flows/intelligence/platform';
import { quickAnswerWorkflow } from './workflows.js';

const AskInput = t.object({ question: t.string() });
const AskOutput = t.object({ answer: t.string() });
const TriageInput = t.object({ id: t.string(), text: t.string() });
const TriageOutput = t.object({ id: t.string(), department: t.string(), confidence: t.number().optional() });
const OrderInput = t.object({ number: t.string() });
const OrderOutput = t.object({ number: t.string(), status: t.string() });
const AgentInput = t.object({ task: t.string() });
const AgentOutput = t.object({ runId: t.string(), status: t.string(), text: t.string().optional() });
const AIOutput = t.object({ name: t.string(), model: t.string() });

@Register()
export class SupportService extends IntelligenceService {
    private workflowsRegistered = false;

    handlers = () => [
        // Step 1: AIs are configuration. This handler only inspects which chat AI YAML selected.
        handler('describeChatAI', t.object({}), AIOutput, async (_input, trigger) => {
            const ai = trigger.context.ai(undefined, 'chat').describe();
            await trigger.ok({ name: ai.name, model: ai.model });
        }),

        // Step 2a: Fluent inference for a direct text response owned by application code.
        handler('ask', AskInput, AskOutput, async ({ question }, trigger) => {
            const response = await trigger.context
                .inference()
                .chat()
                .prompt('support.reply', { shop: 'Velo' })
                .metadata({ purpose: 'starter.ask' })
                .timeout(10_000)
                .ask(question);

            await trigger.ok({ answer: response.text ?? '' });
        }),

        // Step 2b: Fluent decisions turn language into typed data for code to branch on.
        handler('triageTicket', TriageInput, TriageOutput, async ({ id, text }, trigger) => {
            const decision = await trigger.context
                .inference()
                .choice('department')
                .state('Route this support ticket to the best department.')
                .oneOf(['billing', 'shipping', 'technical'])
                .with(text)
                .metadata({ purpose: 'starter.triage', subjectType: 'ticket', subjectId: id })
                .timeout(10_000)
                .decide();

            await trigger.ok({ id, department: decision.value, confidence: decision.confidence });
        }),

        // Step 5: Workflows orchestrate known multi-step work. This one wraps a chat step.
        handler('askWithWorkflow', AskInput, AskOutput, async (input, trigger) => {
            this.ensureWorkflows();
            const output = (await trigger.context.workflow('starter.quickAnswer').input(input).run()) as {
                answer: string;
            };
            await trigger.ok(output);
        }),

        // Step 4: Agents run task-oriented AI work and return a run id/status.
        handler('runAgent', AgentInput, AgentOutput, async ({ task }, trigger) => {
            const run = await trigger.context.agent('starter_agent').task(task).run();
            await trigger.ok({ runId: run.runId, status: run.status, text: run.text });
        }),

        // Shared tool: Fluent chat, chatbots and agents can discover this model-facing handler.
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

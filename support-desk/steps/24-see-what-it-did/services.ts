import { randomUUID } from 'node:crypto';
import { Readable } from 'node:stream';
import { Register, Route, TriggerContext, t } from '@3flows/platform';
import {
    InferenceTool, IntelligenceService, IntelligenceServiceContext,
    IntelligenceTraceDomain, IntelligenceTrigger, handler
} from '@3flows/intelligence';
import { Passage } from './help-center.js';
import { HANDOVER, review, screen } from './guardrails.js';
import { ChatTurn, chatOf, recent, remember } from './chat.js';
import { Department, Triage, triage, withAttachments } from './triage.js';

export const Attachment = t.object({ name: t.string(), content: t.string().describe('Text content') });

export const Ticket = t.object({
    email: t.string(),
    subject: t.string(),
    body: t.string(),
    attachments: t.array(Attachment).optional()
});

// What the model finds out lives under `triage`. Attachments live in blobs; the ticket keeps their names.
export const StoredTicket = Ticket.omit({ attachments: true }).extend({
    id: t.string(),
    attachments: t.array(t.string()),   // blobs: attachments/<ticket id>/<name>
    triage: Triage.nullable(),             // null until the model has answered
    status: t.enum(['new', 'open', 'needs-routing', 'needs-human', 'triage-failed']),
    escalation: t.string().nullable()      // why a person took over; null otherwise
});
export type StoredTicket = t.infer<typeof StoredTicket>;

export const ChatMessage = t.object({ ticketId: t.string(), message: t.string() });
export const ChatAnswer = t.object({ answer: t.string(), sources: t.array(t.string()) });
const Message = t.object({ role: t.string(), content: t.string() });

const Usage = t.object({ calls: t.number(), inputTokens: t.number(), outputTokens: t.number(), byJob: t.record(t.string(), t.number()) });

const Run = t.object({
    operation: t.string(),
    ai: t.string(),
    model: t.string(),
    job: t.string().nullable(),
    prompts: t.array(t.object({ name: t.string(), version: t.string().nullable() })),
    totalTokens: t.number(),
    latencyMs: t.number().nullable(),
    status: t.string()
});

/** The assistant for one ticket: its history, its prompt, and the ticket as context. */
const assistant = (context: Pick<IntelligenceServiceContext, 'inference'>, ticket: StoredTicket, history: ChatTurn[]) => withAttachments(
    context.inference()
        .chat()
        .messages(recent(history))
        .prompt('support.chat', { shop: 'Velo' })
        .metadata({ subjectType: 'ticket', subjectId: ticket.id, purpose: 'chat' })
        .with({ subject: ticket.subject, body: ticket.body, triage: ticket.triage }),
    ticket
);

/** The help center passages most relevant to a question. */
const helpCenter = (context: TriggerContext, query: string) => context.service('HelpCenterService')
    .method('searchArticles')
    .input({ query, limit: 4 })
    .call<Passage[]>();

/** Look up orders of this ticket's customer only. The model chooses the number, never the email. */
const ordersOf = (ticket: StoredTicket, context: TriggerContext): InferenceTool => ({
    name: 'lookupOrder',
    description: 'Look up one of the customer’s orders by number: status, items and shipping date.',
    parameters: {
        type: 'object',
        properties: { number: { type: 'string', description: 'Order number like A-1042' } },
        required: ['number'],
        additionalProperties: false
    },
    execute: async (args) => context.service('OrdersService').method('lookupOrder')
        .input({ number: (args as { number: string }).number, email: ticket.email })
        .call()
});

/** Every model call made for a ticket: the inference runs tagged with it, and their calls to a provider. */
async function callsOf(ticketId: string) {
    const { InferenceRun, ModelCall } = IntelligenceTraceDomain;
    // Entity queries return ten records unless told otherwise: limit(0) reads them all.
    const runs = await InferenceRun.find({ subjectType: 'ticket', subjectId: ticketId }).limit(0).all();
    const calls = await Promise.all(runs.map((run) => ModelCall.find({ run: run.reference() }).limit(0).all()));
    return runs.flatMap((run, index) => calls[index].map((call) => ({ run: run.data, call: call.data })));
}

/** Business rule: below this, a person routes the ticket. */
const ROUTING_CONFIDENCE = 0.6;

/** An agent's decision where the model was unsure or wrong. Tomorrow's evaluation case. */
export const Correction = t.object({
    ticketId: t.string(),
    subject: t.string(),
    body: t.string(),
    suggested: Department,
    chosen: Department,
    at: t.string()
});
export type Correction = t.infer<typeof Correction>;

@Register()
export class SupportService extends IntelligenceService {
    handlers = () => [
        handler('draftReply', Ticket.omit({ attachments: true }), t.object({ reply: t.string() }), async (ticket, trigger) => {
            const answer = await trigger.context.inference()
                .chat()
                .prompt('support.reply', { shop: 'Velo' })
                .with(ticket)
                .question('Draft a reply to this ticket.')
                .answer();
            await trigger.ok({ reply: answer.text ?? '' });
        }),

        // Platform handlers validate input but don't apply Zod defaults: default in code.
        handler('createTicket', Ticket, StoredTicket, async ({ attachments = [], ...ticket }, trigger) => {
            const { blob, doc } = trigger.context;
            const id = randomUUID();

            // Files go into blobs first, so triage can read them.
            for (const { name, content } of attachments) {
                await blob().container('attachments').file(`${id}/${name}`).upload(Readable.from([Buffer.from(content)]));
            }

            // Received is what the customer needs to know. Triage follows from the queue.
            const stored: StoredTicket = { id, ...ticket, attachments: attachments.map((a) => a.name), triage: null, status: 'new', escalation: null };
            await doc().collection('tickets').by(id).set(stored);
            await trigger.context.mq().queue('ticket-created').send({ id });
            await trigger.ok(stored);
        }),

        handler('getTicket', t.object({ id: t.string() }), StoredTicket, async ({ id }, trigger) => {
            await trigger.ok(await trigger.context.doc().collection('tickets').by(id).get<StoredTicket>());
        }),

        handler('topicReport', t.object({}).optional(), t.record(t.string(), t.number()), async (_input, trigger) => {
            const tickets = await trigger.context.doc().collection('tickets').find({}).all<StoredTicket>();
            const counts: Record<string, number> = {};
            for (const topic of tickets.flatMap((ticket) => ticket.triage?.topics ?? [])) counts[topic] = (counts[topic] ?? 0) + 1;
            await trigger.ok(counts);
        }),

        handler('chat', ChatMessage, ChatAnswer, async ({ ticketId, message }, trigger) => {
            const tickets = trigger.context.doc().collection('tickets');
            const ticket = await tickets.by(ticketId).get<StoredTicket>();
            if (!ticket) return trigger.notFound(`Ticket ${ticketId} not found`);

            // Before the model: some messages must not reach the assistant at all.
            const verdict = await screen(trigger.context, message, ticketId);
            if (!verdict.allowed) {
                await tickets.by(ticketId).set({ ...ticket, status: 'needs-human', escalation: verdict.reason });
                return trigger.ok({ answer: HANDOVER, sources: [] });
            }

            // Retrieve first, then answer from what was retrieved.
            const articles = await helpCenter(trigger.context, message);

            const history = await chatOf(trigger.context, ticketId);
            const answer = await assistant(trigger.context, ticket, history)
                .tools(ordersOf(ticket, trigger.context))
                .with({ articles })
                .question(message)
                .answer();

            // After the model: the reply is checked before the customer sees it.
            const checked = await review(trigger.context, answer.text ?? '', articles, ticketId);
            if (!checked.allowed) {
                await tickets.by(ticketId).set({ ...ticket, status: 'needs-human', escalation: checked.reason });
                return trigger.ok({ answer: HANDOVER, sources: [] });
            }

            await remember(trigger.context, ticketId, message, answer.text ?? '');

            await trigger.ok({ answer: answer.text ?? '', sources: articles.map((article) => article.id) });
        }),

        handler('transcript', t.object({ ticketId: t.string() }), t.array(Message), async ({ ticketId }, trigger) => {
            await trigger.ok(await chatOf(trigger.context, ticketId));
        }),

        // What did the model do for this ticket, and what did it cost?
        handler('ticketUsage', t.object({ ticketId: t.string() }), Usage, async ({ ticketId }, trigger) => {
            const calls = await callsOf(ticketId);
            const usage = { calls: calls.length, inputTokens: 0, outputTokens: 0, byJob: {} as Record<string, number> };
            for (const { run, call } of calls) {
                usage.inputTokens += call.inputTokens ?? 0;
                usage.outputTokens += call.outputTokens ?? 0;
                usage.byJob[run.purpose ?? 'other'] = (usage.byJob[run.purpose ?? 'other'] ?? 0) + (call.totalTokens ?? 0);
            }
            await trigger.ok(usage);
        }),

        handler('explain', t.object({ ticketId: t.string() }), t.array(Run), async ({ ticketId }, trigger) => {
            const calls = await callsOf(ticketId);
            await trigger.ok(calls.map(({ run, call }) => ({
                operation: run.kind,
                ai: call.ai ?? '',
                model: call.model ?? '',
                job: run.purpose ?? null,
                prompts: ((run.metadata.prompts ?? []) as any[]).map((p) => ({ name: p.name, version: p.version ?? null })),
                totalTokens: call.totalTokens ?? 0,
                latencyMs: call.durationMs ?? null,
                status: call.status
            })));
        }),

        // Everything a person has to look at: unsure routing, and messages or replies the guardrails stopped.
        handler('generalQueue', t.object({}).optional(), t.array(StoredTicket), async (_input, trigger) => {
            await trigger.ok(await trigger.context.doc().collection('tickets').find({ status: { $ne: 'open' } }).all<StoredTicket>());
        }),

        // An agent routes a ticket. Where that differs from the model, it's recorded as a correction.
        handler('routeTicket', t.object({ ticketId: t.string(), department: Department }), StoredTicket, async ({ ticketId, department }, trigger) => {
            const { doc } = trigger.context;
            const ticket = await doc().collection('tickets').by(ticketId).get<StoredTicket>();
            if (!ticket) return trigger.notFound(`Ticket ${ticketId} not found`);
            if (!ticket.triage) return trigger.notFound(`Ticket ${ticketId} has no triage to correct`);

            if (department !== ticket.triage.department) {
                const correction: Correction = {
                    ticketId, subject: ticket.subject, body: ticket.body,
                    suggested: ticket.triage.department, chosen: department, at: new Date().toISOString()
                };
                await doc().collection('corrections').by(ticketId).set(correction);
            }

            const routed: StoredTicket = { ...ticket, status: 'open', escalation: null, triage: { ...ticket.triage, department } };
            await doc().collection('tickets').by(ticketId).set(routed);
            await trigger.ok(routed);
        }),

        // Corrections in the format of evals/tickets.json: the evaluation set grows with real cases.
        handler('evaluationCases', t.object({}).optional(), t.object({ cases: t.array(t.any()) }), async (_input, trigger) => {
            const corrections = await trigger.context.doc().collection('corrections').find({}).all<Correction>();
            await trigger.ok({
                cases: corrections.map((c) => ({ id: `correction-${c.ticketId}`, input: { subject: c.subject, body: c.body }, expected: { department: c.chosen } }))
            });
        }),

        // Business rule at work: a department's tickets, high priority first.
        handler('queue', t.object({ department: Department }), t.array(StoredTicket), async ({ department }, trigger) => {
            const tickets = await trigger.context.doc().collection('tickets').find({ status: 'open', 'triage.department': department }).all<StoredTicket>();
            await trigger.ok(tickets.sort((a, b) => Number(b.triage?.priority === 'high') - Number(a.triage?.priority === 'high')));
        })
    ];

    routes(): Route {
        const route = super.routes();

        // The same assistant, streamed: the text is sent while it's generated.
        // A streamed reply can't be reviewed before it's sent: stream only where that's acceptable.
        route.http().post('/chat/stream').do(async (params, trigger) => {
            const context = trigger.context as IntelligenceTrigger['context'];
            const { ticketId, message } = ChatMessage.parse(params);   // routes don't validate: do it here
            const ticket = await context.doc().collection('tickets').by(ticketId).get<StoredTicket>();
            if (!ticket) return trigger.notFound(`Ticket ${ticketId} not found`);

            const verdict = await screen(context, message, ticketId);
            if (!verdict.allowed) {
                await context.doc().collection('tickets').by(ticketId).set({ ...ticket, status: 'needs-human', escalation: verdict.reason });
                trigger.setReadble(Readable.from([HANDOVER]), { mimeType: 'text/plain; charset=utf-8' });
                return trigger.ok();
            }

            const articles = await helpCenter(context, message);
            const history = await chatOf(context, ticketId);
            const stream = await assistant(context, ticket, history).with({ articles }).question(message).stream();

            // The turn is stored when the stream has finished. A stream that breaks stores nothing.
            stream.onSettled((result) => {
                if (result.status === 'completed') void remember(context, ticketId, message, result.value.text ?? '');
            });

            trigger.setReadble(stream.toReadable({ format: 'text' }), { mimeType: 'text/plain; charset=utf-8' });
            await trigger.ok();
        });

        // Triage from the queue. A failed model call is a state, not a lost ticket.
        route.mq().queue('ticket-created').do(async (message, trigger) => {
            const context = trigger.context as IntelligenceTrigger['context'];
            const tickets = context.doc().collection('tickets');
            const ticket = await tickets.by((message as { id: string }).id).get<StoredTicket>();
            if (!ticket) return;

            try {
                const result = await triage(context, ticket);
                const status = result.departmentConfidence >= ROUTING_CONFIDENCE ? 'open' : 'needs-routing';
                await tickets.by(ticket.id).set({ ...ticket, triage: result, status });
            } catch (error) {
                context.log().stack(`triage of ${ticket.id} failed: ${(error as Error).message}`).error();
                await tickets.by(ticket.id).set({ ...ticket, status: 'triage-failed' });
            }
        });

        return route;
    }
}
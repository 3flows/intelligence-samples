import assert from 'node:assert/strict';
import { after, before, beforeEach, describe, test } from 'node:test';
import { Mcps, Platform } from '@3flows/platform';
import { AIChatRequest } from '@3flows/intelligence';
import { runOffline } from '../_shared/offline.js';
import { ScriptedAI } from '../_shared/scripted-ai.js';
import { triageScript } from '../_shared/triage-script.js';
import { API, eventually, post } from '../_shared/test-helpers.js';
import './console.js';
import './help-center.js';
import './orders.js';
import './services.js';

const CONSOLE = 'http://127.0.0.1:3002';

const settled = (id: string) => eventually(async () => { const t = await post(`${API}/getTicket`, { id }); return t.status !== 'new' && t; });
const call = (id: string, name: string, args: object) => ({ text: '', toolCalls: [{ id, name, arguments: args }] });

const card = { title: 'Order A-1042', subtitle: 'brake pads, bell', status: 'success', body: 'Shipped on 2 May.' };

/** The desk assistant looks up the order, shows it as a card, and says one sentence. */
const showsOrder = (ticketId: string) => (request: AIChatRequest) => {
    const done = request.messages.filter((message) => message.role === 'tool').length;
    if (done === 0) return call('desk-1', 'order_of_ticket', { ticketId, number: 'A-1042' });
    if (done === 1) return call('desk-2', 'show_card', card);
    return 'The order has shipped.';
};

/** The colleague asks for a return label: the assistant calls the tool, which waits for a yes. */
const sendsLabel = (ticketId: string) => (request: AIChatRequest) => {
    const done = request.messages.filter((message) => message.role === 'tool').length;
    if (done === 0) return call('desk-1', 'send_return_label', { ticketId });
    return JSON.stringify(request.messages.at(-1)?.content).includes('interactionRequired') ? 'I need your confirmation to send the label.' : 'The return label is on its way.';
};

/** What a frontend sends to the agent, and the events it gets back as server-sent events. */
async function agui(body: Record<string, unknown>): Promise<Array<Record<string, any>>> {
    const response = await fetch(`${CONSOLE}/desk-assistant`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ threadId: 'thread-1', ...body })
    });
    assert.equal(response.status, 200);
    return (await response.text()).split('\n').filter((line) => line.startsWith('data:')).map((line) => JSON.parse(line.slice(5)));
}

/** One AG-UI run: a message of the colleague, and what the console knows as state. */
const aguiRun = (message: string, state: Record<string, unknown>) =>
    agui({ runId: 'run-1', state, messages: [{ id: 'm1', role: 'user', content: message }] });

describe('Step 31: a console for the team', () => {
    let id: string;

    before(async () => {
        await runOffline('./steps/31-a-console/intelligence.yml');
        await post(`${API}/orders/seedOrders`);
        ScriptedAI.reset(triageScript());
        id = (await post(`${API}/createTicket`, { email: 'ada@example.com', subject: 'Order', body: 'Where is my order A-1042?' })).id;
        await settled(id);
    });
    after(() => Platform.shutdown());
    beforeEach(() => ScriptedAI.reset(showsOrder(id)));

    test('an AG-UI run is a stream of protocol events: started, tool calls, text, finished', async () => {
        const events = await aguiRun('Where is the order of this ticket?', { ticketId: id });

        const types = events.map((event) => event.type);
        assert.equal(types[0], 'RUN_STARTED');
        assert.equal(types.at(-1), 'RUN_FINISHED');
        assert.deepEqual(events.filter((event) => event.type === 'TOOL_CALL_START').map((event) => event.toolCallName), ['order_of_ticket', 'show_card']);
        assert.equal(events.filter((event) => event.type === 'TEXT_MESSAGE_CONTENT').map((event) => event.delta).join(''), 'The order has shipped.');
    });

    test('a UI tool hands its specification to the frontend: the card arrives as the arguments of show_card', async () => {
        const events = await aguiRun('Where is the order of this ticket?', { ticketId: id });

        const shown = events.find((event) => event.type === 'TOOL_CALL_START' && event.toolCallName === 'show_card')!;
        const args = events.find((event) => event.type === 'TOOL_CALL_ARGS' && event.toolCallId === shown.toolCallId)!;
        assert.deepEqual(JSON.parse(args.delta), card);
        // A UI tool returns what it was given: the model sees that the card was shown.
        const result = events.find((event) => event.type === 'TOOL_CALL_RESULT' && event.toolCallId === shown.toolCallId)!;
        assert.deepEqual(JSON.parse(result.content), card);
    });

    test('an action waits for a yes in the console: the run ends with an interrupt, and the answer continues it', async () => {
        ScriptedAI.reset(sendsLabel(id));
        const events = await aguiRun('Send the customer a return label.', { ticketId: id });

        // The run didn't fail and didn't finish: it stopped on a question, with what it wants to do.
        const { outcome } = events.at(-1)!;
        assert.equal(outcome.type, 'interrupt');
        const [interrupt] = outcome.interrupts;
        assert.equal(interrupt.reason, 'tool_confirmation');
        assert.deepEqual([interrupt.metadata.tool, interrupt.metadata.arguments], ['send_return_label', { ticketId: id }]);
        assert.deepEqual(await post(`${API}/returnLabel`, { ticketId: id }), { sent: false });

        // The colleague clicks yes. The console answers the interrupt by its id, and the same run goes on.
        const resumed = await agui({ runId: 'run-2', resume: [{ interruptId: interrupt.id, status: 'resolved' }] });
        assert.equal(resumed.at(-1)!.outcome.type, 'success');
        assert.equal(resumed.at(-1)!.result.runId, interrupt.metadata.agentRunId);
        assert.equal(resumed.filter((event) => event.type === 'TEXT_MESSAGE_CONTENT').map((event) => event.delta).join(''), 'The return label is on its way.');
        assert.deepEqual(await post(`${API}/returnLabel`, { ticketId: id }), { sent: true });

        // An interrupt is answered once.
        const again = await agui({ runId: 'run-3', resume: [{ interruptId: interrupt.id, status: 'resolved' }] });
        assert.equal(again.at(-1)!.type, 'RUN_ERROR');
    });

    test('a no stops the run, and nothing is sent', async () => {
        const other = (await post(`${API}/createTicket`, { email: 'bob@example.com', subject: 'Return', body: 'I want to return my helmet.' })).id;
        ScriptedAI.reset(triageScript());
        await settled(other);
        ScriptedAI.reset(sendsLabel(other));
        const events = await aguiRun('Send the customer a return label.', { ticketId: other });
        const [interrupt] = events.at(-1)!.outcome.interrupts;

        const declined = await agui({ runId: 'run-2', resume: [{ interruptId: interrupt.id, status: 'cancelled' }] });
        assert.equal(declined.at(-1)!.outcome.type, 'cancelled');
        assert.deepEqual(await post(`${API}/returnLabel`, { ticketId: other }), { sent: false });
    });

    test('what the frontend knows reaches the model as context: the ticket on screen', async () => {
        await aguiRun('Where is the order of this ticket?', { ticketId: id });

        const [request] = ScriptedAI.requests;
        assert.match(JSON.stringify(request.inputs), new RegExp(id));
        assert.match(JSON.stringify(request.inputs), /Where is the order of this ticket\?/);
        // Its tools: reading the case, asking the policy advisor, the three things it may show, and one action, which waits for a yes.
        assert.deepEqual(request.tools?.map((tool) => tool.name).sort(), [
            'ask_policy_advisor', 'chat_of_ticket', 'order_of_ticket', 'send_return_label', 'show_callout', 'show_card', 'show_key_value_list'
        ]);
    });

    test('the help center is an MCP server: it offers the marked tool, and nothing else of the service', async () => {
        const server = Platform.runtime().get<Mcps>('mcps').mcps.find((mcp) => mcp.configuration.name === 'help-center')!;

        const tools = server.toolDefinitions() as Array<{ name: string; description: string }>;
        assert.deepEqual(tools.map((tool) => tool.name), ['search_help_center']);
        assert.match(tools[0].description, /Search the Velo help center/);
    });

    test('the same agent has run routes and a card over HTTP', async () => {
        const found = await (await fetch(`${CONSOLE}/agents/desk-assistant/card`)).json();
        assert.equal(found.name, 'Desk Assistant');
        assert.deepEqual(found.skills.map((skill: any) => skill.id), ['case-research', 'case-actions', 'console-ui']);
        assert.equal(found.capabilities.streaming, true);

        const run = await post(`${CONSOLE}/agents/desk-assistant/runs`, { task: 'Where is the order of this ticket?', context: { state: { ticketId: id } } });
        assert.equal(run.status, 'completed');
        assert.equal(run.text, 'The order has shipped.');

        assert.deepEqual((await post(`${API}/team`)).map((colleague: any) => colleague.agent).sort(), ['desk-assistant', 'policy-advisor']);
    });
});

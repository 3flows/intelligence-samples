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

/** One AG-UI run: what a frontend sends, and the events it gets back as server-sent events. */
async function aguiRun(message: string, state: Record<string, unknown>): Promise<Array<Record<string, any>>> {
    const response = await fetch(`${CONSOLE}/desk-assistant`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ threadId: 'thread-1', runId: 'run-1', state, messages: [{ id: 'm1', role: 'user', content: message }] })
    });
    assert.equal(response.status, 200);
    return (await response.text()).split('\n').filter((line) => line.startsWith('data:')).map((line) => JSON.parse(line.slice(5)));
}

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

    test('a UI tool hands its specification to the frontend: the card arrives as the result of show_card', async () => {
        const events = await aguiRun('Where is the order of this ticket?', { ticketId: id });

        const shown = events.find((event) => event.type === 'TOOL_CALL_START' && event.toolCallName === 'show_card')!;
        const result = events.find((event) => event.type === 'TOOL_CALL_RESULT' && event.toolCallId === shown.toolCallId)!;
        assert.deepEqual(JSON.parse(result.content), card);
    });

    test('what the frontend knows reaches the model as context: the ticket on screen', async () => {
        await aguiRun('Where is the order of this ticket?', { ticketId: id });

        const [request] = ScriptedAI.requests;
        assert.match(JSON.stringify(request.inputs), new RegExp(id));
        assert.match(JSON.stringify(request.inputs), /Where is the order of this ticket\?/);
        // Its tools: reading the case, asking the policy advisor, and the three things it may show. Nothing that acts.
        assert.deepEqual(request.tools?.map((tool) => tool.name).sort(), [
            'ask_policy_advisor', 'chat_of_ticket', 'order_of_ticket', 'show_callout', 'show_card', 'show_key_value_list'
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
        assert.deepEqual(found.skills.map((skill: any) => skill.id), ['case-research', 'console-ui']);
        assert.equal(found.capabilities.streaming, true);

        const run = await post(`${CONSOLE}/agents/desk-assistant/runs`, { task: 'Where is the order of this ticket?', context: { state: { ticketId: id } } });
        assert.equal(run.status, 'completed');
        assert.equal(run.text, 'The order has shipped.');

        assert.deepEqual((await post(`${API}/team`)).map((colleague: any) => colleague.agent).sort(), ['desk-assistant', 'policy-advisor']);
    });
});

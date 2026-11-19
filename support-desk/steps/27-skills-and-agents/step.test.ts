import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { after, before, describe, test } from 'node:test';
import { Platform } from '@3flows/platform';
import { AIChatRequest, IntelligenceAgentDomain, IntelligenceTraceDomain } from '@3flows/intelligence';
import { runOffline } from '../_shared/offline.js';
import { ScriptedAI } from '../_shared/scripted-ai.js';
import { triageScript } from '../_shared/triage-script.js';
import { API, eventually, post } from '../_shared/test-helpers.js';
import './help-center.js';
import './orders.js';
import './services.js';

const { articles } = JSON.parse(await readFile('./steps/27-skills-and-agents/articles.json', 'utf8'));

const safe = { 'payment-details': { value: false, confidence: 0.9, reason: null }, promises: { value: false, confidence: 0.9, reason: null }, grounded: { value: true, confidence: 0.9, reason: null } };
const settled = (id: string) => eventually(async () => { const t = await post(`${API}/getTicket`, { id }); return t.status !== 'new' && t; });

/** The agent works in rounds: one tool per round, then the brief. */
const researches = (ticketId: string, order: string) => (request: AIChatRequest) => {
    const done = request.messages.filter((message) => message.role === 'tool').length;
    const call = (name: string, args: object) => ({ text: '', toolCalls: [{ id: `call-${done}`, name, arguments: args }] });
    if (done === 0) return call('chat_of_ticket', { ticketId });
    if (done === 1) return call('order_of_ticket', { ticketId, number: order });
    if (done === 2) return call('search_help_center', { query: 'wrong part delivered' });
    return 'Wants the right brake pads. Order A-1042 shipped (order_of_ticket). Suggest: send a return label.';
};

const toolResults = () => ScriptedAI.requests.at(-1)!.messages.filter((message) => message.role === 'tool').map((message) => JSON.parse(String(message.content)));

describe('Step 27: skills and agents', () => {
    let id: string;

    before(async () => {
        await runOffline('./steps/27-skills-and-agents/intelligence.yml');
        await post(`${API}/help-center/importArticles`, { articles });
        await post(`${API}/orders/seedOrders`);
        ScriptedAI.reset(triageScript(safe, 'Which brake is it?'));
        id = (await post(`${API}/createTicket`, { email: 'ada@example.com', subject: 'Brake pads', body: 'The pads from A-1042 do not fit.' })).id;
        await settled(id);
        await post(`${API}/chat`, { ticketId: id, message: 'The pads do not fit.' });
    });
    after(() => Platform.shutdown());

    test('the agent works with its own instructions, those of its skill, and exactly the skill’s tools', async () => {
        ScriptedAI.reset(researches(id, 'A-1042'));
        await post(`${API}/prepareCase`, { ticketId: id });

        const [request] = ScriptedAI.requests;
        assert.match(String(request.instructions), /brief for a support colleague/);
        assert.match(String(request.instructions), /Read the chat of the ticket first/);
        assert.deepEqual(request.tools?.map((tool) => tool.name).sort(), ['chat_of_ticket', 'order_of_ticket', 'search_help_center']);
        assert.match(JSON.stringify(request.inputs), /Prepare a brief for the colleague/);
    });

    test('one run: three tool calls, then the brief, stored for the person who takes over', async () => {
        ScriptedAI.reset(researches(id, 'A-1042'));
        const brief = await post(`${API}/prepareCase`, { ticketId: id });

        assert.equal(brief.status, 'completed');
        assert.match(brief.text, /Wants the right brake pads/);
        const [chat, order, passages] = toolResults();
        assert.deepEqual(chat.map((turn: any) => turn.content), ['The pads do not fit.', 'Which brake is it?']);
        assert.equal(order.number, 'A-1042');
        assert.ok(passages.length > 0);
        assert.deepEqual(brief.steps, ['chat_of_ticket', 'order_of_ticket', 'search_help_center']);
    });

    test('the tools are scoped by the ticket: another customer’s order stays hidden from the agent', async () => {
        ScriptedAI.reset(researches(id, 'A-1043'));
        await post(`${API}/prepareCase`, { ticketId: id });

        assert.equal(toolResults()[1], null);
    });

    test('the run is a record of the agent domain, and goes when the ticket is closed', async () => {
        ScriptedAI.reset(researches(id, 'A-1042'));
        const { runId } = await post(`${API}/prepareCase`, { ticketId: id });
        const run = await IntelligenceAgentDomain.AgentRun.find({ runId }).next();
        assert.equal(run!.data.status, 'completed');
        // The agent's model calls are traced under its run: four rounds, four calls.
        const calls = () => IntelligenceTraceDomain.InferenceRun.find({ subjectType: 'agent-run', subjectId: runId }).count();
        assert.ok((await calls()) > 0);
        assert.equal(await IntelligenceAgentDomain.AgentRun.find({}).count(), 1);   // earlier briefs took their runs with them

        await post(`${API}/closeTicket`, { ticketId: id });

        assert.equal(await IntelligenceAgentDomain.AgentRun.find({ runId }).next(), undefined);
        assert.equal(await calls(), 0);
    });
});

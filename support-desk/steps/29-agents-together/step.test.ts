import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { after, before, describe, test } from 'node:test';
import { Platform } from '@3flows/platform';
import { AIChatRequest, IntelligenceAgentDomain } from '@3flows/intelligence';
import { runOffline } from '../_shared/offline.js';
import { ScriptedAI } from '../_shared/scripted-ai.js';
import { triageScript } from '../_shared/triage-script.js';
import { API, eventually, post } from '../_shared/test-helpers.js';
import './help-center.js';
import './orders.js';
import './services.js';

const { articles } = JSON.parse(await readFile('./steps/29-agents-together/articles.json', 'utf8'));

const settled = (id: string) => eventually(async () => { const t = await post(`${API}/getTicket`, { id }); return t.status !== 'new' && t; });

const toolNames = (request: AIChatRequest) => (request.tools ?? []).map((tool) => tool.name).sort();
const isAdvisor = (request: AIChatRequest) => toolNames(request).includes('search_help_center');
const call = (id: string, name: string, args: object) => ({ text: '', toolCalls: [{ id, name, arguments: args }] });

/** Two agents, one scripted model: the researcher reads the chat and asks the advisor; the advisor searches and answers. */
const team = (ticketId: string) => (request: AIChatRequest) => {
    const done = request.messages.filter((message) => message.role === 'tool').length;
    if (isAdvisor(request)) {
        return done === 0
            ? call('advisor-1', 'search_help_center', { query: 'return wrong part' })
            : 'Unused parts can be returned within 30 days of delivery (Returns and refunds).';
    }
    if (done === 0) return call('researcher-1', 'chat_of_ticket', { ticketId });
    if (done === 1) return call('researcher-2', 'ask_policy_advisor', { task: 'What is the rule for returning a part that does not fit?' });
    return 'Wants to return brake pads that do not fit. Returns are possible within 30 days (policy advisor). Suggest: send a return label.';
};

describe('Step 29: agents that work together', () => {
    let id: string;

    before(async () => {
        await runOffline('./steps/29-agents-together/intelligence.yml');
        await post(`${API}/help-center/importArticles`, { articles });
        ScriptedAI.reset(triageScript());
        id = (await post(`${API}/createTicket`, { email: 'ada@example.com', subject: 'Brake pads', body: 'The pads do not fit. Can I return them?' })).id;
        await settled(id);
    });
    after(() => Platform.shutdown());

    test('each agent has its own tools: the researcher asks, only the advisor searches the help center', async () => {
        ScriptedAI.reset(team(id));
        await post(`${API}/prepareCase`, { ticketId: id });

        const researcher = ScriptedAI.requests.find((request) => !isAdvisor(request))!;
        const advisor = ScriptedAI.requests.find(isAdvisor)!;
        assert.deepEqual(toolNames(researcher), ['ask_policy_advisor', 'chat_of_ticket', 'order_of_ticket']);
        assert.deepEqual(toolNames(advisor), ['search_help_center']);
        assert.match(String(advisor.instructions), /answer a colleague's question/);
    });

    test('the advisor works inside the researcher’s run, and its answer comes back as a tool result', async () => {
        ScriptedAI.reset(team(id));
        const brief = await post(`${API}/prepareCase`, { ticketId: id });

        assert.equal(brief.status, 'completed');
        assert.deepEqual(brief.steps, ['chat_of_ticket', 'ask_policy_advisor']);
        // The advisor got the question, not the ticket.
        const advisor = ScriptedAI.requests.find(isAdvisor)!;
        assert.match(JSON.stringify(advisor.inputs), /rule for returning a part that does not fit/);
        assert.doesNotMatch(JSON.stringify(advisor.inputs), /ada@example\.com/);
        // The researcher got the advisor's answer.
        const last = ScriptedAI.requests.filter((request) => !isAdvisor(request)).at(-1)!;
        assert.match(String(last.messages.at(-1)!.content), /within 30 days of delivery/);
    });

    test('agents are found by their cards: by listing them, or by what they can do', async () => {
        const all = await post(`${API}/team`);
        assert.deepEqual(all.map((colleague: any) => colleague.agent), ['policy-advisor']);   // only the discoverable one
        assert.equal(all[0].name, 'Policy Advisor');
        assert.deepEqual(all[0].skills, ['policy-research']);

        assert.deepEqual((await post(`${API}/team`, { capability: 'warranty' })).map((c: any) => c.agent), ['policy-advisor']);
        assert.deepEqual(await post(`${API}/team`, { capability: 'flight-search' }), []);
    });

    test('a delegation is a record; closing the ticket deletes both runs', async () => {
        ScriptedAI.reset(team(id));
        const { runId } = await post(`${API}/prepareCase`, { ticketId: id });
        const { AgentRun, AgentDelegation } = IntelligenceAgentDomain;
        const run = await AgentRun.find({ runId }).next();
        const [delegation] = await AgentDelegation.find({ parentRun: run!.reference() }).all();
        assert.equal(delegation.data.status, 'completed');
        assert.equal(await AgentRun.find({}).count(), 2);

        await post(`${API}/closeTicket`, { ticketId: id });

        assert.equal(await AgentRun.find({}).count(), 0);
        assert.equal(await AgentDelegation.find({}).count(), 0);
    });
});

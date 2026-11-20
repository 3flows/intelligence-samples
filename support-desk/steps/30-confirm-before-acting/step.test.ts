import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { after, before, beforeEach, describe, test } from 'node:test';
import { Platform } from '@3flows/platform';
import { AIChatRequest } from '@3flows/intelligence';
import { runOffline } from '../_shared/offline.js';
import { ScriptedAI } from '../_shared/scripted-ai.js';
import { triageScript } from '../_shared/triage-script.js';
import { API, eventually, post } from '../_shared/test-helpers.js';
import './help-center.js';
import './orders.js';
import './services.js';

const { articles } = JSON.parse(await readFile('./steps/30-confirm-before-acting/articles.json', 'utf8'));

const settled = (id: string) => eventually(async () => { const t = await post(`${API}/getTicket`, { id }); return t.status !== 'new' && t; });
const toolNames = (request: AIChatRequest) => (request.tools ?? []).map((tool) => tool.name).sort();
const isAdvisor = (request: AIChatRequest) => toolNames(request).includes('search_help_center');
const call = (id: string, name: string, args: object) => ({ text: '', toolCalls: [{ id, name, arguments: args }] });
const lastToolResult = (request: AIChatRequest) => JSON.parse(String(request.messages.filter((message) => message.role === 'tool').at(-1)!.content));

/** The researcher asks the advisor, then wants to send a return label. What it writes depends on what the tool answered. */
const team = (ticketId: string) => (request: AIChatRequest) => {
    const done = request.messages.filter((message) => message.role === 'tool').length;
    if (isAdvisor(request)) return 'Unused parts can be returned within 30 days of delivery (Returns and refunds).';
    if (done === 0) return call('researcher-1', 'ask_policy_advisor', { task: 'May the customer return a part that does not fit?' });
    if (done === 1) return call('researcher-2', 'send_return_label', { ticketId });
    return lastToolResult(request).sent ? 'Return allowed. Label sent.' : 'Return allowed. A return label is ready to be sent.';
};

describe('Step 30: confirm before acting', () => {
    let id: string;
    const label = () => post(`${API}/returnLabel`, { ticketId: id });

    before(async () => {
        await runOffline('./steps/30-confirm-before-acting/intelligence.yml');
        await post(`${API}/help-center/importArticles`, { articles });
    });
    after(() => Platform.shutdown());
    beforeEach(async () => {
        ScriptedAI.reset(triageScript());
        id = (await post(`${API}/createTicket`, { email: 'ada@example.com', subject: 'Brake pads', body: 'The pads do not fit. Can I return them?' })).id;
        await settled(id);
        ScriptedAI.reset(team(id));
    });

    test('the agent may ask for the label, but the tool does not run: the run waits', async () => {
        const brief = await post(`${API}/prepareCase`, { ticketId: id });

        assert.equal(brief.status, 'waiting');
        assert.deepEqual(brief.waitingFor, [{ tool: 'send_return_label', arguments: { ticketId: id } }]);
        assert.deepEqual(await label(), { sent: false });
        // The model was told why nothing happened, and wrote its brief accordingly.
        const last = ScriptedAI.requests.filter((request) => !isAdvisor(request)).at(-1)!;
        assert.equal(lastToolResult(last).interactionRequired, true);
        assert.equal(brief.text, 'Return allowed. A return label is ready to be sent.');
    });

    test('yes: the run goes on, the tool runs, and the brief says so', async () => {
        await post(`${API}/prepareCase`, { ticketId: id });

        const brief = await post(`${API}/decideCase`, { ticketId: id, approve: true });

        assert.equal(brief.status, 'completed');
        assert.deepEqual(brief.waitingFor, []);
        assert.equal(brief.text, 'Return allowed. Label sent.');
        assert.deepEqual(await label(), { sent: true });
    });

    test('no: the run is stopped, and nothing is sent', async () => {
        await post(`${API}/prepareCase`, { ticketId: id });

        const brief = await post(`${API}/decideCase`, { ticketId: id, approve: false });

        assert.equal(brief.status, 'stopped');
        assert.deepEqual(await label(), { sent: false });
    });

    test('a decision is only possible while the run waits', async () => {
        await post(`${API}/prepareCase`, { ticketId: id });
        await post(`${API}/decideCase`, { ticketId: id, approve: true });

        await assert.rejects(post(`${API}/decideCase`, { ticketId: id, approve: true }), /isn't waiting for a decision/);
    });
});

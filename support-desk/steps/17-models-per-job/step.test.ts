import assert from 'node:assert/strict';
import { after, before, beforeEach, describe, test } from 'node:test';
import { Platform } from '@3flows/platform';
import { Intelligence } from '@3flows/intelligence';
import { runOffline } from '../_shared/offline.js';
import { ScriptedAI } from '../_shared/scripted-ai.js';
import { triageScript } from '../_shared/triage-script.js';
import { eventually, post } from '../_shared/test-helpers.js';
import './help-center.js';
import './orders.js';
import './services.js';

describe('Step 17: the right model for each job', () => {
    before(() => runOffline('./steps/17-models-per-job/intelligence.yml'));
    after(() => Platform.shutdown());
    beforeEach(() => ScriptedAI.reset());

    test('each job has its own AI and defaults', () => {
        const ai = Intelligence.inference();
        assert.equal(ai.ai('DEFAULT').configuration.model, 'gpt-4.1');
        assert.equal(ai.ai('triage').configuration.model, 'gpt-4.1-nano');
        assert.equal(ai.ai('triage').configuration.defaults?.temperature, 0);
    });

    test('triage runs on the triage AI, the chat on DEFAULT', async () => {
        ScriptedAI.reset(triageScript());
        const { id } = await post('http://127.0.0.1:3000/createTicket', { email: 'ada@example.com', subject: 'Pads', body: 'The pads do not fit.' });
        await eventually(async () => (await post('http://127.0.0.1:3000/getTicket', { id })).status === 'triaged');

        assert.equal(ScriptedAI.requests.length, 5);
        assert.ok(ScriptedAI.requests.every((request) => request.ai === 'triage'));

        ScriptedAI.reset();
        await post('http://127.0.0.1:3000/chat', { ticketId: id, message: 'Hi' });
        assert.deepEqual(ScriptedAI.requests.map((request) => request.ai), ['DEFAULT']);
    });
});

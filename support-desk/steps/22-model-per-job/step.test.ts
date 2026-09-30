import assert from 'node:assert/strict';
import { after, before, beforeEach, describe, test } from 'node:test';
import { Platform } from '@3flows/platform';
import { runOffline } from '../_shared/offline.js';
import { ScriptedAI } from '../_shared/scripted-ai.js';
import { triageScript } from '../_shared/triage-script.js';
import { eventually, post } from '../_shared/test-helpers.js';
import './help-center.js';
import './orders.js';
import './services.js';

const safe = { 'payment-details': { value: false, confidence: 0.9, reason: null }, promises: { value: false, confidence: 0.9, reason: null }, grounded: { value: true, confidence: 0.9, reason: null } };
const createTicket = (body = 'The pads do not fit.') => post('http://127.0.0.1:3000/createTicket', { email: 'ada@example.com', subject: 'Pads', body });
const getTicket = (id: string) => post('http://127.0.0.1:3000/getTicket', { id });
const settled = (id: string) => eventually(async () => { const t = await getTicket(id); return t.status !== 'new' && t; });

import { Intelligence } from '@3flows/intelligence';

describe('Step 22: the right model for each job', () => {
    before(() => runOffline('./steps/22-model-per-job/intelligence.yml'));
    after(() => Platform.shutdown());
    beforeEach(() => ScriptedAI.reset(triageScript(safe, 'Happy to help.')));

    test('each job has its own AI and defaults', () => {
        const ai = Intelligence.inference();
        assert.equal(ai.ai('DEFAULT').configuration.model, 'gpt-4.1');
        assert.equal(ai.ai('triage').configuration.model, 'gpt-4.1-nano');
        assert.equal(ai.ai('triage').configuration.defaults?.temperature, 0);
    });

    test('triage, checks and judges run on the triage AI; only the reply runs on DEFAULT', async () => {
        const { id } = await createTicket();
        assert.equal(ScriptedAI.requests.length, 5);
        assert.ok(ScriptedAI.requests.every((request) => request.ai === 'triage'));

        ScriptedAI.reset(triageScript(safe, 'Happy to help.'));
        await post('http://127.0.0.1:3000/chat', { ticketId: id, message: 'Which pads do I need?' });

        const byAi = ScriptedAI.requests.map((r) => `${r.responseSchemaName ?? 'reply'}@${r.ai}`).sort();
        assert.deepEqual(byAi, ['grounded@triage', 'payment-details@triage', 'promises@triage', 'reply@DEFAULT']);
    });
});

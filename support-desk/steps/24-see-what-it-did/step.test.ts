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

describe('Step 24: see what it did', () => {
    let id: string;

    before(async () => {
        await runOffline('./steps/24-see-what-it-did/intelligence.yml');
        ScriptedAI.reset(triageScript(safe, 'Happy to help.'));
        id = (await createTicket()).id;
        await settled(id);
        await post('http://127.0.0.1:3000/chat', { ticketId: id, message: 'Which pads do I need?' });
    });
    after(() => Platform.shutdown());

    test('every model call of the ticket is counted, by job', async () => {
        const usage = await post('http://127.0.0.1:3000/ticketUsage', { ticketId: id });

        // 5 triage questions; moderation (no tokens), payment check, promises check, grounded judge; 1 reply. 12 tokens each.
        assert.equal(usage.byJob.triage, 5 * 12);
        assert.equal(usage.byJob.guardrails, 3 * 12);
        assert.equal(usage.byJob.chat, 12);
    });

    test('explain shows which AI answered, with which prompt version', async () => {
        const runs = await post('http://127.0.0.1:3000/explain', { ticketId: id });

        const chat = runs.find((run: any) => run.job === 'chat');
        assert.equal(chat.ai, 'DEFAULT');
        assert.deepEqual(chat.prompts, [{ name: 'support.chat', version: 'v3' }]);
        assert.ok(runs.filter((run: any) => run.job === 'triage').every((run: any) => run.ai === 'triage'));
    });
});

import assert from 'node:assert/strict';
import { after, before, beforeEach, describe, test } from 'node:test';
import { Platform } from '@3flows/platform';
import { runOffline } from '../_shared/offline.js';
import { ScriptedAI } from '../_shared/scripted-ai.js';
import { triageScript } from '../_shared/triage-script.js';
import { post } from '../_shared/test-helpers.js';
import './help-center.js';
import './orders.js';
import './services.js';

const safe = { 'payment-details': { value: false, confidence: 0.9, reason: null }, promises: { value: false, confidence: 0.9, reason: null }, grounded: { value: true, confidence: 0.9, reason: null } };
const createTicket = () => post('http://127.0.0.1:3000/createTicket', { email: 'ada@example.com', subject: 'Refund', body: 'Where is my refund?' });
const chat = (ticketId: string, message: string) => post('http://127.0.0.1:3000/chat', { ticketId, message });
const getTicket = (id: string) => post('http://127.0.0.1:3000/getTicket', { id });

describe('Step 20: guard the output', () => {
    before(() => runOffline('./steps/20-guard-the-output/intelligence.yml'));
    after(() => Platform.shutdown());
    beforeEach(() => ScriptedAI.reset(triageScript(safe, 'Returns are possible within 30 days.')));

    test('a reply that passes the review is sent', async () => {
        const { id } = await createTicket();

        assert.equal((await chat(id, 'Can I return it?')).answer, 'Returns are possible within 30 days.');
    });

    test('a reply that promises a refund is replaced by the hand-over', async () => {
        const { id } = await createTicket();
        ScriptedAI.reset(triageScript({ ...safe, promises: { value: true, confidence: 0.9, reason: 'Promises a refund by Friday.' } }, 'You will get your refund by Friday!'));

        const { answer } = await chat(id, 'When do I get my money?');

        assert.equal(answer, 'Thanks. A colleague will take it from here.');
        assert.equal((await getTicket(id)).escalation, 'reply-promises');
    });

    test('an ungrounded reply is replaced too, and the judge saw the reply and the sources', async () => {
        const { id } = await createTicket();
        ScriptedAI.reset(triageScript({ ...safe, grounded: { value: false, confidence: 0.9, reason: '60 days is not in the sources.' } }, 'Returns are possible within 60 days.'));

        await chat(id, 'Can I return it?');

        assert.equal((await getTicket(id)).escalation, 'reply-not-grounded');
        const judge = ScriptedAI.requests.find((r) => r.responseSchemaName === 'grounded')!;
        assert.equal(JSON.parse(String(judge.messages[0].content)).state.inputs[0].reply, 'Returns are possible within 60 days.');
    });
});

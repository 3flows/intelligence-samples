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

describe('Step 19: guard the input', () => {
    before(() => runOffline('./steps/19-guard-the-input/intelligence.yml'));
    after(() => Platform.shutdown());
    beforeEach(() => ScriptedAI.reset(triageScript(safe, 'Happy to help.')));

    test('a normal message is answered by the assistant', async () => {
        const { id } = await createTicket();

        assert.equal((await chat(id, 'Where is my refund?')).answer, 'Happy to help.');
        assert.equal((await getTicket(id)).status, 'open');
    });

    test('a flagged message never reaches the assistant', async () => {
        const { id } = await createTicket();
        ScriptedAI.flagged = (text) => text.includes('idiots');
        ScriptedAI.requests = [];

        const { answer } = await chat(id, 'You idiots!');

        assert.equal(answer, 'Thanks. A colleague will take it from here.');
        assert.equal(ScriptedAI.requests.length, 0);
        const ticket = await getTicket(id);
        assert.deepEqual([ticket.status, ticket.escalation], ['needs-human', 'moderation']);
    });

    test('payment details are handed to a person, the assistant never answers', async () => {
        const { id } = await createTicket();
        ScriptedAI.reset(triageScript({ ...safe, 'payment-details': { value: true, confidence: 0.95, reason: 'Asks to change the IBAN.' } }, 'Sure, noted!'));

        const { answer } = await chat(id, 'Please send my refund to my new IBAN DE89 3704 0044 0532 0130 00.');

        assert.equal(answer, 'Thanks. A colleague will take it from here.');
        assert.deepEqual(ScriptedAI.requests.map((r) => r.responseSchemaName), ['payment-details']);
        assert.equal((await getTicket(id)).escalation, 'payment-details');
    });
});

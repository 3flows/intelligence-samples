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

const settled = (id: string) => eventually(async () => {
    const stored = await post('http://127.0.0.1:3000/getTicket', { id });
    return stored.status !== 'new' && stored;
});

const createTicket = () => post('http://127.0.0.1:3000/createTicket', { email: 'ada@example.com', subject: 'Refund', body: 'Where is my refund?' });

describe('Step 18: guardrails', () => {
    before(() => runOffline('./steps/18-guardrails/intelligence.yml'));
    after(() => Platform.shutdown());
    beforeEach(() => ScriptedAI.reset(triageScript({ 'payment-details': { value: false, confidence: 0.9, reason: null } }, 'Happy to help.')));

    test('a normal message is answered by the assistant', async () => {
        const { id } = await createTicket();

        const { answer } = await post('http://127.0.0.1:3000/chat', { ticketId: id, message: 'Where is my refund?' });

        assert.equal(answer, 'Happy to help.');
    });

    test('a flagged message never reaches the assistant', async () => {
        const { id } = await createTicket();
        ScriptedAI.flagged = (text) => text.includes('idiots');
        ScriptedAI.requests = [];

        const { answer } = await post('http://127.0.0.1:3000/chat', { ticketId: id, message: 'You idiots!' });

        assert.equal(answer, 'Thanks. A colleague will take it from here.');
        assert.equal(ScriptedAI.requests.length, 0);
        const ticket = await post('http://127.0.0.1:3000/getTicket', { id });
        assert.equal(ticket.status, 'needs-human');
        assert.equal(ticket.escalation, 'moderation');
    });

    test('payment details are handed to a person', async () => {
        const { id } = await createTicket();
        ScriptedAI.reset(triageScript({ 'payment-details': { value: true, confidence: 0.95, reason: 'Asks to change the IBAN.' } }, 'Sure, noted!'));

        const { answer } = await post('http://127.0.0.1:3000/chat', { ticketId: id, message: 'Please send my refund to my new IBAN DE89 3704 0044 0532 0130 00.' });

        assert.equal(answer, 'Thanks. A colleague will take it from here.');
        assert.ok(!ScriptedAI.requests.some((request) => request.ai === 'DEFAULT'));
        assert.equal((await post('http://127.0.0.1:3000/getTicket', { id })).escalation, 'payment-details');
    });

    test('an unsure routing goes to a person, with the model’s suggestion', async () => {
        ScriptedAI.reset(triageScript({ department: { value: 'billing', confidence: 0.4, reason: 'A loose thing? Unclear.' } }));
        const { id } = await createTicket();

        const ticket = await settled(id);

        assert.equal(ticket.status, 'needs-routing');
        assert.equal(ticket.triage.department, 'billing');
        const general = await post('http://127.0.0.1:3000/generalQueue');
        assert.ok(general.some((t: any) => t.id === id));
    });
});

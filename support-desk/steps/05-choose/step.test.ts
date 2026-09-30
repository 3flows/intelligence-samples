import assert from 'node:assert/strict';
import { after, before, beforeEach, describe, test } from 'node:test';
import { Platform } from '@3flows/platform';
import { runOffline } from '../_shared/offline.js';
import { ScriptedAI } from '../_shared/scripted-ai.js';
import { triageScript } from '../_shared/triage-script.js';
import { post } from '../_shared/test-helpers.js';
import './services.js';

const ticket = { email: 'grace@example.com', subject: 'Wrong part and no invoice', body: 'The brake pads you sent do not fit my bike, and I never got an invoice.' };

describe('Step 05: choose', () => {
    before(() => runOffline('./steps/05-choose/intelligence.yml'));
    after(() => Platform.shutdown());
    beforeEach(() => ScriptedAI.reset(triageScript()));

    test('oneOf: stores the department the model chose, with its reason', async () => {
        ScriptedAI.reset(triageScript({ department: { value: 'billing', confidence: 0.9, reason: 'Missing invoice.' } }));

        const created = await post('http://127.0.0.1:3000/createTicket', ticket);
        const stored = await post('http://127.0.0.1:3000/getTicket', { id: created.id });

        assert.equal(stored.triage.department, 'billing');
        assert.equal(stored.triage.departmentReason, 'Missing invoice.');
    });

    test('oneOf: exactly the three departments are offered, with their descriptions, and no email address is sent', async () => {
        await post('http://127.0.0.1:3000/createTicket', ticket);

        const request = ScriptedAI.requests.find((r) => r.responseSchemaName === 'department')!;
        assert.deepEqual((request.responseSchema as any).shape.value.options, ['billing', 'technical', 'sales']);
        assert.match(JSON.stringify(request.messages), /Payments, invoices, refunds and prices/);
        assert.doesNotMatch(JSON.stringify(request.messages), /grace@example\.com/);
    });

    test('manyOf: every topic is stored and counted, none is a valid answer too', async () => {
        const before = await post('http://127.0.0.1:3000/topicReport');
        ScriptedAI.reset(triageScript({ topics: { value: ['spare-parts', 'invoice'], confidence: 0.8, reason: null } }));
        await post('http://127.0.0.1:3000/createTicket', ticket);
        ScriptedAI.reset(triageScript({ topics: { value: [], confidence: 0.5, reason: null } }));
        const untagged = await post('http://127.0.0.1:3000/createTicket', ticket);

        assert.deepEqual(untagged.triage.topics, []);
        const report = await post('http://127.0.0.1:3000/topicReport');
        assert.equal(report['spare-parts'] - (before['spare-parts'] ?? 0), 1);
        assert.equal(report.invoice - (before.invoice ?? 0), 1);
    });

    test('an answer outside the options is rejected, not stored', async () => {
        ScriptedAI.reset(triageScript({ department: { value: 'marketing', confidence: 0.9, reason: null } }));

        await assert.rejects(post('http://127.0.0.1:3000/createTicket', ticket));
    });
});

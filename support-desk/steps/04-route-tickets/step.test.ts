import assert from 'node:assert/strict';
import { after, before, beforeEach, describe, test } from 'node:test';
import { Platform } from '@3flows/platform';
import { runOffline } from '../_shared/offline.js';
import { ScriptedAI } from '../_shared/scripted-ai.js';
import { post } from '../_shared/test-helpers.js';
import './services.js';

const ticket = { email: 'ada@example.com', subject: 'Charged twice', body: 'I ordered a helmet last week and my card was charged twice.' };

describe('Step 04: route tickets', () => {
    before(() => runOffline('./steps/04-route-tickets/intelligence.yml'));
    after(() => Platform.shutdown());
    beforeEach(() => ScriptedAI.reset());

    test('stores the ticket with the department the model chose', async () => {
        ScriptedAI.reset((request) => request.responseSchemaName === 'department'
            ? { value: 'billing', confidence: 0.9, reason: 'Duplicate charge.' }
            : 'OK');

        const created = await post('http://127.0.0.1:3000/createTicket', ticket);
        const stored = await post('http://127.0.0.1:3000/getTicket', { id: created.id });

        assert.equal(stored.department, 'billing');
        assert.equal(stored.departmentReason, 'Duplicate charge.');
    });

    test('offers exactly the three departments, and sends no email address', async () => {
        ScriptedAI.reset(() => ({ value: 'billing', confidence: 0.9, reason: null }));

        await post('http://127.0.0.1:3000/createTicket', ticket);

        const [request] = ScriptedAI.requests;
        assert.deepEqual((request.responseSchema as any).shape.value.options, ['billing', 'technical', 'sales']);
        assert.doesNotMatch(JSON.stringify(request.messages), /ada@example\.com/);
        assert.match(JSON.stringify(request.messages), /Payments, invoices, refunds and prices/);
    });

    test('an answer outside the options is rejected, not stored', async () => {
        ScriptedAI.reset(() => ({ value: 'marketing', confidence: 0.9, reason: null }));

        await assert.rejects(post('http://127.0.0.1:3000/createTicket', ticket));
    });
});

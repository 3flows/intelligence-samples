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

describe('Step 21: humans in the loop', () => {
    before(() => runOffline('./steps/21-humans-in-the-loop/intelligence.yml'));
    after(() => Platform.shutdown());
    beforeEach(() => ScriptedAI.reset(triageScript(safe)));

    test('a sure routing goes straight to the department', async () => {
        const { id } = await createTicket();

        assert.equal((await getTicket(id)).status, 'open');
    });

    test('an unsure routing waits for a person, with the model’s suggestion', async () => {
        ScriptedAI.reset(triageScript({ department: { value: 'billing', confidence: 0.4, reason: 'A loose thing? Unclear.' } }));
        const { id } = await createTicket();

        const ticket = await getTicket(id);
        assert.equal(ticket.status, 'needs-routing');
        assert.equal(ticket.triage.department, 'billing');
        assert.ok((await post('http://127.0.0.1:3000/generalQueue')).some((t: any) => t.id === id));
    });

    test('the agent’s decision routes the ticket and becomes an evaluation case', async () => {
        ScriptedAI.reset(triageScript({ department: { value: 'billing', confidence: 0.4, reason: null } }));
        const { id } = await createTicket();

        const routed = await post('http://127.0.0.1:3000/routeTicket', { ticketId: id, department: 'technical' });
        assert.deepEqual([routed.status, routed.triage.department], ['open', 'technical']);

        const { cases } = await post('http://127.0.0.1:3000/evaluationCases');
        assert.deepEqual(cases.find((c: any) => c.id === `correction-${id}`), {
            id: `correction-${id}`,
            input: { subject: 'Refund', body: 'Where is my refund?' },
            expected: { department: 'technical' }
        });
    });
});

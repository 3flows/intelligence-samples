import assert from 'node:assert/strict';
import { after, before, beforeEach, describe, test } from 'node:test';
import { Platform } from '@3flows/platform';
import { runOffline } from '../_shared/offline.js';
import { ScriptedAI } from '../_shared/scripted-ai.js';
import { triageScript } from '../_shared/triage-script.js';
import { post } from '../_shared/test-helpers.js';
import './services.js';

const ticket = { email: 'ada@example.com', subject: 'Brake pads do not fit', body: 'Hi, the brake pads from order A-1042 do not fit my Velo City 3. Can you send the right ones?' };

describe('Step 07: extract', () => {
    before(() => runOffline('./steps/07-extract/intelligence.yml'));
    after(() => Platform.shutdown());
    beforeEach(() => ScriptedAI.reset(triageScript()));

    test('stores the extracted facts with the decisions', async () => {
        ScriptedAI.reset(triageScript({ facts: { orderNumber: 'A-1042', product: 'brake pads for Velo City 3', summary: 'Brake pads do not fit.' } }));

        const created = await post('http://127.0.0.1:3000/createTicket', ticket);

        assert.equal(created.triage.orderNumber, 'A-1042');
        assert.equal(created.triage.product, 'brake pads for Velo City 3');
        assert.equal(created.triage.department, 'technical');
    });

    test('missing information stays null', async () => {
        ScriptedAI.reset(triageScript({ facts: { orderNumber: null, product: null, summary: 'Asks about bells.' } }));

        const created = await post('http://127.0.0.1:3000/createTicket', { ...ticket, body: 'Do you sell bells?' });

        assert.equal(created.triage.orderNumber, null);
    });

    test('five named questions, asked about the same text', async () => {
        await post('http://127.0.0.1:3000/createTicket', ticket);

        assert.deepEqual(ScriptedAI.requests.map((r) => r.responseSchemaName).sort(), ['department', 'facts', 'frustration', 'topics', 'urgent']);
        const facts = ScriptedAI.requests.find((r) => r.responseSchemaName === 'facts')!;
        assert.deepEqual(facts.inputs?.[0], { type: 'json', value: { subject: ticket.subject, body: ticket.body } });
    });
});

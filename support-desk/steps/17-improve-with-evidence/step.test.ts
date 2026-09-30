import assert from 'node:assert/strict';
import { after, before, beforeEach, describe, test } from 'node:test';
import { Platform } from '@3flows/platform';
import { runOffline } from '../_shared/offline.js';
import { ScriptedAI } from '../_shared/scripted-ai.js';
import { triageScript } from '../_shared/triage-script.js';
import { post } from '../_shared/test-helpers.js';
import { isOrderNumber } from './triage.js';
import './help-center.js';
import './orders.js';
import './services.js';

const ticket = { email: 'ada@example.com', subject: 'Rattle', body: 'Something at the back of my bike rattles.' };

describe('Step 17: improve with evidence', () => {
    before(() => runOffline('./steps/17-improve-with-evidence/intelligence.yml'));
    after(() => Platform.shutdown());
    beforeEach(() => ScriptedAI.reset(triageScript()));

    test('routing uses the support.routing prompt and the v2 descriptions', async () => {
        await post('http://127.0.0.1:3000/createTicket', ticket);

        const request = ScriptedAI.requests.find((r) => r.responseSchemaName === 'department')!;
        assert.match(String(request.instructions), /A defect, whether the customer wants a repair/);
        assert.match(JSON.stringify(request.messages), /orders already placed: delivery status, cancellations/);
        assert.deepEqual(request.options?.metadata?.prompts, [{ name: 'support.routing', version: 'v1' }]);
    });

    test('an invented order number is dropped by our rule', async () => {
        ScriptedAI.reset(triageScript({ facts: { orderNumber: 'LOOSE_THING_BACK', product: null, summary: 'Rattle.' } }));

        const created = await post('http://127.0.0.1:3000/createTicket', ticket);

        assert.equal(created.triage.orderNumber, null);
        assert.equal(isOrderNumber('A-1042'), true);
        assert.equal(isOrderNumber(''), false);
    });
});

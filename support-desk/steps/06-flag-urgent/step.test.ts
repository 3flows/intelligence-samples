import assert from 'node:assert/strict';
import { after, before, beforeEach, describe, test } from 'node:test';
import { Platform } from '@3flows/platform';
import { runOffline } from '../_shared/offline.js';
import { ScriptedAI } from '../_shared/scripted-ai.js';
import { triageScript } from '../_shared/triage-script.js';
import { post } from '../_shared/test-helpers.js';
import './services.js';

const wheel = { email: 'ada@example.com', subject: 'Wheel not here', body: 'My race is on Saturday and the wheel I ordered still has not arrived!' };
const bell = { email: 'grace@example.com', subject: 'Bells', body: 'Do you sell bells?' };

describe('Step 06: flag urgent tickets', () => {
    before(() => runOffline('./steps/06-flag-urgent/intelligence.yml'));
    after(() => Platform.shutdown());
    beforeEach(() => ScriptedAI.reset());

    test('urgent tickets come first in their department’s queue', async () => {
        ScriptedAI.reset(triageScript({ department: { value: 'sales', confidence: 0.9, reason: null } }));
        await post('http://127.0.0.1:3000/createTicket', bell);

        ScriptedAI.reset(triageScript({
            department: { value: 'sales', confidence: 0.9, reason: null },
            urgent: { value: true, confidence: 0.9, reason: 'Race on Saturday.' }
        }));
        await post('http://127.0.0.1:3000/createTicket', wheel);

        const queue = await post('http://127.0.0.1:3000/queue', { department: 'sales' });
        assert.deepEqual(queue.map((ticket: any) => ticket.subject), ['Wheel not here', 'Bells']);
        assert.equal(queue[0].urgentReason, 'Race on Saturday.');
    });

    test('the question defines urgent in concrete terms', async () => {
        ScriptedAI.reset(triageScript());
        await post('http://127.0.0.1:3000/createTicket', bell);

        const request = ScriptedAI.requests.find((r) => r.responseSchemaName === 'urgent')!;
        assert.match(JSON.stringify(request.messages), /deadline, a safety issue or a bike they cannot ride/);
    });
});

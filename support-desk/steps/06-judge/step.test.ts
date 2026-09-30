import assert from 'node:assert/strict';
import { after, before, beforeEach, describe, test } from 'node:test';
import { Platform } from '@3flows/platform';
import { runOffline } from '../_shared/offline.js';
import { ScriptedAI } from '../_shared/scripted-ai.js';
import { triageScript } from '../_shared/triage-script.js';
import { post } from '../_shared/test-helpers.js';
import './services.js';

const wheel = { email: 'ada@example.com', subject: 'Wheel not here', body: 'My race is on Saturday and the wheel I ordered still has not arrived! Third time I write.' };

describe('Step 06: judge', () => {
    before(() => runOffline('./steps/06-judge/intelligence.yml'));
    after(() => Platform.shutdown());
    beforeEach(() => ScriptedAI.reset(triageScript()));

    test('check and score become a boolean and a number, with reasons', async () => {
        ScriptedAI.reset(triageScript({
            urgent: { value: true, confidence: 0.9, reason: 'Race on Saturday.' },
            frustration: { value: 8, confidence: 0.7, reason: 'Third message.' }
        }));

        const created = await post('http://127.0.0.1:3000/createTicket', wheel);

        assert.equal(created.triage.urgent, true);
        assert.equal(created.triage.urgentReason, 'Race on Saturday.');
        assert.equal(created.triage.frustration, 8);
    });

    test('the check defines urgent in concrete terms', async () => {
        await post('http://127.0.0.1:3000/createTicket', wheel);

        const request = ScriptedAI.requests.find((r) => r.responseSchemaName === 'urgent')!;
        assert.match(JSON.stringify(request.messages), /deadline, a safety issue or a bike they cannot ride/);
    });

    test('the score is sent with its range and anchors', async () => {
        await post('http://127.0.0.1:3000/createTicket', wheel);

        const request = ScriptedAI.requests.find((r) => r.responseSchemaName === 'frustration')!;
        const prompt = JSON.parse(String(request.messages[0].content));
        assert.deepEqual(prompt.criteria, {
            min: 0,
            max: 10,
            criteria: ['0: calm and friendly', '5: annoyed, but patient', '10: angry, feels ignored or threatens to leave']
        });
    });
});

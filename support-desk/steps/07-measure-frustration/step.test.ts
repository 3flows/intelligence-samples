import assert from 'node:assert/strict';
import { after, before, beforeEach, describe, test } from 'node:test';
import { Platform } from '@3flows/platform';
import { runOffline } from '../_shared/offline.js';
import { ScriptedAI } from '../_shared/scripted-ai.js';
import { triageScript } from '../_shared/triage-script.js';
import { post } from '../_shared/test-helpers.js';
import { priorityOf } from './services.js';

const ticket = { email: 'linus@example.com', subject: 'THIRD TIME', body: 'This is the third time I am writing about my derailleur. Nobody answers.' };

describe('Step 07: measure frustration', () => {
    before(() => runOffline('./steps/07-measure-frustration/intelligence.yml'));
    after(() => Platform.shutdown());
    beforeEach(() => ScriptedAI.reset());

    test('priority is our rule: urgent, or frustration of 7 and more', () => {
        assert.equal(priorityOf(false, 6), 'normal');
        assert.equal(priorityOf(false, 7), 'high');
        assert.equal(priorityOf(true, 0), 'high');
    });

    test('a very frustrated customer gets priority high', async () => {
        ScriptedAI.reset(triageScript({ frustration: { value: 9, confidence: 0.8, reason: 'Third message, no answer.' } }));

        const created = await post('http://127.0.0.1:3000/createTicket', ticket);

        assert.equal(created.frustration, 9);
        assert.equal(created.urgent, false);
        assert.equal(created.priority, 'high');
    });

    test('the scale is sent with its range and anchors', async () => {
        ScriptedAI.reset(triageScript());
        await post('http://127.0.0.1:3000/createTicket', ticket);

        const request = ScriptedAI.requests.find((r) => r.responseSchemaName === 'frustration')!;
        const prompt = JSON.parse(String(request.messages[0].content));
        assert.deepEqual(prompt.criteria, {
            min: 0,
            max: 10,
            criteria: ['0: calm and friendly', '5: annoyed, but patient', '10: angry, feels ignored or threatens to leave']
        });
    });
});

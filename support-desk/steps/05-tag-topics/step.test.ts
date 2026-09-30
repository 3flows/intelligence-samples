import assert from 'node:assert/strict';
import { after, before, beforeEach, describe, test } from 'node:test';
import { Platform } from '@3flows/platform';
import { runOffline } from '../_shared/offline.js';
import { ScriptedAI } from '../_shared/scripted-ai.js';
import { triageScript } from '../_shared/triage-script.js';
import { post } from '../_shared/test-helpers.js';
import './services.js';

const ticket = { email: 'grace@example.com', subject: 'Wrong part and no invoice', body: 'The brake pads you sent do not fit my bike, and I never got an invoice.' };

describe('Step 05: tag topics', () => {
    before(() => runOffline('./steps/05-tag-topics/intelligence.yml'));
    after(() => Platform.shutdown());
    beforeEach(() => ScriptedAI.reset());

    test('stores every topic the model found, and counts them', async () => {
        ScriptedAI.reset(triageScript({ topics: { value: ['spare-parts', 'invoice'], confidence: 0.8, reason: null } }));

        const created = await post('http://127.0.0.1:3000/createTicket', ticket);
        assert.deepEqual(created.topics, ['spare-parts', 'invoice']);

        const report = await post('http://127.0.0.1:3000/topicReport');
        assert.equal(report['spare-parts'], 1);
        assert.equal(report.invoice, 1);
    });

    test('no topic at all is a valid answer', async () => {
        ScriptedAI.reset(triageScript({ topics: { value: [], confidence: 0.5, reason: null } }));

        const created = await post('http://127.0.0.1:3000/createTicket', ticket);

        assert.deepEqual(created.topics, []);
    });

    test('the topics offered are exactly the schema’s topics', async () => {
        ScriptedAI.reset(triageScript());
        await post('http://127.0.0.1:3000/createTicket', ticket);

        const request = ScriptedAI.requests.find((r) => r.responseSchemaName === 'topics')!;
        assert.deepEqual((request.responseSchema as any).shape.value.element.options,
            ['delivery', 'refund', 'invoice', 'defect', 'assembly', 'spare-parts', 'product-advice']);
    });
});

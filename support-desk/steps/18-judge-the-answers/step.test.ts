import assert from 'node:assert/strict';
import { after, before, beforeEach, describe, test } from 'node:test';
import { Platform } from '@3flows/platform';
import { Intelligence } from '@3flows/intelligence';
import { runOffline } from '../_shared/offline.js';
import { ScriptedAI } from '../_shared/scripted-ai.js';
import { grounded, tone } from './judges.js';
import './help-center.js';
import './orders.js';
import './services.js';

const context = { inference: () => Intelligence.inference() };

describe('Step 18: judge the answers', () => {
    before(() => runOffline('./steps/18-judge-the-answers/intelligence.yml'));
    after(() => Platform.shutdown());
    beforeEach(() => ScriptedAI.reset());

    test('grounded: the judge gets the reply and exactly the sources it may rely on', async () => {
        ScriptedAI.reset(() => ({ value: false, confidence: 0.9, reason: 'The 60-day period is not in the sources.' }));
        const sources = [{ title: 'Returns and refunds', text: 'You can return any unused item within 30 days of delivery.' }];

        const verdict = await grounded(context, 'You can return it within 60 days.', sources);

        assert.equal(verdict.value, false);
        const [request] = ScriptedAI.requests;
        assert.equal(request.responseSchemaName, 'grounded');
        assert.deepEqual(JSON.parse(String(request.messages[0].content)).state.inputs[0], { reply: 'You can return it within 60 days.', sources });
    });

    test('tone: a score from 1 to 5, with anchors', async () => {
        ScriptedAI.reset(() => ({ value: 5, confidence: 0.8, reason: 'Brief and friendly.' }));

        const verdict = await tone(context, 'Hi Ada, returns are possible within 30 days of delivery.');

        assert.equal(verdict.value, 5);
        const prompt = JSON.parse(String(ScriptedAI.requests[0].messages[0].content));
        assert.equal(prompt.criteria.min, 1);
        assert.equal(prompt.criteria.max, 5);
        assert.match(prompt.criteria.criteria[0], /promises refunds, discounts or delivery dates/);
    });
});

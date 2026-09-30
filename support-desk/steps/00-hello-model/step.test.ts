import assert from 'node:assert/strict';
import { after, before, beforeEach, describe, test } from 'node:test';
import { Platform } from '@3flows/platform';
import { runOffline } from '../_shared/offline.js';
import { ScriptedAI } from '../_shared/scripted-ai.js';
import { post } from '../_shared/test-helpers.js';
import './services.js';

describe('Step 00: hello, model', () => {
    before(() => runOffline('./steps/00-hello-model/intelligence.yml'));
    after(() => Platform.shutdown());
    beforeEach(() => ScriptedAI.reset());

    test('answers with what the model says', async () => {
        ScriptedAI.reset(() => 'Let the brake pads bed in first.');

        const { answer } = await post('http://127.0.0.1:3000/ask', { question: 'My new bike squeaks when I brake.' });

        assert.equal(answer, 'Let the brake pads bed in first.');
    });

    test('sends the question as it is, with no instructions', async () => {
        await post('http://127.0.0.1:3000/ask', { question: 'My new bike squeaks when I brake.' });

        const [request] = ScriptedAI.requests;
        assert.equal(request.instructions, undefined);
        assert.deepEqual(request.inputs, [{ type: 'text', text: 'My new bike squeaks when I brake.' }]);
    });
});

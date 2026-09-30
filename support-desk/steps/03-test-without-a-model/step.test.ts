import assert from 'node:assert/strict';
import { after, before, beforeEach, describe, test } from 'node:test';
import { Platform } from '@3flows/platform';
import { post } from '../_shared/test-helpers.js';
import { runOffline } from '../_shared/offline.js';
import { ScriptedAI } from '../_shared/scripted-ai.js';
import './services.js';

describe('Step 03: test without a model', () => {
    before(() => runOffline('./steps/03-test-without-a-model/intelligence.yml'));
    after(() => Platform.shutdown());
    beforeEach(() => ScriptedAI.reset());

    test('returns the model’s draft as the reply', async () => {
        ScriptedAI.reset(() => 'Hi Ada, a little squeaking is normal.');

        const { reply } = await post('http://127.0.0.1:3000/draftReply', ticket);

        assert.equal(reply, 'Hi Ada, a little squeaking is normal.');
    });

    test('uses the support.reply prompt, rendered for Velo', async () => {
        await post('http://127.0.0.1:3000/draftReply', ticket);

        const [request] = ScriptedAI.requests;
        assert.match(String(request.instructions), /support team of Velo, a bike shop/);
    });

    test('sends the ticket as input, not as instructions', async () => {
        await post('http://127.0.0.1:3000/draftReply', ticket);

        const [request] = ScriptedAI.requests;
        assert.deepEqual(request.inputs?.[0], { type: 'json', value: ticket });
        assert.doesNotMatch(String(request.instructions), /squeak/);
    });

    test('a failing model call is an error of the handler, not a crash', async () => {
        ScriptedAI.reset(() => { throw new Error('rate limited'); });

        await assert.rejects(post('http://127.0.0.1:3000/draftReply', ticket), /failed with 5\d\d/);
    });
});

const ticket = { email: 'ada@example.com', subject: 'Brakes squeak', body: 'My new bike squeaks when I brake.' };

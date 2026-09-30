import assert from 'node:assert/strict';
import { after, before, beforeEach, describe, test } from 'node:test';
import { Platform } from '@3flows/platform';
import { runOffline } from '../_shared/offline.js';
import { ScriptedAI } from '../_shared/scripted-ai.js';
import { post } from '../_shared/test-helpers.js';
import './services.js';

const ticket = { email: 'ada@example.com', subject: 'Bremsen quietschen', body: 'Die Bremsen meines neuen Velo City 3 quietschen.' };

describe('Step 03: prompts as configuration', () => {
    before(() => runOffline('./steps/03-prompts-as-configuration/intelligence.yml'));
    after(() => Platform.shutdown());
    beforeEach(() => ScriptedAI.reset());

    test('renders the support.reply prompt with its variables into the instructions', async () => {
        await post('http://127.0.0.1:3000/draftReply', ticket);

        const [instructions] = ScriptedAI.requests[0].instructions as string[];
        assert.match(instructions, /^You draft replies for the support team of Velo, a bike shop\./);
        assert.match(instructions, /Answer in the language of the ticket\./);
        assert.doesNotMatch(instructions, /\{\{/);
    });

    test('records which prompt and version were used', async () => {
        await post('http://127.0.0.1:3000/draftReply', ticket);

        assert.deepEqual(ScriptedAI.requests[0].options?.metadata?.prompts, [{ name: 'support.reply', version: 'v1' }]);
    });
});

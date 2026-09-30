import assert from 'node:assert/strict';
import { after, before, beforeEach, describe, test } from 'node:test';
import { Platform } from '@3flows/platform';
import { Intelligence } from '@3flows/intelligence';
import { runOffline } from '../_shared/offline.js';
import { ScriptedAI } from '../_shared/scripted-ai.js';
import { post } from '../_shared/test-helpers.js';
import './services.js';

const ticket = { email: 'ada@example.com', subject: 'Brakes squeak', body: 'My new Velo City 3 squeaks when I brake.' };

describe('Step 02: anatomy of a call', () => {
    before(() => runOffline('./steps/02-anatomy-of-a-call/intelligence.yml'));
    after(() => Platform.shutdown());
    beforeEach(() => ScriptedAI.reset());

    test('instructions, input and question each have their place', async () => {
        ScriptedAI.reset(() => 'Hi Ada, a little squeaking is normal while new pads bed in.');

        const { reply } = await post('http://127.0.0.1:3000/draftReply', ticket);

        assert.equal(reply, 'Hi Ada, a little squeaking is normal while new pads bed in.');
        const [request] = ScriptedAI.requests;
        assert.deepEqual(request.instructions, [
            'You draft replies for the support team of Velo, a bike shop.',
            'Be brief, friendly and concrete. Never promise refunds or delivery dates.'
        ]);
        assert.deepEqual(request.inputs, [
            { type: 'json', value: ticket },
            { type: 'text', text: 'Draft a reply to this ticket.' }
        ]);
    });

    test('chains are immutable: a shared base never collects input', async () => {
        const base = Intelligence.inference().chat().instructions('Be brief.');

        await base.with('first ticket').ask('Reply.');
        await base.with('second ticket').ask('Reply.');

        assert.deepEqual(ScriptedAI.requests[1].inputs, [
            { type: 'text', text: 'second ticket' },
            { type: 'text', text: 'Reply.' }
        ]);
    });
});

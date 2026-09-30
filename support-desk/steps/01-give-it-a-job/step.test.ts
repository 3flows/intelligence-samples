import assert from 'node:assert/strict';
import { after, before, beforeEach, describe, test } from 'node:test';
import { Platform } from '@3flows/platform';
import { runOffline } from '../_shared/offline.js';
import { ScriptedAI } from '../_shared/scripted-ai.js';
import { post } from '../_shared/test-helpers.js';
import './services.js';

const ticket = { email: 'ada@example.com', subject: 'Brakes squeak', body: 'My new Velo City 3 squeaks when I brake.' };
const other = { email: 'grace@example.com', subject: 'Bell', body: 'Do you sell bells?' };

describe('Step 01: give it a job', () => {
    before(() => runOffline('./steps/01-give-it-a-job/intelligence.yml'));
    after(() => Platform.shutdown());
    beforeEach(() => ScriptedAI.reset());

    test('drafts a reply with the instructions and the ticket', async () => {
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

    test('the shared chain never leaks one ticket into the next call', async () => {
        await post('http://127.0.0.1:3000/draftReply', ticket);
        await post('http://127.0.0.1:3000/draftReply', other);

        const second = ScriptedAI.requests[1];
        assert.deepEqual(second.inputs?.[0], { type: 'json', value: other });
        assert.equal(second.inputs?.length, 2);
    });
});

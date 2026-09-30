import assert from 'node:assert/strict';
import { after, before, beforeEach, describe, test } from 'node:test';
import { Platform } from '@3flows/platform';
import { runOffline } from '../_shared/offline.js';
import { ScriptedAI } from '../_shared/scripted-ai.js';
import { triageScript } from '../_shared/triage-script.js';
import { post } from '../_shared/test-helpers.js';
import './services.js';

describe('Step 10: stream the answer', () => {
    let id: string;

    before(async () => {
        await runOffline('./steps/10-stream/intelligence.yml');
        ScriptedAI.reset(triageScript());
        id = (await post('http://127.0.0.1:3000/createTicket', { email: 'ada@example.com', subject: 'Pads', body: 'Which pads fit?' })).id;
    });
    after(() => Platform.shutdown());
    beforeEach(() => ScriptedAI.reset());

    test('streams the answer as plain text, piece by piece', async () => {
        ScriptedAI.reset(() => 'The Velo City 3 uses resin disc pads, type B01.');

        const response = await fetch('http://127.0.0.1:3000/chat/stream', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ticketId: id, message: 'Which pads do I need for a Velo City 3?' })
        });
        assert.equal(response.headers.get('content-type'), 'text/plain; charset=utf-8');

        const pieces: string[] = [];
        for await (const chunk of response.body!) pieces.push(Buffer.from(chunk).toString('utf8'));
        assert.equal(pieces.join(''), 'The Velo City 3 uses resin disc pads, type B01.');
    });

    test('the streamed turn is part of the conversation', async () => {
        await post('http://127.0.0.1:3000/chat', { ticketId: id, message: 'Thanks!' });

        const [request] = ScriptedAI.requests;
        assert.deepEqual(request.messages.map((m) => m.content), [
            'Which pads do I need for a Velo City 3?',
            'The Velo City 3 uses resin disc pads, type B01.'
        ]);
    });
});

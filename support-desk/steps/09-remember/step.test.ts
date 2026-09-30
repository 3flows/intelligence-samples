import assert from 'node:assert/strict';
import { after, before, beforeEach, describe, test } from 'node:test';
import { Platform } from '@3flows/platform';
import { runOffline } from '../_shared/offline.js';
import { ScriptedAI } from '../_shared/scripted-ai.js';
import { triageScript } from '../_shared/triage-script.js';
import { post } from '../_shared/test-helpers.js';
import './services.js';

const ticket = { email: 'ada@example.com', subject: 'Brake pads', body: 'The pads from A-1042 do not fit my Velo City 3.' };

describe('Step 09: remember the conversation', () => {
    let id: string;

    before(async () => {
        await runOffline('./steps/09-remember/intelligence.yml');
        ScriptedAI.reset(triageScript());
        id = (await post('http://127.0.0.1:3000/createTicket', ticket)).id;
    });
    after(() => Platform.shutdown());
    beforeEach(() => ScriptedAI.reset());

    test('the second turn sees the first', async () => {
        ScriptedAI.reset(() => 'Which brake is it, front or rear?');
        await post('http://127.0.0.1:3000/chat', { ticketId: id, message: 'The brake pads don’t fit.' });

        ScriptedAI.reset(() => 'Thanks, noted: the front brake pads.');
        const { answer } = await post('http://127.0.0.1:3000/chat', { ticketId: id, message: 'It’s the front one.' });

        assert.equal(answer, 'Thanks, noted: the front brake pads.');
        const [request] = ScriptedAI.requests;
        assert.deepEqual(request.messages.map((m) => [m.role, m.content]), [
            ['user', 'The brake pads don’t fit.'],
            ['assistant', 'Which brake is it, front or rear?']
        ]);
    });

    test('the ticket is context on every turn, not history; the prompt is instructions', async () => {
        await post('http://127.0.0.1:3000/chat', { ticketId: id, message: 'Hello?' });

        const [request] = ScriptedAI.requests;
        assert.match(String(request.instructions), /support assistant of Velo/);
        const context = request.inputs?.[0] as { type: 'json'; value: any };
        assert.equal(context.value.subject, 'Brake pads');
        assert.equal(context.value.triage.department, 'technical');
        assert.ok(!request.messages.some((m) => JSON.stringify(m.content).includes('do not fit my Velo City 3')));
    });

    test('the transcript is stored as entities', async () => {
        const transcript = await post('http://127.0.0.1:3000/transcript', { ticketId: id });

        assert.deepEqual(transcript.slice(0, 2), [
            { role: 'user', content: 'The brake pads don’t fit.' },
            { role: 'assistant', content: 'Which brake is it, front or rear?' }
        ]);
    });

    test('another ticket has its own conversation', async () => {
        ScriptedAI.reset(triageScript());
        const other = (await post('http://127.0.0.1:3000/createTicket', { ...ticket, email: 'grace@example.com' })).id;

        ScriptedAI.reset(() => 'Hi!');
        await post('http://127.0.0.1:3000/chat', { ticketId: other, message: 'Hi' });

        assert.deepEqual(ScriptedAI.requests[0].messages, []);
    });
});

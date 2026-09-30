import assert from 'node:assert/strict';
import { after, before, beforeEach, describe, test } from 'node:test';
import { Platform } from '@3flows/platform';
import { runOffline } from '../_shared/offline.js';
import { ScriptedAI } from '../_shared/scripted-ai.js';
import { triageScript } from '../_shared/triage-script.js';
import { post } from '../_shared/test-helpers.js';
import './orders.js';
import './services.js';

const log = '08:12:01 ERR 503 motor sensor timeout';
const ticket = {
    email: 'ada@example.com',
    subject: 'Display error',
    body: 'My e-bike display shows an error, log attached.',
    attachments: [{ name: 'display.log', content: log }]
};

describe('Step 12: documents as context', () => {
    let id: string;

    before(async () => {
        await runOffline('./steps/12-documents-as-context/intelligence.yml');
        ScriptedAI.reset(triageScript());
        id = (await post('http://127.0.0.1:3000/createTicket', ticket)).id;
    });
    after(() => Platform.shutdown());
    beforeEach(() => ScriptedAI.reset());

    test('stores attachment names on the ticket, the files in blobs', async () => {
        const stored = await post('http://127.0.0.1:3000/getTicket', { id });

        assert.deepEqual(stored.attachments, ['display.log']);
        assert.equal(JSON.stringify(stored).includes(log), false);
    });

    test('the extraction reads the attachment as text', async () => {
        ScriptedAI.reset(triageScript());
        await post('http://127.0.0.1:3000/createTicket', ticket);

        const facts = ScriptedAI.requests.find((r) => r.responseSchemaName === 'facts')!;
        assert.deepEqual(facts.inputs?.[1], { type: 'text', text: log });
    });

    test('the chat sees the attachment on every turn', async () => {
        await post('http://127.0.0.1:3000/chat', { ticketId: id, message: 'What does the error mean?' });

        const [request] = ScriptedAI.requests;
        assert.ok(request.inputs?.some((input) => input.type === 'text' && input.text === log));
    });
});

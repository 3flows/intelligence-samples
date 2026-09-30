import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { after, before, beforeEach, describe, test } from 'node:test';
import { Platform } from '@3flows/platform';
import { runOffline } from '../_shared/offline.js';
import { ScriptedAI } from '../_shared/scripted-ai.js';
import { triageScript } from '../_shared/triage-script.js';
import { post } from '../_shared/test-helpers.js';
import './help-center.js';
import './orders.js';
import './services.js';

const { articles } = JSON.parse(await readFile('./steps/15-rag/articles.json', 'utf8'));
const question = 'Returns and refunds\nYou can return any unused item within 30 days of delivery.';

describe('Step 15: answer from the help center', () => {
    let id: string;

    before(async () => {
        await runOffline('./steps/15-rag/intelligence.yml');
        await post('http://127.0.0.1:3000/help-center/importArticles', { articles });
        ScriptedAI.reset(triageScript());
        id = (await post('http://127.0.0.1:3000/createTicket', { email: 'ada@example.com', subject: 'Helmet', body: 'Can I return my helmet?' })).id;
    });
    after(() => Platform.shutdown());
    beforeEach(() => ScriptedAI.reset());

    test('retrieves passages, sends them as context, and returns them as sources', async () => {
        ScriptedAI.reset(() => 'According to “Returns and refunds”, you can return unused items within 30 days.');

        const { answer, sources } = await post('http://127.0.0.1:3000/chat', { ticketId: id, message: question });

        assert.match(answer, /Returns and refunds/);
        assert.equal(sources.length, 4);
        assert.equal(sources[0], 'returns#0');

        const [request] = ScriptedAI.requests;
        const context = request.inputs?.find((input) => input.type === 'json' && 'articles' in (input.value as object)) as { value: { articles: any[] } };
        assert.deepEqual(context.value.articles.map((a) => a.id), sources);
    });

    test('the prompt restricts policy answers to the articles', async () => {
        await post('http://127.0.0.1:3000/chat', { ticketId: id, message: 'Thanks' });

        assert.match(String(ScriptedAI.requests[0].instructions), /only from the articles/);
    });
});

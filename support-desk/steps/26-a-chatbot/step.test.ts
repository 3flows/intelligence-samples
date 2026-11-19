import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { after, before, beforeEach, describe, test } from 'node:test';
import { Platform } from '@3flows/platform';
import { AIChatRequest, Intelligence, IntelligenceChatbotDomain } from '@3flows/intelligence';
import { runOffline } from '../_shared/offline.js';
import { ScriptedAI } from '../_shared/scripted-ai.js';
import { API, post } from '../_shared/test-helpers.js';

const SHOP = 'http://127.0.0.1:3001/shop';
import './help-center.js';
import './orders.js';
import './services.js';

const { articles } = JSON.parse(await readFile('./steps/26-a-chatbot/articles.json', 'utf8'));

/** First round: the model searches the help center. Once the passages are there, it answers. */
const searches = (query: string, answer: string) => (request: AIChatRequest) => request.messages.at(-1)?.role === 'tool'
    ? answer
    : { text: '', toolCalls: [{ id: 'call-1', name: 'search_help_center', arguments: { query } }] };

describe('Step 26: a chatbot', () => {
    let session: string;

    before(async () => {
        await runOffline('./steps/26-a-chatbot/intelligence.yml');
        await post(`${API}/help-center/importArticles`, { articles });
    });
    after(() => Platform.shutdown());
    beforeEach(() => ScriptedAI.reset());

    test('a session starts with the greeting from YAML, without a model call', async () => {
        const started = await post(`${SHOP}/conversation`);
        session = started.conversationId;

        assert.match(started.message, /I'm the Velo assistant/);
        assert.equal(ScriptedAI.requests.length, 0);
    });

    test('the chatbot answers with its prompt, and with the tools of the help center only', async () => {
        ScriptedAI.reset(searches('return policy', 'You can return unused items within 30 days (Returns and refunds).'));

        const answer = await post(`${SHOP}/conversation/${encodeURIComponent(session)}`, { message: 'Can I return a helmet?' });

        assert.equal(answer.message, 'You can return unused items within 30 days (Returns and refunds).');
        const [first, second] = ScriptedAI.requests;
        assert.match(String(first.instructions), /assistant on the website of Velo/);
        assert.deepEqual(first.tools?.map((tool) => tool.name), ['search_help_center']);
        // The second round got passages from the help center as the tool's result.
        const passages = JSON.parse(String(second.messages.at(-1)!.content));
        assert.ok(passages.length > 0 && passages.every((passage: any) => passage.title && passage.text));
    });

    test('the session keeps the history: the next message sees the turn before', async () => {
        ScriptedAI.reset(() => 'Yes, also for accessories.');
        await post(`${SHOP}/conversation/${encodeURIComponent(session)}`, { message: 'Also for a bell?' });

        const [request] = ScriptedAI.requests;
        assert.deepEqual(request.messages.filter((m) => m.role !== 'system').map((m) => [m.role, m.content]).slice(-2), [
            ['user', 'Can I return a helmet?'],
            ['assistant', 'You can return unused items within 30 days (Returns and refunds).']
        ]);
    });

    test('the same chatbot, from code', async () => {
        ScriptedAI.reset(() => 'We ship within two business days.');
        const chatbot = Intelligence.chatbots().chatbot('shop');

        const { conversationId } = await chatbot.session().start();
        const answer = await chatbot.session(conversationId).message().text('How fast do you ship?').send();

        assert.equal(answer.message, 'We ship within two business days.');
    });

    test('sessions and messages are records of the chatbot domain, apart from tickets and chats', async () => {
        const stored = await IntelligenceChatbotDomain.ChatbotSession.find({ sessionId: session }).next();
        const messages = await IntelligenceChatbotDomain.ChatbotMessage.find({ session: stored!.reference() }).limit(0).sort({ timestamp: 1 }).all();

        assert.equal(stored!.data.status, 'open');
        assert.deepEqual(messages.filter((m) => m.data.role === 'user').map((m) => m.data.contentText), ['Can I return a helmet?', 'Also for a bell?']);
    });
});

import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { after, before, describe, test } from 'node:test';
import { Platform } from '@3flows/platform';
import { Intelligence } from '@3flows/intelligence';
import { runOffline } from '../_shared/offline.js';
import { post } from '../_shared/test-helpers.js';
import { passagesOf } from './help-center.js';
import './orders.js';
import './services.js';

const { articles } = JSON.parse(await readFile('./steps/14-embeddings/articles.json', 'utf8'));

describe('Step 14: embeddings', () => {
    before(() => runOffline('./steps/14-embeddings/intelligence.yml'));
    after(() => Platform.shutdown());

    test('embeddings go to the embedding model, chat stays on DEFAULT', () => {
        assert.equal(Intelligence.inference().select('embedding').configuration.name, 'embeddings');
        assert.equal(Intelligence.inference().select('chat').configuration.name, 'DEFAULT');
    });

    test('articles are split into one passage per paragraph', () => {
        const passages = passagesOf(articles.find((a: any) => a.id === 'returns'));
        assert.deepEqual(passages.map((p) => p.id), ['returns#0', 'returns#1', 'returns#2']);
    });

    test('imports the help center and finds passages by their vectors', async () => {
        const { passages } = await post('http://127.0.0.1:3000/help-center/importArticles', { articles });
        assert.equal(passages, 17);

        const refund = 'Returns and refunds\nRefunds are paid to the original payment method within 14 days of us receiving the item.';
        const hits = await post('http://127.0.0.1:3000/help-center/searchArticles', { query: refund, limit: 3 });

        assert.equal(hits.length, 3);
        assert.equal(hits[0].id, 'returns#1');
        assert.equal(hits[0].title, 'Returns and refunds');
    });
});

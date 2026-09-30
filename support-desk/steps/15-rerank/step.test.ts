import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { after, before, describe, test } from 'node:test';
import { Platform } from '@3flows/platform';
import { Intelligence } from '@3flows/intelligence';
import { runOffline } from '../_shared/offline.js';
import { post } from '../_shared/test-helpers.js';
import './help-center.js';
import './orders.js';
import './services.js';

const { articles } = JSON.parse(await readFile('./steps/15-rerank/articles.json', 'utf8'));

describe('Step 15: rerank', () => {
    before(async () => {
        await runOffline('./steps/15-rerank/intelligence.yml');
        await post('http://127.0.0.1:3000/help-center/importArticles', { articles });
    });
    after(() => Platform.shutdown());

    test('the reranker is its own AI, found by capability', () => {
        assert.equal(Intelligence.inference().select('reranking').configuration.name, 'reranker');
    });

    test('the reranker decides the order of the candidates', async () => {
        // The scripted reranker ranks by shared words: this query shares most with the winter battery passage.
        const hits = await post('http://127.0.0.1:3000/help-center/searchArticles', {
            query: 'battery range below 5 °C in winter: store and charge indoors',
            limit: 2
        });

        assert.equal(hits.length, 2);
        assert.equal(hits[0].id, 'battery#2');
    });
});

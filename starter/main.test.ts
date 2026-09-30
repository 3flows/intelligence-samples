import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import { Intelligence } from '@3flows/intelligence';

describe('my-intelligence-app', () => {
    before(async () => {
        await Intelligence.run('./intelligence.yml');
    });

    after(async () => {
        await Intelligence.shutdown();
    });

    test('the platform is up and healthy', async () => {
        const response = await fetch('http://127.0.0.1:3000/health');
        assert.equal(response.status, 200);
    });

    test('the model from intelligence.yml is configured for chat', () => {
        const ai = Intelligence.inference().select('chat').describe();
        assert.equal(ai.name, 'DEFAULT');
        assert.equal(ai.model, 'gpt-4.1-mini');
    });
});

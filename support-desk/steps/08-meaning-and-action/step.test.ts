import assert from 'node:assert/strict';
import { after, before, beforeEach, describe, test } from 'node:test';
import { Platform } from '@3flows/platform';
import { runOffline } from '../_shared/offline.js';
import { ScriptedAI } from '../_shared/scripted-ai.js';
import { triageScript } from '../_shared/triage-script.js';
import { post } from '../_shared/test-helpers.js';
import { priorityOf } from './rules.js';
import './services.js';

const bell = { email: 'grace@example.com', subject: 'Bells', body: 'Do you sell bells?' };
const derailleur = { email: 'linus@example.com', subject: 'THIRD TIME', body: 'Third time I write about my derailleur. Nobody answers.' };

describe('Step 08: the model decides meaning, the code decides action', () => {
    before(() => runOffline('./steps/08-meaning-and-action/intelligence.yml'));
    after(() => Platform.shutdown());
    beforeEach(() => ScriptedAI.reset(triageScript()));

    test('the priority rule is ours, and tested without any model', () => {
        assert.equal(priorityOf(false, 6), 'normal');
        assert.equal(priorityOf(false, 7), 'high');
        assert.equal(priorityOf(true, 0), 'high');
    });

    test('a very frustrated customer comes first in the queue', async () => {
        await post('http://127.0.0.1:3000/createTicket', bell);
        ScriptedAI.reset(triageScript({ frustration: { value: 9, confidence: 0.8, reason: 'Third message.' } }));
        await post('http://127.0.0.1:3000/createTicket', derailleur);

        const queue = await post('http://127.0.0.1:3000/queue', { department: 'technical' });

        assert.deepEqual(queue.map((ticket: any) => [ticket.subject, ticket.triage.priority]), [['THIRD TIME', 'high'], ['Bells', 'normal']]);
    });
});

import assert from 'node:assert/strict';
import { after, before, beforeEach, describe, test } from 'node:test';
import { Platform } from '@3flows/platform';
import { runOffline } from '../_shared/offline.js';
import { ScriptedAI } from '../_shared/scripted-ai.js';
import { triageScript } from '../_shared/triage-script.js';
import { eventually, post } from '../_shared/test-helpers.js';
import './services.js';

const ticket = { email: 'ada@example.com', subject: 'Brake pads', body: 'The pads from A-1042 do not fit.' };

const settled = (id: string) => eventually(async () => {
    const stored = await post('http://127.0.0.1:3000/getTicket', { id });
    return stored.status !== 'new' && stored;
});

describe('Step 09: triage in the background', () => {
    before(() => runOffline('./steps/09-background-triage/intelligence.yml'));
    after(() => Platform.shutdown());
    beforeEach(() => ScriptedAI.reset());

    test('stores the ticket right away, triages it from the queue', async () => {
        ScriptedAI.reset(triageScript());

        const created = await post('http://127.0.0.1:3000/createTicket', ticket);
        assert.equal(created.status, 'new');
        assert.equal(created.triage, null);

        const triaged = await settled(created.id);
        assert.equal(triaged.status, 'triaged');
        assert.equal(triaged.triage.department, 'technical');
        assert.equal(triaged.triage.orderNumber, 'A-1042');

        const queue = await post('http://127.0.0.1:3000/queue', { department: 'technical' });
        assert.ok(queue.some((t: any) => t.id === created.id));
    });

    test('a failing model leaves the ticket in the general queue', async () => {
        ScriptedAI.reset(triageScript({ department: new Error('provider unavailable') }));

        const created = await post('http://127.0.0.1:3000/createTicket', ticket);
        const failed = await settled(created.id);

        assert.equal(failed.status, 'triage-failed');
        const general = await post('http://127.0.0.1:3000/generalQueue');
        assert.ok(general.some((t: any) => t.id === created.id));
    });
});

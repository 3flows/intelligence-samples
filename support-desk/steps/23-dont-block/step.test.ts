import assert from 'node:assert/strict';
import { after, before, beforeEach, describe, test } from 'node:test';
import { Platform } from '@3flows/platform';
import { runOffline } from '../_shared/offline.js';
import { ScriptedAI } from '../_shared/scripted-ai.js';
import { triageScript } from '../_shared/triage-script.js';
import { eventually, post } from '../_shared/test-helpers.js';
import './help-center.js';
import './orders.js';
import './services.js';

const safe = { 'payment-details': { value: false, confidence: 0.9, reason: null }, promises: { value: false, confidence: 0.9, reason: null }, grounded: { value: true, confidence: 0.9, reason: null } };
const createTicket = (body = 'The pads do not fit.') => post('http://127.0.0.1:3000/createTicket', { email: 'ada@example.com', subject: 'Pads', body });
const getTicket = (id: string) => post('http://127.0.0.1:3000/getTicket', { id });
const settled = (id: string) => eventually(async () => { const t = await getTicket(id); return t.status !== 'new' && t; });

describe('Step 23: don’t block, expect failure', () => {
    before(() => runOffline('./steps/23-dont-block/intelligence.yml'));
    after(() => Platform.shutdown());
    beforeEach(() => ScriptedAI.reset(triageScript(safe)));

    test('the ticket is stored right away and triaged from the queue', async () => {
        const created = await createTicket();
        assert.deepEqual([created.status, created.triage], ['new', null]);

        const triaged = await settled(created.id);
        assert.equal(triaged.status, 'open');
        assert.equal(triaged.triage.department, 'technical');
    });

    test('a failing model leaves the ticket in the general queue', async () => {
        ScriptedAI.reset(triageScript({ department: new Error('provider unavailable') }));

        const created = await createTicket();
        const failed = await settled(created.id);

        assert.equal(failed.status, 'triage-failed');
        assert.ok((await post('http://127.0.0.1:3000/generalQueue')).some((t: any) => t.id === created.id));
    });
});

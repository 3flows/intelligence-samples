import assert from 'node:assert/strict';
import { after, before, beforeEach, describe, test } from 'node:test';
import { Platform } from '@3flows/platform';
import { runOffline } from '../_shared/offline.js';
import { ScriptedAI } from '../_shared/scripted-ai.js';
import { triageScript } from '../_shared/triage-script.js';
import { API, eventually, post } from '../_shared/test-helpers.js';
import './help-center.js';
import { intake } from './intake.js';
import './orders.js';
import './services.js';

const createTicket = () => post(`${API}/createTicket`, { email: 'ada@example.com', subject: 'Pads', body: 'The pads do not fit.' });
const getTicket = (id: string) => post(`${API}/getTicket`, { id });
const settled = (id: string) => eventually(async () => { const t = await getTicket(id); return t.status !== 'new' && t; });
const unsure = { department: { value: 'billing', confidence: 0.3, reason: 'Could be billing or sales.' } };

describe('Step 28: workflows', () => {
    before(() => runOffline('./steps/28-workflows/intelligence.yml'));
    after(() => Platform.shutdown());
    beforeEach(() => ScriptedAI.reset(triageScript()));

    test('the workflow describes itself: its steps, in order, by name and kind', () => {
        assert.deepEqual(intake.describe().steps.map((step) => [step.name, step.kind]), [
            ['ticket', 'map'],
            ['triage', 'map'],
            ['route', 'map'],
            ['needsPerson', 'when'],
            ['brief', 'service']
        ]);
    });

    test('a clear ticket runs three steps; the brief is skipped, and no agent runs', async () => {
        const { id } = await createTicket();
        assert.equal((await settled(id)).status, 'open');

        const report = await post(`${API}/retryIntake`, { ticketId: id });
        assert.deepEqual(report, { status: 'succeeded', steps: { ticket: 'succeeded', triage: 'succeeded', route: 'succeeded', needsPerson: 'succeeded', brief: 'skipped' } });
    });

    test('an unsure routing takes the branch: the case researcher prepares a brief', async () => {
        ScriptedAI.reset(triageScript(unsure, 'Routing is unclear: the customer asks about a price and a defect.'));
        const { id } = await createTicket();

        assert.equal((await settled(id)).status, 'needs-routing');
        const brief = await eventually(() => post(`${API}/caseBrief`, { ticketId: id }).catch(() => undefined));
        assert.equal(brief.text, 'Routing is unclear: the customer asks about a price and a defect.');
    });

    test('a failing model fails the triage step after two attempts; the ticket keeps a state, and intake can be run again', async () => {
        ScriptedAI.reset(triageScript({ department: new Error('provider unavailable') }));
        const { id } = await createTicket();
        assert.equal((await settled(id)).status, 'triage-failed');
        assert.equal(ScriptedAI.requests.filter((request) => request.responseSchemaName === 'department').length, 2);

        ScriptedAI.reset(triageScript());
        const report = await post(`${API}/retryIntake`, { ticketId: id });

        assert.equal(report.steps.triage, 'succeeded');
        assert.equal((await getTicket(id)).status, 'open');
    });
});

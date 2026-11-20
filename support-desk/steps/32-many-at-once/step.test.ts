import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import { Platform } from '@3flows/platform';
import { AIChatRequest } from '@3flows/intelligence';
import { runOffline } from '../_shared/offline.js';
import { ScriptedAI } from '../_shared/scripted-ai.js';
import { triageScript } from '../_shared/triage-script.js';
import { API, eventually, post } from '../_shared/test-helpers.js';
import './console.js';
import './help-center.js';
import './orders.js';
import './services.js';

const settled = (id: string) => eventually(async () => { const t = await post(`${API}/getTicket`, { id }); return t.status !== 'new' && t; });
const create = async (subject: string) => {
    const { id } = await post(`${API}/createTicket`, { email: 'ada@example.com', subject, body: `About: ${subject}` });
    await settled(id);
    return id as string;
};

/** The new policy: invoices go to billing. One ticket breaks the model every time. */
const newPolicy = (request: AIChatRequest) => {
    const text = JSON.stringify(request.messages);
    if (request.responseSchemaName === 'department') {
        if (text.includes('Broken')) throw new Error('provider unavailable');
        if (text.includes('Invoice')) return { value: 'billing', confidence: 0.9, reason: 'Asks for an invoice.' };
    }
    return triageScript()(request);
};

describe('Step 32: many at once', () => {
    let ids: Record<string, string>;

    before(async () => {
        await runOffline('./steps/32-many-at-once/intelligence.yml');
        ScriptedAI.reset(triageScript());   // the old policy: everything is technical
        ids = {};
        for (const subject of ['Squeaking brake', 'Invoice missing', 'Loose saddle', 'Broken message', 'Invoice wrong']) ids[subject] = await create(subject);
    });
    after(() => Platform.shutdown());

    test('every ticket is triaged again; the report says which moved and which failed', async () => {
        ScriptedAI.reset(newPolicy);

        const report = await post(`${API}/retriage`);

        assert.equal(report.total, 5);
        assert.deepEqual(report.moved.map((move: any) => [move.id, move.from, move.to]).sort(), [
            [ids['Invoice missing'], 'technical', 'billing'],
            [ids['Invoice wrong'], 'technical', 'billing']
        ].sort());
        assert.deepEqual(report.failed, [ids['Broken message']]);
    });

    test('one failing ticket does not stop the others, and it got its second attempt', async () => {
        ScriptedAI.reset(newPolicy);
        await post(`${API}/retriage`);

        const broken = ScriptedAI.requests.filter((request) => request.responseSchemaName === 'department' && JSON.stringify(request.messages).includes('Broken'));
        assert.equal(broken.length, 2);
        assert.equal((await post(`${API}/getTicket`, { id: ids['Invoice missing'] })).triage.department, 'billing');
        assert.equal((await post(`${API}/getTicket`, { id: ids['Broken message'] })).triage.department, 'technical');   // unchanged
    });
});

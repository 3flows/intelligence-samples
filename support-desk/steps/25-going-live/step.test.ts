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

import { readFile } from 'node:fs/promises';
import { Configuration } from '@3flows/platform';
import { validateIntelligenceConfiguration } from '@3flows/intelligence';

const yaml = async (file: string) => Configuration.parse(await readFile(`./steps/25-going-live/${file}`, 'utf8')).toJSON() as any;

describe('Step 25: going live', () => {
    before(() => runOffline('./steps/25-going-live/intelligence.yml'));
    after(() => Platform.shutdown());
    beforeEach(() => ScriptedAI.reset(triageScript(safe, 'Happy to help.')));

    test('production runs the same services, prompts and AIs, on durable providers', async () => {
        const [development, production] = await Promise.all([yaml('intelligence.yml'), yaml('intelligence.production.yml')]);

        const names = (list: any[]) => list.map((item) => item.name);
        assert.deepEqual(names(production.services), names(development.services));
        assert.deepEqual(production.prompts, development.prompts);
        assert.deepEqual(production.ais, development.ais);
        assert.deepEqual([production.docs[0].type, production.vectors[0].type, production.blobs[0].type, production.mqs[0].type], ['mongo', 'mongo', 'azure', 'rabbitmq']);
        assert.deepEqual(production.entities, development.entities);
    });

    test('both configurations pass the startup validation without a finding, production in strict mode', async () => {
        for (const file of ['intelligence.yml', 'intelligence.production.yml']) {
            const configuration = Configuration.parse(await readFile(`./steps/25-going-live/${file}`, 'utf8'));
            assert.deepEqual(validateIntelligenceConfiguration(configuration), []);
        }
        assert.equal((await yaml('intelligence.production.yml')).intelligence.strict, true);
    });

    test('closing a ticket deletes its chat and the records of its model calls', async () => {
        const { id } = await createTicket();
        await settled(id);
        await post('http://127.0.0.1:3000/chat', { ticketId: id, message: 'Thanks!' });
        assert.equal((await post('http://127.0.0.1:3000/transcript', { ticketId: id })).length, 2);
        assert.ok((await post('http://127.0.0.1:3000/ticketUsage', { ticketId: id })).calls > 0);

        await post('http://127.0.0.1:3000/closeTicket', { ticketId: id });

        assert.deepEqual(await post('http://127.0.0.1:3000/transcript', { ticketId: id }), []);
        assert.equal((await post('http://127.0.0.1:3000/ticketUsage', { ticketId: id })).calls, 0);
    });
});

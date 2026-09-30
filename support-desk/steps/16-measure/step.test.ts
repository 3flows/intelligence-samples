import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import { Platform } from '@3flows/platform';
import { score } from '../_shared/evaluation.js';
import { runOffline } from '../_shared/offline.js';
import { ScriptedAI } from '../_shared/scripted-ai.js';
import { triageScript } from '../_shared/triage-script.js';
import { evaluateTriage } from '../_shared/triage-eval.js';
import { triage } from './triage.js';
import './help-center.js';
import './orders.js';
import './services.js';

describe('Step 16: measure before you improve', () => {
    before(() => runOffline('./steps/16-measure/intelligence.yml'));
    after(() => Platform.shutdown());

    test('a failed case counts as wrong', () => {
        const report = score('t', [{ id: 'a', input: {}, expected: { department: 'billing' } }], [{ id: 'a', actual: {}, reasons: {}, error: 'Structured response did not match schema' }]);

        assert.deepEqual(report.metrics.department, { correct: 0, total: 1, accuracy: 0 });
        assert.equal(report.failed, 1);
    });

    test('scoring counts only what a case expects, and lists every mismatch with its reason', () => {
        const report = score('t', [
            { id: 'a', input: {}, expected: { department: 'billing', urgent: true } },
            { id: 'b', input: {}, expected: { department: 'sales' } }
        ], [
            { id: 'a', actual: { department: 'billing', urgent: false }, reasons: { urgent: 'No deadline.' } },
            { id: 'b', actual: { department: 'sales' }, reasons: {} }
        ]);

        assert.deepEqual(report.metrics.department, { correct: 2, total: 2, accuracy: 1 });
        assert.deepEqual(report.metrics.urgent, { correct: 0, total: 1, accuracy: 0 });
        assert.deepEqual(report.mismatches, [{ id: 'a', field: 'urgent', expected: true, actual: false, reason: 'No deadline.' }]);
    });

    test('the evaluation runs the real triage over all 30 tickets', async () => {
        // A model that always says billing, never urgent, no order number.
        ScriptedAI.reset(triageScript({
            department: { value: 'billing', confidence: 0.9, reason: null },
            urgent: { value: false, confidence: 0.9, reason: null },
            facts: { orderNumber: null, product: null, summary: '…' }
        }));

        const report = await evaluateTriage('./steps/16-measure/evals/tickets.json', triage);

        assert.equal(report.cases, 30);
        assert.equal(report.failed, 0);
        assert.equal(report.metrics.department.correct, 10);   // the billing tickets
        assert.equal(report.metrics.urgent.correct, 24);       // the tickets that aren't urgent
        assert.equal(report.metrics.orderNumber.correct, 20);  // the tickets without an order number
        assert.ok(report.prompts.includes('prompt support.chat@v3'));
    });
});

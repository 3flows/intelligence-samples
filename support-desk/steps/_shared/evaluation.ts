import { readFile, writeFile } from 'node:fs/promises';

/**
 * A small evaluation harness: run cases through a function that calls the model, compare with what the team
 * expected, count. Deliberately plain code: the point is the method, not a framework.
 */

export type Expected = Record<string, string | number | boolean | null>;
export type Case<I = unknown> = { id: string; input: I; expected: Expected };
export type Outcome = { id: string; actual: Expected; reasons: Record<string, string | null>; error?: string };

export type Metric = { correct: number; total: number; accuracy: number };
export type Report = {
    name: string;
    models: string[];
    prompts: string[];
    cases: number;
    failed: number;
    metrics: Record<string, Metric>;
    mismatches: Array<{ id: string; field: string; expected: unknown; actual: unknown; reason: string | null }>;
};

/** Run every case, a few at a time. A failing case is recorded, not fatal. */
export async function run<I>(cases: Case<I>[], fn: (input: I) => Promise<{ actual: Expected; reasons?: Record<string, string | null> }>, concurrency = 3): Promise<Outcome[]> {
    const outcomes: Outcome[] = new Array(cases.length);
    let next = 0;
    async function worker() {
        while (next < cases.length) {
            const index = next++;
            const { id, input } = cases[index];
            try {
                const { actual, reasons = {} } = await fn(input);
                outcomes[index] = { id, actual, reasons };
            } catch (error) {
                outcomes[index] = { id, actual: {}, reasons: {}, error: (error as Error).message };
            }
            process.stdout.write('.');
        }
    }
    await Promise.all(Array.from({ length: concurrency }, worker));
    process.stdout.write('\n');
    return outcomes;
}

/** Compare outcomes with expectations, field by field. Only fields a case expects are counted. */
export function score(name: string, cases: Case[], outcomes: Outcome[], context: { models?: string[]; prompts?: string[] } = {}): Report {
    const metrics: Record<string, Metric> = {};
    const mismatches: Report['mismatches'] = [];
    cases.forEach((c, index) => {
        const outcome = outcomes[index];
        // A case that failed counts as wrong for every field: a model that can't answer isn't good enough.
        if (outcome.error) {
            for (const field of Object.keys(c.expected)) (metrics[field] ??= { correct: 0, total: 0, accuracy: 0 }).total++;
            mismatches.push({ id: c.id, field: '*', expected: 'an answer', actual: 'error', reason: outcome.error.slice(0, 200) });
            return;
        }
        for (const [field, expected] of Object.entries(c.expected)) {
            const metric = (metrics[field] ??= { correct: 0, total: 0, accuracy: 0 });
            metric.total++;
            const actual = outcome.actual[field];
            if (normalize(actual) === normalize(expected)) metric.correct++;
            else mismatches.push({ id: c.id, field, expected, actual, reason: outcome.reasons[field] ?? null });
        }
    });
    for (const metric of Object.values(metrics)) metric.accuracy = metric.total ? metric.correct / metric.total : 0;
    return {
        name,
        models: context.models ?? [],
        prompts: context.prompts ?? [],
        cases: cases.length,
        failed: outcomes.filter((o) => o.error).length,
        metrics,
        mismatches
    };
}

const normalize = (value: unknown) => typeof value === 'string' ? value.trim().toUpperCase() : JSON.stringify(value ?? null);

const percent = (value: number) => `${Math.round(value * 100)}%`.padStart(4);

/** Print a report, and the change against a baseline report if one is given. */
export function print(report: Report, baseline?: Report): void {
    console.log(`\n${report.name}: ${report.cases} cases${report.failed ? `, ${report.failed} failed (counted as wrong)` : ''}`);
    for (const line of [...report.models, ...report.prompts]) console.log(`  ${line}`);
    console.log('');
    for (const [field, metric] of Object.entries(report.metrics)) {
        const before = baseline?.metrics[field];
        const change = before ? `   (was ${percent(before.accuracy).trim()})` : '';
        console.log(`  ${field.padEnd(14)} ${percent(metric.accuracy)}  ${String(metric.correct).padStart(3)}/${metric.total}${change}`);
    }
    if (report.mismatches.length) {
        console.log('\n  Mismatches:');
        for (const m of report.mismatches) {
            console.log(`  - ${m.id} ${m.field}: expected ${JSON.stringify(m.expected)}, got ${JSON.stringify(m.actual)}${m.reason ? `\n      ${m.reason}` : ''}`);
        }
    }
}

export async function load<T>(path: string): Promise<T> {
    return JSON.parse(await readFile(path, 'utf8')) as T;
}

export async function save(path: string, report: Report): Promise<void> {
    await writeFile(path, JSON.stringify(report, null, 2) + '\n');
}

/** Reads a baseline report, if it exists. */
export async function baseline(path: string | undefined): Promise<Report | undefined> {
    if (!path) return undefined;
    try { return await load<Report>(path); } catch { return undefined; }
}

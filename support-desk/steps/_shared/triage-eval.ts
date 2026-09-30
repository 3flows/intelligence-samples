import { Platform } from '@3flows/platform';
import { Intelligence } from '@3flows/intelligence';
import { Case, Report, baseline, load, print, run, save, score } from './evaluation.js';

type TicketText = { subject: string; body: string };
type TriageResult = { department: string; departmentReason: string | null; urgent: boolean; urgentReason: string | null; orderNumber: string | null };
type Triage = (context: { inference: () => ReturnType<typeof Intelligence.inference> }, ticket: TicketText & { id: string; attachments: string[] }) => Promise<TriageResult>;

/** Run the triage evaluation set through a step's triage() and score it against the team's decisions. */
export async function evaluateTriage(datasetPath: string, triage: Triage, models: string[] = []): Promise<Report> {
    const { cases } = await load<{ cases: Case<TicketText>[] }>(datasetPath);
    const context = { inference: () => Intelligence.inference() };

    const outcomes = await run(cases, async (input) => {
        const result = await triage(context, { id: 'evaluation', attachments: [], ...input });
        return {
            actual: { department: result.department, urgent: result.urgent, orderNumber: result.orderNumber },
            reasons: { department: result.departmentReason, urgent: result.urgentReason }
        };
    });

    const prompts = [...Intelligence.prompts().prompts.values()].map((prompt) => `prompt ${prompt.name}@${prompt.version ?? '-'}`);
    return score('Triage evaluation', cases, outcomes, { models: models.map((m) => `ai ${m}`), prompts });
}

/** The command line around it: print, compare with BASELINE (a report path), save as REPORT. */
export async function main(datasetPath: string, triage: Triage, models: string[], reportPath: string): Promise<void> {
    try {
        const report = await evaluateTriage(datasetPath, triage, models);
        print(report, await baseline(process.env.BASELINE));
        await save(reportPath, report);
        console.log(`\nReport: ${reportPath}`);
    } finally {
        await Platform.shutdown();
    }
}

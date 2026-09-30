import { readFile } from 'node:fs/promises';
import { Platform } from '@3flows/platform';
import { Intelligence } from '@3flows/intelligence';
import { Case, baseline, load, print, run, save, score } from '../_shared/evaluation.js';
import { runReal } from '../_shared/real.js';
import { post } from '../_shared/test-helpers.js';
import { passagesOf } from './help-center.js';
import { grounded, tone } from './judges.js';
import './help-center.js';
import './orders.js';
import './services.js';

// Evaluates the real chat path: a ticket, a chat turn over HTTP, the sources it used. Then the judges review the answer.
//   OPENAI_API_KEY=… yarn eval:18          or          LOCAL_MODEL=qwen/qwen3-coder-next yarn eval:18
const step = './steps/18-judge-the-answers';
type Question = { question: string; article: string | null };

const models = await runReal(`${step}/intelligence.yml`);
try {
    const { articles } = JSON.parse(await readFile(`${step}/articles.json`, 'utf8'));
    await post('http://127.0.0.1:3000/help-center/importArticles', { articles });
    const passages = new Map<string, { title: string; text: string }>(articles.flatMap(passagesOf).map((p: any) => [p.id, { title: p.title, text: p.text }]));

    const { cases } = await load<{ cases: Case<Question>[] }>(`${step}/evals/questions.json`);
    // What we expect of every answer: the right article found (if there is one), grounded, a good tone.
    const expectations: Case<Question>[] = cases.map((c) => ({
        ...c,
        expected: { ...(c.input.article ? { retrieved: true } : {}), grounded: true, goodTone: true }
    }));

    const context = { inference: () => Intelligence.inference() };
    const outcomes = await run(expectations, async ({ question, article }) => {
        const ticket = await post('http://127.0.0.1:3000/createTicket', { email: 'eval@example.com', subject: 'Question', body: question });
        const { answer, sources } = await post('http://127.0.0.1:3000/chat', { ticketId: ticket.id, message: question });
        const used = (sources as string[]).map((id) => passages.get(id)!).filter(Boolean);

        const [isGrounded, toneScore] = await Promise.all([grounded(context, answer, used), tone(context, answer)]);
        return {
            actual: {
                ...(article ? { retrieved: (sources as string[]).some((id) => id.startsWith(`${article}#`)) } : {}),
                grounded: isGrounded.value,
                goodTone: toneScore.value >= 4
            },
            reasons: { grounded: isGrounded.reason ?? null, goodTone: `${toneScore.value}/5 ${toneScore.reason ?? ''}`, retrieved: `sources: ${(sources as string[]).join(', ')}` }
        };
    }, 2);

    const report = score('Answer evaluation', expectations, outcomes, { models: models.map((m) => `ai ${m}`) });
    print(report, await baseline(process.env.BASELINE));
    await save(`${step}/evals/report.json`, report);
} finally {
    await Platform.shutdown();
}

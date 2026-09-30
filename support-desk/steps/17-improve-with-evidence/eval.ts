import { runReal } from '../_shared/real.js';
import { main } from '../_shared/triage-eval.js';
import { triage } from './triage.js';
import './help-center.js';
import './orders.js';
import './services.js';

// An evaluation, not a test: real model, real tickets, the team's decisions. Run it deliberately:
//   OPENAI_API_KEY=… yarn eval:17          or          LOCAL_MODEL=qwen/qwen3-coder-next yarn eval:17
const step = './steps/17-improve-with-evidence';
const models = await runReal(`${step}/intelligence.yml`);
await main(`${step}/evals/tickets.json`, triage, models, `${step}/evals/report.json`);

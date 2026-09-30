import { runReal } from '../_shared/real.js';
import { main } from '../_shared/triage-eval.js';
import { triage } from './triage.js';
import './help-center.js';
import './orders.js';
import './services.js';

// Is the cheaper triage model good enough? Compared with step 17's report:
//   OPENAI_API_KEY=… yarn eval:22
//   LOCAL_MODEL=qwen/qwen3-coder-next LOCAL_MODEL_TRIAGE=<a smaller model> yarn eval:22
const step = './steps/22-model-per-job';
const models = await runReal(`${step}/intelligence.yml`);
await main(`${step}/evals/tickets.json`, triage, models, `${step}/evals/report.json`);

import { runReal } from '../_shared/real.js';
import { main } from '../_shared/triage-eval.js';
import { triage } from './triage.js';
import './help-center.js';
import './orders.js';
import './services.js';

const step = './steps/18-judge-the-answers';
const models = await runReal(`${step}/intelligence.yml`);
await main(`${step}/evals/tickets.json`, triage, models, `${step}/evals/report-triage.json`);

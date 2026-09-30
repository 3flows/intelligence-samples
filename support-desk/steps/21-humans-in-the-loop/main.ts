import { Intelligence } from '@3flows/intelligence';
import './help-center.js';
import './orders.js';
import './services.js';

await Intelligence.run('./steps/21-humans-in-the-loop/intelligence.yml');

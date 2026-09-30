import { Intelligence } from '@3flows/intelligence';
import './help-center.js';
import './orders.js';
import './services.js';

await Intelligence.run('./steps/20-guard-the-output/intelligence.yml');

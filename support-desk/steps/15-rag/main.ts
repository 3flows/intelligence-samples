import { Intelligence } from '@3flows/intelligence';
import './help-center.js';
import './orders.js';
import './services.js';

await Intelligence.run('./steps/15-rag/intelligence.yml');

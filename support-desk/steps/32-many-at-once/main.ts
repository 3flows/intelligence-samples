import { Intelligence } from '@3flows/intelligence';
import './console.js';
import './help-center.js';
import './orders.js';
import './services.js';

await Intelligence.run('./steps/32-many-at-once/intelligence.yml');

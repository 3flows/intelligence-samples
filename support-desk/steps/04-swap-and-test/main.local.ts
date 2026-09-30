import { Intelligence } from '@3flows/intelligence';
import './services.js';

// The same service, on a local model.
await Intelligence.run('./steps/04-swap-and-test/intelligence.local.yml');

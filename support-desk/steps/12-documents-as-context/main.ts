import { Intelligence } from '@3flows/intelligence';
import './orders.js';
import './services.js';

await Intelligence.run('./steps/12-documents-as-context/intelligence.yml');

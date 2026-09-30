import { Intelligence } from '@3flows/intelligence';

// Import your services here, before the platform starts, so that YAML can find them.

await Intelligence.run('./intelligence.yml');

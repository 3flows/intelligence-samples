import { readFile } from 'node:fs/promises';
import { Configuration } from '@3flows/platform';
import { Intelligence } from '@3flows/intelligence';
import './scripted-ai.js';

/** Run the app with the given YAML, but with every AI replaced by the scripted provider. */
export async function runOffline(path: string): Promise<void> {
    await Intelligence.run({
        load: async () => {
            const yaml = Configuration.parse(await readFile(path, 'utf8')).toJSON() as any;
            yaml.ais = (yaml.ais ?? []).map((ai: any) => ({ ...ai, provider: 'scripted', connection: {} }));
            return new Configuration(yaml);
        }
    });
}

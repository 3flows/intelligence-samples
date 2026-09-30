import { readFile } from 'node:fs/promises';
import { Configuration, Platform } from '@3flows/platform';
import './scripted-ai.js';

/**
 * Run the platform with a step's YAML and real models, for evaluations.
 *
 * With LOCAL_MODEL set (e.g. LOCAL_MODEL=qwen/qwen3-coder-next), every chat AI runs on that model in LM Studio,
 * and embeddings on LOCAL_EMBEDDING_MODEL (default text-embedding-nomic-embed-text-v1.5). LOCAL_MODEL_<NAME>
 * overrides the model of one AI, e.g. LOCAL_MODEL_TRIAGE. There's no local reranker or moderation model:
 * those stay scripted, and the evaluation says so.
 */
export async function runReal(path: string): Promise<string[]> {
    const notes: string[] = [];
    await Platform.run({
        load: async () => {
            const yaml = Configuration.parse(await readFile(path, 'utf8')).toJSON() as any;
            const local = process.env.LOCAL_MODEL;
            if (local) {
                yaml.ais = (yaml.ais ?? []).map((ai: any) => {
                    const model = String(ai.model).toLowerCase();
                    if (model.includes('embedding')) {
                        return { ...ai, provider: 'lmstudio', model: process.env.LOCAL_EMBEDDING_MODEL ?? 'text-embedding-nomic-embed-text-v1.5', connection: {}, capabilities: ['embedding'] };
                    }
                    if (model.includes('rerank') || model.includes('moderation')) {
                        notes.push(`${ai.name}: scripted (no local equivalent)`);
                        return { ...ai, provider: 'scripted', connection: {} };
                    }
                    const chosen = process.env[`LOCAL_MODEL_${String(ai.name).toUpperCase()}`] ?? local;
                    notes.push(`${ai.name}: ${chosen} (LM Studio)`);
                    return {
                        ...ai,
                        provider: 'lmstudio',
                        model: chosen,
                        connection: {},
                        capabilities: ['structured', 'tools'],
                        defaults: { ...(ai.defaults ?? {}), timeoutMs: 300000, maxTokens: 2000, retry: { attempts: 3, backoffMs: 2000 } }
                    };
                });
            } else {
                for (const ai of yaml.ais ?? []) notes.push(`${ai.name}: ${ai.model} (${ai.provider})`);
            }
            return new Configuration(yaml);
        }
    });
    return notes;
}

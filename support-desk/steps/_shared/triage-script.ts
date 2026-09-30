import { AIChatRequest } from '@3flows/intelligence';
import { Script } from './scripted-ai.js';

/** Scripted answers for the triage questions, by decision name. Anything else gets `chat`. */
export function triageScript(answers: Record<string, unknown> = {}, chat = 'OK'): Script {
    const defaults: Record<string, unknown> = {
        department: { value: 'technical', confidence: 0.9, reason: 'Mentions a part that does not fit.' },
        topics: { value: ['spare-parts'], confidence: 0.8, reason: null },
        urgent: { value: false, confidence: 0.8, reason: 'No deadline mentioned.' },
        frustration: { value: 2, confidence: 0.7, reason: 'Polite tone.' },
        facts: { orderNumber: 'A-1042', product: 'brake pads', summary: 'Brake pads do not fit.' },
        ...answers
    };
    return (request: AIChatRequest) => {
        const name = request.responseSchemaName;
        if (name && name in defaults) {
            const answer = defaults[name];
            if (answer instanceof Error) throw answer;
            return answer as Record<string, unknown>;
        }
        return chat;
    };
}

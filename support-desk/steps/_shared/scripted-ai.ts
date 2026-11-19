import { Register } from '@3flows/platform';
import {
    AI, AICapabilitiesConfiguration, AIChatRequest, AIChatRequestChain, AIChatResponse, AIConfiguration,
    AIEmbeddingRequestChain, AIEmbeddingResponse, AIModerationRequestChain, AIModerationResponse,
    AIRerankerRequestChain, AIRerankResponse, AIStreamEvent
} from '@3flows/intelligence';

/** What the scripted model answers: text, a structured value, or a full response with tool calls. */
export type Script = (request: AIChatRequest) => string | Record<string, unknown> | AIChatResponse;

@Register('scripted', 'ai')
export class ScriptedAI extends AI {
    static script: Script = () => 'OK';
    /** Every scripted call reports the same, made-up token usage. */
    static usage = { promptTokens: 10, completionTokens: 2, totalTokens: 12 };
    static flagged: (text: string) => boolean = () => false;
    /** Every chat request, with the name of the AI (from `ais`) that received it. */
    static requests: Array<AIChatRequest & { ai: string }> = [];

    static reset(script: Script = () => 'OK'): void {
        ScriptedAI.script = script;
        ScriptedAI.flagged = () => false;
        ScriptedAI.requests = [];
    }

    initialise(configuration: AIConfiguration): AI {
        this.configuration = configuration;
        return this;
    }

    /** Like the real providers, guess capabilities from the model name. */
    protected inferredCapabilities(): AICapabilitiesConfiguration {
        const model = this.configuration.model.toLowerCase();
        if (model.includes('embedding')) return ['embedding'];
        if (model.includes('rerank')) return ['reranking'];
        if (model.includes('moderation')) return ['moderation'];
        return ['chat', 'streaming', 'structured', 'tools'];
    }

    // A provider receives the request as a chain; _request() is the plain request it carries.
    protected async doChat(chain: AIChatRequestChain): Promise<AIChatResponse> {
        const request = chain._request();
        // Copy: the tool loop keeps appending to the same messages array.
        ScriptedAI.requests.push({ ...request, messages: [...request.messages], ai: this.configuration.name });
        const answer = ScriptedAI.script(request);
        const usage = ScriptedAI.usage;
        if (typeof answer === 'string') return { text: answer, usage, model: this.configuration.model, provider: 'scripted' };
        if ('text' in answer || 'toolCalls' in answer) return { usage, ...answer } as AIChatResponse;
        return { text: JSON.stringify(answer), parsed: answer, usage };   // a structured answer
    }

    protected async doStream(chain: AIChatRequestChain): Promise<AsyncIterable<AIStreamEvent>> {
        const response = await this.doChat(chain);
        return (async function* () {
            for (const word of (response.text ?? '').split(/(?<= )/)) yield { type: 'text.delta' as const, text: word };
            // Like a real provider: a requested tool call is announced in the stream, then completed.
            for (const toolCall of response.toolCalls ?? []) {
                yield { type: 'tool.call.started' as const, toolCallId: toolCall.id, name: toolCall.name };
                yield { type: 'tool.call.completed' as const, toolCall };
            }
            yield { type: 'done' as const, response };
        })();
    }

    /** A crude but deterministic embedding: letter frequencies. Similar words, similar vectors. */
    protected async doEmbed(chain: AIEmbeddingRequestChain): Promise<AIEmbeddingResponse> {
        const request = chain._request();
        const texts = Array.isArray(request.input) ? request.input : [request.input];
        return { embeddings: texts.map((text, index) => ({ index, text, vector: letterVector(text) })) };
    }

    /** Rank by shared words. */
    protected async doRerank(chain: AIRerankerRequestChain): Promise<AIRerankResponse> {
        const request = chain._request();
        const query = new Set(words(request.query));
        const results = request.documents
            .map((document, index) => {
                const text = typeof document === 'string' ? document : document.text;
                return { index, document, score: words(text).filter((word) => query.has(word)).length };
            })
            .sort((a, b) => b.score - a.score)
            .slice(0, request.topN);
        return { results };
    }

    protected async doModerate(chain: AIModerationRequestChain): Promise<AIModerationResponse> {
        const request = chain._request();
        const texts = Array.isArray(request.input) ? request.input : [request.input];
        const results = texts.map((text) => ({ flagged: ScriptedAI.flagged(text) }));
        return { flagged: results.some((result) => result.flagged), results };
    }
}

const words = (text: string) => text.toLowerCase().split(/\W+/).filter(Boolean);

function letterVector(text: string): number[] {
    const vector = new Array(26).fill(0);
    for (const char of text.toLowerCase()) {
        const index = char.charCodeAt(0) - 97;
        if (index >= 0 && index < 26) vector[index]++;
    }
    const length = Math.hypot(...vector) || 1;
    return vector.map((value) => value / length);
}

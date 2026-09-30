import { Register, t } from '@3flows/platform';
import { IntelligenceContext, IntelligenceService, handler } from '../_shared/intelligence-service.js';

export const Article = t.object({ id: t.string(), title: t.string(), body: t.string() });
export type Article = t.infer<typeof Article>;

export const Passage = t.object({ id: t.string(), articleId: t.string(), title: t.string(), text: t.string() });
export type Passage = t.infer<typeof Passage>;

export const SearchQuery = t.object({ query: t.string(), limit: t.number().optional() });

/** The bridge between Intelligence and the platform's vector store: text in, vector out. */
export const embedder = (context: Pick<IntelligenceContext, 'inference'>) => async (text: string): Promise<number[]> =>
    (await context.inference().embedding().with(text).embed()).vector!;

/** One passage per paragraph, so every vector means one thing. */
export function passagesOf(article: Article): Passage[] {
    return article.body.split(/\n\s*\n/).map((text, index) => ({
        id: `${article.id}#${index}`,
        articleId: article.id,
        title: article.title,
        text: text.trim()
    }));
}

/** A vector hit as a passage. */
function toPassage(hit: { id: string; text: string; metadata?: Record<string, string> }): Passage {
    return { id: hit.id, articleId: hit.metadata?.articleId ?? '', title: hit.metadata?.title ?? '', text: hit.text };
}

@Register()
export class HelpCenterService extends IntelligenceService {
    handlers = () => [
        handler('importArticles', t.object({ articles: t.array(Article) }), t.object({ passages: t.number() }), async ({ articles }, trigger) => {
            const passages = articles.flatMap(passagesOf);
            await trigger.context.vector().index('help-center')
                .documents(passages.map(({ id, articleId, title, text }) => ({
                    id,
                    text: `${title}\n${text}`,   // the title gives every passage its context
                    metadata: { articleId, title }
                })))
                .embedding(embedder(trigger.context))
                .put();
            await trigger.ok({ passages: passages.length });
        }),

        handler('searchArticles', SearchQuery, t.array(Passage), async ({ query, limit = 5 }, trigger) => {
            // Retrieve many, fast and approximate ...
            const candidates = await trigger.context.vector().index('help-center')
                .query(query)
                .embedding(embedder(trigger.context))
                .limit(limit * 3)
                .find();
            if (!candidates.length) return trigger.ok([]);   // nothing to rank: the reranker rejects an empty list

            // ... then let the reranker read question and candidates together, and keep the best.
            const ranked = await trigger.context.inference()
                .reranker()
                .query(query)
                .with(candidates, { text: (candidate) => candidate.text, id: (candidate) => candidate.id })
                .topK(limit)
                .rank();

            await trigger.ok(ranked.results.map(({ index }) => toPassage(candidates[index])));
        })
    ];
}

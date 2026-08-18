import { Type } from "typebox";
import { defineToolPlugin } from "openclaw/plugin-sdk/tool-plugin";
const DEFAULT_BASE_URL = "https://api.blopus.ai";
/** Blopus returns structured JSON errors; surface the message rather than a bare status. */
async function call(path, body, config, signal) {
    const apiKey = config.apiKey;
    if (!apiKey) {
        throw new Error("Blopus needs an API key. Get one at https://blopus.ai and set it as " +
            "`apiKey` in this plugin's config.");
    }
    const res = await fetch(`${config.baseUrl ?? DEFAULT_BASE_URL}${path}`, {
        method: "POST",
        headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
        signal,
    });
    if (!res.ok) {
        let detail = "";
        try {
            const j = await res.json();
            detail = j?.message ?? j?.error ?? "";
        }
        catch {
            /* non-JSON error body */
        }
        throw new Error(`Blopus ${path} failed: HTTP ${res.status}${detail ? ` — ${detail}` : ""}`);
    }
    return res.json();
}
export default defineToolPlugin({
    id: "blopus",
    name: "Blopus Search",
    description: "Web search and page fetch over an independently crawled index — not a reseller of " +
        "another engine's results. Freshness filtering, domain include/exclude, inline " +
        "content, and hero images.",
    configSchema: Type.Object({
        apiKey: Type.Optional(Type.String({ description: "Blopus API key (blp_live_...). Get one at https://blopus.ai" })),
        baseUrl: Type.Optional(Type.String({ description: `Blopus API base URL. Defaults to ${DEFAULT_BASE_URL}` })),
    }),
    tools: (tool) => [
        tool({
            name: "blopus_search",
            label: "Blopus Search",
            description: "Search the web. Use news_only for event questions — what happened, who announced " +
                "what, market reaction, election results. Use freshness to bound recency. " +
                "Set include_images when the user wants to SEE something (pictures, photos, " +
                "'show me', 'what does X look like'); each result then carries an image URL you " +
                "can render as markdown ![title](image). Results come in blocks of 10, so count " +
                "10 and count 1 cost the same.",
            parameters: Type.Object({
                query: Type.String({ description: "The search query." }),
                count: Type.Optional(Type.Number({ description: "Results to return; rounds up to a block of 10.", default: 10 })),
                freshness: Type.Optional(Type.String({
                    description: "Recency bound: pd (24h), pw, pm, p3m, p1y, or all.",
                    default: "all",
                })),
                news_only: Type.Optional(Type.Boolean({ description: "Restrict to news sources. Use for event questions." })),
                include_domains: Type.Optional(Type.Array(Type.String(), { description: "Only return results from these hostnames." })),
                exclude_domains: Type.Optional(Type.Array(Type.String(), { description: "Drop results from these hostnames." })),
                include_content: Type.Optional(Type.Boolean({ description: "Return full page text inline instead of a snippet." })),
                include_images: Type.Optional(Type.Boolean({
                    description: "Attach each result's hero image URL. Off by default — it costs tokens " +
                        "most queries do not need. May be null per result; always check before rendering.",
                })),
                topics: Type.Optional(Type.Array(Type.String(), {
                    description: "Only return results from publications covering these topics, e.g. " +
                        "['cybersecurity']. IMPORTANT: a topic describes what a PUBLICATION " +
                        "covers, not what an individual article is about — ['ai'] means 'pages " +
                        "from AI-focused sites', broader than 'pages about AI'. Matched exactly; " +
                        "unknown topics match nothing, so do not guess values.",
                })),
                exclude_topics: Type.Optional(Type.Array(Type.String(), {
                    description: "Drop results from publications covering these topics, e.g. ['sports'].",
                })),
                min_words: Type.Optional(Type.Number({
                    description: "Only return pages with at least this many words. Set 120 when the user " +
                        "wants something to READ — analysis, background, a comparison, 'explain', " +
                        "'how does'. Roughly 10-17% of the index is tag listings and stubs that " +
                        "rank on keywords without answering anything. Leave unset for breaking " +
                        "news, where a two-line wire story is a legitimate answer.",
                })),
            }),
            async execute(params, config, context) {
                context.signal?.throwIfAborted();
                const data = await call("/v1/search", params, config, context.signal);
                return {
                    query: data.query,
                    count: data.count,
                    results: (data.results ?? []).map((r) => ({
                        title: r.title,
                        url: r.url,
                        snippet: r.snippet,
                        domain: r.domain,
                        published_at: r.published_at,
                        score: r.score,
                        // always returned: lets the model see a stub before it reads one
                        word_count: r.word_count,
                        // present only when include_content / include_images were requested
                        ...(r.content ? { content: r.content } : {}),
                        ...(r.image ? { image: r.image, image_w: r.image_w, image_h: r.image_h } : {}),
                    })),
                };
            },
        }),
        tool({
            name: "blopus_fetch",
            label: "Blopus Fetch",
            description: "Fetch the stored full text of previously indexed URL(s) — use after a search when " +
                "a snippet is not enough. Pass `urls` to batch: one batch is a single lookup and " +
                "costs the same as one search, so always batch instead of looping. URLs we do not " +
                "hold come back in failed_results and are not charged.",
            parameters: Type.Object({
                url: Type.Optional(Type.String({ description: "A single URL to fetch." })),
                urls: Type.Optional(Type.Array(Type.String(), { description: "A batch of URLs (max 50). Prefer this." })),
            }),
            async execute(params, config, context) {
                context.signal?.throwIfAborted();
                if (!params.url && !(params.urls && params.urls.length)) {
                    throw new Error("Provide either `url` or a non-empty `urls` array.");
                }
                const data = await call("/v1/fetch", params, config, context.signal);
                return data;
            },
        }),
    ],
});

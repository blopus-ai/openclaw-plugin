import { Type } from "typebox";
import { defineToolPlugin } from "openclaw/plugin-sdk/tool-plugin";
const DEFAULT_BASE_URL = "https://api.blopus.ai";
/** Blopus returns structured JSON errors; surface the message rather than a bare status. */
async function call(path, body, config, signal, method = "POST") {
    const apiKey = config.apiKey;
    if (!apiKey) {
        throw new Error("Blopus needs an API key. Get one at https://blopus.ai and set it as " +
            "`apiKey` in this plugin's config.");
    }
    // 🔴 /v1/topics is a GET with query params, not a POST body. fetch throws
    // "Request with GET/HEAD method cannot have body", so for GET the body becomes a query
    // string and both the body and Content-Type are omitted rather than sent empty.
    const isGet = method === "GET";
    const qs = isGet && body && typeof body === "object"
        ? "?" +
            new URLSearchParams(Object.entries(body)
                .filter(([, v]) => v !== undefined && v !== null)
                .map(([k, v]) => [k, String(v)])).toString()
        : "";
    const res = await fetch(`${config.baseUrl ?? DEFAULT_BASE_URL}${path}${qs}`, {
        method,
        headers: {
            Authorization: `Bearer ${apiKey}`,
            ...(isGet ? {} : { "Content-Type": "application/json" }),
        },
        ...(isGet ? {} : { body: JSON.stringify(body) }),
        signal,
    });
    if (!res.ok) {
        let detail = "";
        try {
            const j = await res.json();
            // The API returns { error: { code, message } }. Reading j.error directly
            // concatenated an OBJECT, so every failure reached the user as
            // "[object Object]" instead of the reason. Handle the nested shape first,
            // then the flat ones, and never interpolate a non-string.
            const e = j?.error;
            const cand = (e && typeof e === "object" ? (e.message ?? e.code) : e) ??
                j?.message ??
                j?.detail;
            detail = typeof cand === "string" ? cand : cand ? JSON.stringify(cand) : "";
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
    // 🔴 Everything below is the SOURCE for openclaw.plugin.json — `openclaw plugins build`
    // regenerates that file from this object, and `openclaw plugins validate` fails when the two
    // differ. Editing the manifest by hand looks fine and is silently reverted by the next
    // build, which is how blopus_images ended up declared in no contract at all. Change it HERE.
    name: "Blopus — Web Search, Fetch & Images",
    description: "Give your agent the open web: search, read full pages, and search images — from an index " +
        "Blopus crawls itself, not a reseller of another engine's results. " +
        "blopus_search (freshness windows, domain filters, topic filters, inline full text) + " +
        "blopus_images (a dedicated image index, not hero images scraped off web results) + " +
        "blopus_topics (the filter vocabulary, free) + blopus_fetch (complete page text, 50 URLs " +
        "per call). Get an API key at blopus.ai",
    configSchema: Type.Object({
        apiKey: Type.Optional(Type.String({
            title: "Blopus API key",
            description: "Get one at https://blopus.ai — starts with blp_live_",
            pattern: "^blp_(live|test)_[A-Za-z0-9_-]+$",
        })),
        baseUrl: Type.Optional(Type.String({
            title: "API base URL",
            description: `Blopus API base URL. Defaults to ${DEFAULT_BASE_URL}`,
            default: DEFAULT_BASE_URL,
        })),
    }, 
    // Catches a mistyped config key at load time instead of at the first call.
    { additionalProperties: false }),
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
            name: "blopus_images",
            label: "Blopus Images",
            description: "Search Blopus's own image index and return picture URLs. Use it when the user wants " +
                "to SEE something — 'show me', 'what does X look like', 'find a photo of X' — or when " +
                "a picture would illustrate the answer. " +
                "This is NOT blopus_search with include_images: that runs a WEB search and returns " +
                "whatever hero image those articles happened to use, so 'blue birds' comes back with " +
                "press photos from Blue Bird Corporation. This one ranks the image index itself and " +
                "returns pictures OF the subject. " +
                "Render with ![caption](url) using `caption`, not `title`: `title` is the raw alt " +
                "attribute and is empty or a mangled filename on roughly a quarter of images, so never " +
                "discard a result for having an ugly title. NEVER invent an image URL — a guessed one " +
                "404s and shows a broken image. Results come in blocks of 10, so count 10 and count 1 " +
                "cost the same.",
            parameters: Type.Object({
                query: Type.String({ description: "What the picture should show." }),
                count: Type.Optional(Type.Number({ description: "Images to return; rounds up to a block of 10.", default: 10 })),
                max_syndication: Type.Optional(Type.Number({
                    description: "Cap on how many pages an image may appear on. Default 30, which suppresses " +
                        "stock photography and site furniture. Lower it for something distinctive.",
                    default: 30,
                })),
            }),
            async execute(params, config, context) {
                context.signal?.throwIfAborted();
                const data = await call("/v1/images", params, config, context.signal);
                return {
                    query: data.query,
                    count: data.count,
                    results: (data.results ?? []).map((r) => ({
                        // caption first: it is the field to render, and `title` is often junk
                        caption: r.caption,
                        url: r.url,
                        width: r.width,
                        height: r.height,
                        title: r.title,
                        page_url: r.page_url,
                        page_title: r.page_title,
                        domain: r.domain,
                    })),
                };
            },
        }),
        tool({
            name: "blopus_topics",
            label: "Blopus Topics",
            description: "List the subject areas you can pass to `topics` / `exclude_topics` on blopus_search. " +
                "FREE \u2014 this call costs no credits, because a topic is matched EXACTLY and a wrong " +
                "guess returns zero results that look identical to a genuine no-match. " +
                "Call it once when you need a value you are unsure of, then reuse the answer for the " +
                "rest of the conversation rather than calling it again. " +
                "`min_docs` (default 1000) hides labels too small to be useful; raise it to 100000 for " +
                "a short list of only the largest areas. " +
                "IMPORTANT: a topic describes what a PUBLICATION covers, not what an individual article " +
                "is about \u2014 'ai' means 'pages from AI-focused sites', which is broader and coarser " +
                "than 'pages about AI'. Use it to scope or de-noise a search, never as a substitute for " +
                "putting the subject in the query itself.",
            parameters: Type.Object({
                min_docs: Type.Optional(Type.Number({
                    description: "Hide topics with fewer than this many indexed pages. Default 1000; 100000 " +
                        "returns only the largest areas.",
                    default: 1000,
                })),
            }),
            async execute(params, config, context) {
                context.signal?.throwIfAborted();
                const data = await call("/v1/topics", params, config, context.signal, "GET");
                return {
                    // Names only: the document counts roughly triple the payload and a model picking a
                    // filter does not need them. Mirrors what the MCP server returns.
                    topics: (data.topics ?? []).map((t) => t.topic ?? t),
                    count: data.count,
                    min_docs: data.min_docs,
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

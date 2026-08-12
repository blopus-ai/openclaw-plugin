# Blopus for OpenClaw

**Give your agent the open web.** Search, read full pages, and pull images — from an index
Blopus crawls itself, not a reseller of another engine's results.

→ **[blopus.ai](https://blopus.ai)** · free key, no card required

---

## What your agent gets

| | Tool | What it does |
|---|---|---|
| 🔍 | **`blopus_search`** | Web and news search. Freshness windows, domain include/exclude, inline full text, hero images. |
| 📄 | **`blopus_fetch`** | The complete text of any indexed page. Batch up to 50 URLs in a single call. |
| 🖼️ | **image search** *(beta)* | Set `include_images` and every result carries its hero image URL, ready to render. |

## Why it's different

**It's our own index.** Most search APIs resell someone else's results, which means you
inherit their ranking, their gaps, and their pricing floor. Blopus runs its own crawler, so
coverage and freshness are ours to improve — and we do, continuously.

**`blopus_fetch` has no equivalent in most search APIs.** Search gives you snippets; agents
need the actual page. Instead of a search call plus N scrapes with N sets of failures, you
batch up to 50 URLs into **one** call at the price of one search.

**Built for agents, not for humans clicking links.** Results are ranked for machine reading,
snippets are sized for context windows, and the pricing model is designed so an agent can't
accidentally burn credits (see below).

## Setup

1. Get a free key at **[blopus.ai](https://blopus.ai)** — starts with `blp_live_`
2. Add it to your OpenClaw config:

```json
{ "blopus": { "apiKey": "blp_live_xxxxxxxxxxxxxxxxxxxx" } }
```

That's it. Both tools are available immediately.

## Capabilities in detail

### `blopus_search`

| Parameter | Use it when |
|---|---|
| `query` | The search itself. |
| `news_only` | The question is about an **event** — what happened, who announced what, market reaction, election results. |
| `freshness` | Bound recency: `pd` (24h), `pw`, `pm`, `p3m`, `p1y`, `all`. |
| `include_domains` / `exclude_domains` | Constrain to trusted sources, or filter noise. |
| `include_content` | Return full page text inline instead of snippets — one call instead of search + fetch. |
| `include_images` *(beta)* | Attach each result's hero image URL, plus width and height. **Free.** |
| `count` | Results to return. |

Every result carries `title`, `url`, `snippet`, `domain`, `published_at` and a relevance
`score`. With `include_images`, results also carry `image`, `image_w`, `image_h` — `image`
may be `null`, since not every page has one, so check before rendering.

### `blopus_fetch`

Pass `url` for one page, or `urls` for a batch of up to 50. **Always prefer the batch** — it
is a single lookup and costs the same as one search, whereas looping single fetches costs one
each. URLs not in the index come back in `failed_results` and are not charged.

## Cost model worth knowing

Results are billed **per block of 10**. `count: 1` and `count: 10` cost exactly the same, so
there is no reason for an agent to ask for fewer than 10. A 50-URL `blopus_fetch` batch costs
the same as one search. This is deliberate — agents shouldn't have to optimise against a
pricing model to avoid waste.

## Images (beta)

`include_images` is opt-in and free. It's off by default because it adds tokens most queries
don't need — but when a user asks to *see* something, turn it on and render the URLs directly:

```
![title](image)
```

Blopus stores image **URLs only** — never copies of the images themselves. Marked beta because
coverage is still growing across the index; the field is stable, the coverage is improving.

## Also available over MCP

OpenClaw speaks MCP natively, so you can skip the plugin entirely if you prefer:

```
https://mcp.blopus.ai/mcp
Authorization: Bearer blp_live_...
```

Same tools, same key.

## More

- **[blopus.ai](https://blopus.ai)** — free key, pricing, and how the index is built
- **[docs.blopus.ai](https://docs.blopus.ai)** — full API reference, Python and TypeScript SDKs
- Also ships as `blopus` on PyPI and npm, plus a hosted MCP endpoint

Questions or something broken? **[Open an issue](https://github.com/blopus-ai/openclaw-plugin/issues).**

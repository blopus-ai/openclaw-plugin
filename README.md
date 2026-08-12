# Blopus for OpenClaw

## Give OpenClaw the power of search

An OpenClaw agent without search is reasoning from memory alone — it can't tell you what
happened this morning, can't read the page you're asking about, and can't cite anything.

This plugin fixes that with two tools. Your agent **searches the live web**, **reads whole
pages** instead of guessing from snippets, and **pulls images** it can show you. All from an
index Blopus crawls itself — so when coverage or freshness needs to improve, we improve it,
rather than waiting on whoever we'd otherwise be reselling.

→ **[blopus.ai](https://blopus.ai)**

---

## How it compares

| Capability | **Blopus** | Brave | Tavily | Exa | Serper / SerpAPI |
|---|---|---|---|---|---|
| Runs its own search index | **✓** | ✓ | ~ | ✓ | — |
| Made for AI agents | **✓** | ~ | ✓ | ✓ | — |
| Pulls full pages, not just links | **✓** | — | ✓ | ✓ | — |
| Connects in one line | **✓** | ~ | ~ | ~ | — |
| Flat price · hard cap · no surprises | **✓** | — | — | — | ~ |
| Live usage, with alerts | **✓** | ~ | ~ | ~ | ~ |
| Image search *(beta)* | **~** | ✓ | ? | ? | ? |
| **Cost per 1,000 searches** | **~$1.65–2.33** | ~$3–9 | ~$5–8 | ~$7 | ~$0.30–1 |
| **Starts at** | **$7/mo** | ~$5 credit | $30/mo | usage-based | $25/mo |

✓ full · ~ partial or varies by tier · — not offered · ? unverified

Two rows matter most for agents. **Full page retrieval** — Brave doesn't offer it, so you end
up bolting a scraper onto your search calls. And **flat pricing with a hard cap** — an agent
in a loop is the fastest way to an unexpected bill, and a hard cap means that can't happen.

Current figures and tiers: **[blopus.ai](https://blopus.ai)**.

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

### 1. Generate an API key

1. Go to **[blopus.ai](https://blopus.ai)** and sign in (or create an account)
2. Open **API keys** in the dashboard
3. Click **Create API key**, give it a **Key name** — e.g. `openclaw` — and create it
4. Click **Reveal** and copy the key. It starts with `blp_live_`

Keep it somewhere safe: treat it like a password. You can create separate keys per
integration and revoke any of them from **Active keys** without affecting the others.

### 2. Enable the plugin in OpenClaw

Install it:

```bash
openclaw plugins install clawhub:@blopus-ai/openclaw-plugin
```

Then add your key to the plugin config:

```json
{
  "blopus": {
    "apiKey": "blp_live_xxxxxxxxxxxxxxxxxxxx"
  }
}
```

Optional — override the API base URL (rarely needed):

```json
{
  "blopus": {
    "apiKey": "blp_live_xxxxxxxxxxxxxxxxxxxx",
    "baseUrl": "https://api.blopus.ai"
  }
}
```

### 3. Check it works

Ask your agent to search for something recent — for example *"what happened in the markets
today?"* It should call `blopus_search` and come back with dated results and source domains.

**If it says Blopus needs an API key**, the plugin loaded but the config isn't being read —
confirm the key sits under a `blopus` object and that you restarted the agent after editing.

**If you get an HTTP 401**, the key is wrong or was revoked. Generate a new one under
**API keys → Create API key** and replace it.

**If you get an HTTP 429 or a quota error**, you've hit your plan's limit. Check **Overview**
and **Billing** in the dashboard.

## Capabilities in detail

### `blopus_search`

| Parameter | Use it when |
|---|---|
| `query` | The search itself. |
| `news_only` | The question is about an **event** — what happened, who announced what, market reaction, election results. |
| `freshness` | Bound recency: `pd` (24h), `pw`, `pm`, `p3m`, `p1y`, `all`. |
| `include_domains` / `exclude_domains` | Constrain to trusted sources, or filter noise. |
| `include_content` | Return full page text inline instead of snippets — one call instead of search + fetch. |
| `include_images` *(beta)* | Attach each result's hero image URL, plus width and height. |
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

`include_images` is opt-in. It's off by default because it adds tokens most queries
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

- **[blopus.ai](https://blopus.ai)** — API keys, pricing, and how the index is built
- **[docs.blopus.ai](https://docs.blopus.ai)** — full API reference, Python and TypeScript SDKs
- Also ships as `blopus` on PyPI and npm, plus a hosted MCP endpoint

Questions or something broken? **[Open an issue](https://github.com/blopus-ai/openclaw-plugin/issues).**

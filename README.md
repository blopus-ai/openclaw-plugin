<img src="https://raw.githubusercontent.com/blopus-ai/openclaw-plugin/master/icon.svg" alt="Blopus" width="72" height="72">

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
| Image search | **✓** *(beta)* | ✓ | ? | ? | ? |
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
| 🔍 | **`blopus_search`** | Web and news search. Freshness windows, domain include/exclude, inline full text, topic filters, minimum length. |
| 🖼️ | **`blopus_images`** *(beta)* | Search the image index itself. Ranks pictures **of** the subject, with captions written to be rendered. |
| 🏷️ | **`blopus_topics`** | The vocabulary for the `topics` filters. **Free** — it costs no credits. |
| 📄 | **`blopus_fetch`** | The complete text of any indexed page. Batch up to 50 URLs in a single call. |

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
| `topics` / `exclude_topics` | Scope to (or away from) whole subject areas, e.g. `['cybersecurity']`. Source-level: describes what a publication covers, not what an article is about. |
| `min_words` | Only return pages with at least N words. Use `120` when the user wants something to read — it drops tag listings and stubs. Leave it off for breaking news. |
| `count` | Results to return. |

Every result carries `title`, `url`, `snippet`, `domain`, `published_at` and a relevance
`score`. With `include_images`, results also carry `image`, `image_w`, `image_h` — `image`
may be `null`, since not every page has one, so check before rendering.

### `blopus_images`

| Parameter | Use it when |
|---|---|
| `query` | What the picture should show. |
| `count` | Images to return. Rounds up to a block of 10. |
| `max_syndication` | Cap on how many pages an image may appear on. Default `30`, which suppresses stock photography and site furniture. Lower it for something distinctive. |

Each result carries `caption`, `url`, `width`, `height`, `title`, `page_url`, `page_title` and
`domain`.

**Render with `caption`, not `title`.** `title` is the raw `alt` attribute and is empty or a
mangled filename on roughly a quarter of images; `caption` is written to be shown:

```
![caption](url)
```

Never let an agent invent an image URL — a guessed one 404s and renders as a broken image.

### `blopus_topics`

| Parameter | Use it when |
|---|---|
| `min_docs` | Hide labels too small to be useful. Default `1000` (~1,260 topics); `100000` gives ~110 of only the largest areas. |

Returns topic **names**, ready to pass straight to `topics` / `exclude_topics`.

**This call is free** — it is not billed. That is deliberate: topics match *exactly*, so a wrong
guess returns zero results that look identical to a genuine no-match. Charging for the lookup
would guarantee guessing. Call it once when you need a value you are unsure of and reuse the
answer; there is no reason to call it repeatedly.

A topic describes what a **publication** covers, not what an individual article is about.
`ai` means "pages from AI-focused sites" — broader and coarser than "pages about AI". Use it to
scope or de-noise a search, never instead of putting the subject in the query.

### `blopus_fetch`

Pass `url` for one page, or `urls` for a batch of up to 50. **Always prefer the batch** — it
is a single lookup and costs the same as one search, whereas looping single fetches costs one
each. URLs not in the index come back in `failed_results` and are not charged.

## Cost model worth knowing

`blopus_topics` is **not billed at all**. Everything else: results are billed **per block of 10**. `count: 1` and `count: 10` cost exactly the same, so
there is no reason for an agent to ask for fewer than 10. A 50-URL `blopus_fetch` batch costs
the same as one search. This is deliberate — agents shouldn't have to optimise against a
pricing model to avoid waste.

## Two different things called "images"

These are not the same feature, and picking the wrong one produces confidently wrong pictures:

| | `blopus_images` | `blopus_search` + `include_images` |
|---|---|---|
| What it searches | the **image index** | the **web index** |
| What you get back | pictures *of* the subject, with captions | whatever hero image those articles happened to use |
| Ask it for *"blue birds"* | photographs of blue birds | press photos from Blue Bird Corporation |
| Use it when | the user wants to **see** something | you are reading articles anyway and a thumbnail is a bonus |

So: *"show me…"*, *"what does X look like"*, *"find a photo of X"* → **`blopus_images`**.
Reading and summarising, with an illustration alongside → `include_images`.

Blopus stores image **URLs only** — never copies of the images themselves. Both are marked beta
because coverage is still growing across the index; the fields are stable.

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

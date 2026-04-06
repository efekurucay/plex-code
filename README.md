# plex-code

An **OpenAI-compatible local API proxy** that routes CLI coding assistants
(OpenCode, Claude Code, Gemini CLI, Aider…) through your existing
**Perplexity Pro / Max web session** instead of a paid API key.

```
CLI Tool  (OpenCode / Claude Code / …)
    │  POST /v1/chat/completions  (OpenAI format)
    ▼
perplexity-proxy  :8080  (FastAPI)
    │  Builds plain-text prompt  (tools → XML/JSON blocks)
    ▼
Playwright → perplexity.ai  (your logged-in browser session)
    │  Response text
    ▼
perplexity-proxy  →  parses ```tool_call``` blocks → SSE stream
    │
    ▼
CLI Tool  (executes tools locally, loops back)
```

---

## How tool calling works

Perplexity's web UI has no native function-calling API.
The proxy uses **prompt-engineering** (same technique as ReAct agents):

1. Tool schemas are injected as a plain-text system block.
2. Perplexity is instructed to output ` ```tool_call ``` ` JSON blocks.
3. The proxy parses those blocks and returns proper OpenAI `tool_calls` objects.
4. The CLI tool executes the tool *locally* and sends the result back.
5. Results are appended to history on the next API call → loop continues.

---

## Quick Start

```bash
git clone https://github.com/efekurucay/plex-code
cd plex-code
chmod +x start.sh
./start.sh
```

**First run**: Chromium opens visibly → log in to Perplexity → press ENTER.  
Session saved to `~/.pplx_proxy_session.json`.  
**Subsequent runs**: fully headless.

---

## Configure each tool

### OpenCode  (recommended)

Merge into `~/.opencode.json`:

```json
{
  "providers": {
    "perplexity-proxy": {
      "name": "Perplexity (via proxy)",
      "apiKey": "not-needed",
      "models": [{ "name": "perplexity-web", "id": "perplexity-web" }]
    }
  },
  "agents": {
    "coder": { "model": "perplexity-proxy/perplexity-web" }
  }
}
```

Then just run `opencode`.

### Claude Code

```bash
ANTHROPIC_BASE_URL=http://localhost:8080 \
ANTHROPIC_API_KEY=not-needed \
claude
```

### Gemini CLI / Aider / any OpenAI-compat tool

```bash
export OPENAI_BASE_URL=http://localhost:8080/v1
export OPENAI_API_KEY=not-needed
```

---

## Architecture

| File | Responsibility |
|------|----------------|
| `server.py` | FastAPI app; `/v1/chat/completions` + `/v1/messages` (Anthropic shim) |
| `browser.py` | Playwright session; login, asking, response extraction |
| `formatter.py` | Prompt builder; tool schema → text; tool_call block parser |
| `config.py` | Env-based config (host, port) |
| `start.sh` | One-command bootstrap |

---

## Known Limitations

| Limitation | Notes |
|------------|-------|
| Sequential requests | One request at a time (asyncio lock). Fine for interactive use. |
| Selector fragility | Perplexity UI updates may require tweaking `SELECTORS` in `browser.py`. |
| Long prompts | Very deep conversations may get silently truncated. |
| Rate limits | Perplexity still applies web rate limits to your account. |
| ToS | Automating the web UI violates Perplexity's ToS. Personal research only. |

---

## Updating selectors

If Perplexity updates their UI, edit the `SELECTORS` dict in `browser.py`:

```python
SELECTORS = {
    "textarea":    "textarea",
    "stop_button": "button[aria-label*='stop' i]",
    "answer":      [".prose", ".markdown", "main"],
}
```

Use Chrome DevTools on perplexity.ai to find updated selectors.

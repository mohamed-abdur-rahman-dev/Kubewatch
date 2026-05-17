# ADR 001 — Use Ollama directly, not LangChain

**Date:** 2026-05-17  
**Status:** Accepted

## Context

The AI insight feature needs to call a local LLM (llama3.2:1b) and optionally
fall back to OpenAI. Several framework options were available:
- LangChain / LangGraph
- LlamaIndex
- Direct HTTP to Ollama `/api/generate`

## Decision

Call Ollama's HTTP API directly using `requests`. Call OpenAI's API directly
using `requests`. No LLM framework.

## Reasoning

**Against LangChain:**
1. LangChain adds 50+ transitive dependencies for what is ultimately two HTTP
   POST calls. On 8GB RAM with a 1B model, every MB of memory matters.
2. LangChain abstractions (chains, agents, memory, tools) solve problems this
   project doesn't have. The prompt is 150 tokens; the response is 80 tokens.
3. LangChain's Ollama integration uses `/api/chat` (messages array format).
   llama3.2:1b performs significantly better with `/api/generate` (single
   prompt string) — the chat format adds overhead tokens that crowd out the
   actual content in a 512-token context window.
4. Debugging LangChain failures is harder than debugging a failed `requests.post()`.

**For direct HTTP:**
1. The entire Ollama integration is 40 lines. Any developer can read it in 2 minutes.
2. Zero new dependencies beyond `requests` (already in requirements.txt).
3. Full control over `keep_alive`, `num_ctx`, `num_batch`, and `num_predict` —
   critical for performance on resource-constrained hardware.
4. Easy to swap models: one env var (`OLLAMA_MODEL`).

## Trade-offs

**What we give up:** automatic retry logic, streaming token callbacks, and
provider-agnostic chain composition that LangChain provides.

**Why that's acceptable:** This is a demo MVP. The three retry attempts in
`_call_ollama` cover the only real failure mode (Ollama 503 on cold start).
Streaming is not needed since the frontend polls every 20s anyway.

## Revisit if

- The project needs multi-step reasoning (tool use, RAG, memory)
- More than 2 providers need to be supported
- Token streaming to the browser becomes a hard requirement

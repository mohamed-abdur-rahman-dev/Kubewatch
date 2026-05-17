# Architecture

## System Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│  Browser                                                                │
│  ┌───────────────────────────────────────────────────────────────────┐  │
│  │  apps/dashboard (Vite/React, port 3000)                          │  │
│  │  StatusBar · DependencyGraph · InsightPanel · PodTable           │  │
│  └────────────────────────┬──────────────────────────────────────────┘  │
└───────────────────────────│─────────────────────────────────────────────┘
                            │ HTTP polling (15s / 20s)
                            ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  apps/api (FastAPI, port 8000)                                         │
│                                                                         │
│  GET /pods          GET /graph         GET /anomalies                   │
│  GET /insights      WebSocket /live    GET /health                      │
│                                                                         │
│  collectors/k8s_collector.py  ←──── Kubernetes API                     │
│  analysis/rules.py                                                      │
│  analysis/dependency.py                                                 │
│  clients/ai_client.py  ────────────────────────────────┐               │
└────────────────────────────────────────────────────────│────────────────┘
                                                         │ HTTP POST /generate
                                                         ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  apps/ai-service (FastAPI, port 8001)                                  │
│                                                                         │
│  POST /generate     GET /health     GET /providers                      │
│                                                                         │
│  providers/ollama.py  ──────────────── Ollama (host, port 11434)       │
│  providers/openai.py  ──────────────── OpenAI API (optional)           │
│  prompts/  parsers/  cache/                                             │
└─────────────────────────────────────────────────────────────────────────┘
```

## Data Flow

1. Dashboard polls `/pods`, `/graph`, `/anomalies`, `/insights` every 15–20s.
2. API service fetches from the Kubernetes API and caches for 10s (pod cache).
3. `/insights` calls the ai-service via HTTP, which runs Ollama inference locally.
4. The ai-service caches the last LLM response for 20s (insight cache).
5. WebSocket `/live` pushes pods + anomalies every 15s to keep the StatusBar live.

## Why Three Services?

| Concern | Service | Why Separated |
|---|---|---|
| UI rendering | dashboard | Can be deployed to a CDN |
| k8s data collection | api | Needs kubeconfig; scales independently |
| LLM inference | ai-service | Can be co-located with Ollama; GPU affinity |

## Pod Cache Architecture

The `k8s_collector.py` module-level cache (`_pod_cache`) deduplicates the
burst of three simultaneous requests (`/pods`, `/graph`, `/insights`) that fire
when the dashboard first loads. Without it, the k8s API would receive 3×
`list_pod_for_all_namespaces` calls within milliseconds.

## Dependency Inference

Three methods run in order; each adds edges without overwriting earlier ones:

1. **Label match** — `depends-on: <app-label>` pod label → edge to matching pod
2. **Service selector** — `depends-on: <service-name>` resolved via k8s Service selectors
3. **Namespace group** — pods in same non-system namespace with no explicit deps get a mesh

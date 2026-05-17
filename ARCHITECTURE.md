# ARCHITECTURE.md — Diagrams & Data Contracts

> This file is the visual reference. Use it when building to ensure
> components connect correctly to each other.

---

## System Architecture

```
┌─────────────────────────────────────────────────────────┐
│              MINIKUBE CLUSTER (campus namespace)         │
│                                                          │
│  [parking-service]  [library-service]  [auth-service]   │
│  [attendance-service]                  [notif-worker]   │
│                                                          │
│  ┌──────────────────────────────────────────────────┐   │
│  │  metrics-server addon (kubectl top pods)         │   │
│  └──────────────────────────────────────────────────┘   │
└──────────────────────┬──────────────────────────────────┘
                       │
         kubernetes-python-client (reads:)
         - CoreV1Api → pods, services, events
         - CustomObjectsApi → metrics.k8s.io
                       │
                       ▼
┌─────────────────────────────────────────────────────────┐
│              PYTHON BACKEND (FastAPI)                    │
│                                                          │
│  collector.py ──► rules.py ──► llm.py                  │
│       │               │           │                      │
│   raw k8s data    anomaly list  insight text            │
│                       │                                  │
│  main.py (routes everything)                            │
│  ├── GET /pods      → PodMetric list + snapshot         │
│  ├── GET /anomalies → AnomalyEvent list                 │
│  ├── GET /graph     → nodes + edges                     │
│  ├── GET /insights  → InsightResponse (LLM + anomalies) │
│  └── WS  /live      → 15s refresh of pods + anomalies  │
└──────────────────────┬──────────────────────────────────┘
                       │  HTTP polling (Axios)
                       │  every 15s (pods/graph)
                       │  every 20s (insights)
                       ▼
┌─────────────────────────────────────────────────────────┐
│              REACT DASHBOARD                             │
│                                                          │
│  ┌──────────────────────────────────────────────────┐   │
│  │  StatusBar — total / healthy / warning / critical│   │
│  └──────────────────────────────────────────────────┘   │
│  ┌─────────────────────┐ ┌──────────────────────────┐   │
│  │  DependencyGraph     │ │  InsightPanel            │   │
│  │  (React Flow)        │ │  AI text + anomaly cards │   │
│  │  60% width           │ │  40% width               │   │
│  └─────────────────────┘ └──────────────────────────┘   │
│  ┌──────────────────────────────────────────────────┐   │
│  │  PodTable — live rows, color coded bars          │   │
│  └──────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
                       │
                  Ollama server
            http://localhost:11434
               llama3 model
```

---

## Data Contracts

### `GET /pods` Response

```json
{
  "pods": [
    {
      "name": "parking-service-7d9f-xyz",
      "namespace": "campus",
      "phase": "Running",
      "cpu_millicores": 380,
      "cpu_percent": 76.0,
      "memory_mb": 198.4,
      "memory_percent": 77.5,
      "restarts": 0,
      "age_minutes": 42,
      "labels": {
        "app": "parking-service",
        "tier": "backend",
        "depends-on": "auth-service"
      },
      "status": "warning"
    }
  ],
  "snapshot": {
    "total": 5,
    "healthy": 3,
    "warning": 2,
    "critical": 0
  }
}
```

---

### `GET /graph` Response

```json
{
  "nodes": [
    {
      "id": "parking-service-7d9f-xyz",
      "data": {
        "label": "parking-service",
        "namespace": "campus",
        "status": "warning",
        "cpu_percent": 76.0,
        "memory_percent": 77.5
      },
      "position": { "x": 300, "y": 150 }
    }
  ],
  "edges": [
    {
      "id": "parking-service-7d9f-xyz-auth-service-abc",
      "source": "parking-service-7d9f-xyz",
      "target": "auth-service-abc123",
      "type": "label_match",
      "animated": false
    }
  ]
}
```

---

### `GET /insights` Response

```json
{
  "insight": "The parking-service pod is consuming 76% of its CPU limit during what appears to be a query spike; this is creating network pressure on auth-service which handles validation for all 4 dependent services. If the spike continues for another 5 minutes, expect auth-service to start throttling requests — run kubectl scale deployment parking-service --replicas=2 -n campus to distribute the load immediately.",
  "anomalies": [
    {
      "pod": "parking-service-7d9f-xyz",
      "namespace": "campus",
      "issues": ["cpu_high"],
      "severity": "warning",
      "cpu_percent": 76.0,
      "memory_percent": 77.5,
      "restarts": 0
    }
  ],
  "snapshot": {
    "total": 5,
    "healthy": 3,
    "warning": 2,
    "critical": 0
  }
}
```

---

### `WebSocket /live` Message (sent every 15s)

```json
{
  "type": "update",
  "timestamp": "2025-05-11T09:15:30Z",
  "pods": [ ...PodMetric array... ],
  "anomalies": [ ...AnomalyEvent array... ],
  "snapshot": { "total": 5, "healthy": 3, "warning": 2, "critical": 0 }
}
```

---

## Dependency Graph — Expected Topology

```
[auth-service]  ◄── all 4 services depend on this
     ▲  ▲  ▲  ▲
     │  │  │  │
  [parking] [library] [attendance] [events]
       └─────────┬──────────┘
                 ▼
         (all write to postgres if deployed)

[notif-worker] — isolated node (no depends-on label)
```

**Edge types:**
- Solid blue line → `label_match` (service selector matches pod labels)
- Dashed gray line → `namespace_group` (same namespace, inferred team)
- Animated orange line → `time_correlation` (spike timing correlation)

---

## Rule Engine Decision Tree

```
For each pod:

  cpu_percent > 80%  ──YES──► add "cpu_critical"   → severity: critical
       │
      NO
       ▼
  cpu_percent > 60%  ──YES──► add "cpu_high"        → severity: warning
       │
      NO
       ▼
  mem_percent > 85%  ──YES──► add "memory_critical" → severity: critical
       │
      NO
       ▼
  mem_percent > 70%  ──YES──► add "memory_high"     → severity: warning
       │
      NO
       ▼
  restarts >= 5      ──YES──► add "crash_looping"   → severity: critical
       │
      NO
       ▼
  restarts >= 3      ──YES──► add "restarting"      → severity: warning
       │
      NO
       ▼
  mem > 80% AND      ──YES──► add "oom_risk"        → severity: critical
  restarts >= 2
       │
      NO
       ▼
  phase != Running   ──YES──► add "not_running"     → severity: warning
       │
      NO
       ▼
  [no anomaly for this pod]

Final pod status:
  any critical rule → status = "critical"
  any warning rule  → status = "warning"
  no rules fired    → status = "healthy"
```

---

## Ollama Prompt Structure

```
SYSTEM CONTEXT (always the same):
  Role: senior SRE AI assistant
  Format: plain paragraph, max 90 words

DYNAMIC SECTION 1: cluster snapshot (counts)
DYNAMIC SECTION 2: top 5 pods by CPU (JSON)
DYNAMIC SECTION 3: anomaly list (JSON)

INSTRUCTION:
  1. Root cause: which pod, why
  2. Blast radius: which services affected
  3. Action: one kubectl command

→ Response: one plain English paragraph
```

---

## Frontend Component Data Flow

```
App.jsx
  ├── usePods() hook     → polls /pods every 15s
  ├── useInsights() hook → polls /insights every 20s
  └── useGraph() hook    → polls /graph every 15s
         │
         ├── StatusBar    ← { snapshot } from usePods
         ├── PodTable     ← { pods } from usePods
         ├── InsightPanel ← { insight, anomalies } from useInsights
         └── DependencyGraph ← { nodes, edges } from useGraph
```

---

## Color System

| State | Background | Border | Text | Tailwind Classes |
|---|---|---|---|---|
| healthy | green-50 | green-500 | green-700 | `bg-green-50 border-green-500 text-green-700` |
| warning | amber-50 | amber-500 | amber-700 | `bg-amber-50 border-amber-500 text-amber-700` |
| critical | red-50 | red-500 | red-700 | `bg-red-50 border-red-500 text-red-700` |
| loading | gray-100 | gray-300 | gray-500 | `bg-gray-100 border-gray-300 text-gray-500` |
| AI panel | blue-950 | blue-700 | blue-100 | `bg-blue-950 border-blue-700 text-blue-100` |
| header | slate-900 | — | white | `bg-slate-900 text-white` |
| background | gray-950 | — | — | `bg-gray-950` |

---

## Port Map

| Service | Port | URL |
|---|---|---|
| FastAPI backend | 8000 | http://localhost:8000 |
| FastAPI docs | 8000 | http://localhost:8000/docs |
| React frontend | 3000 | http://localhost:3000 |
| Ollama | 11434 | http://localhost:11434 |
| Minikube dashboard | varies | `minikube dashboard` |

---

*End of ARCHITECTURE.md*

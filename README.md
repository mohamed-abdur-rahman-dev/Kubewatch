# AI Pod Observer

An AI-powered Kubernetes observability dashboard that watches a cluster in real time, detects anomalies with a rule engine, maps service dependencies, and explains everything in plain English using a local LLM (Ollama + llama3.2:1b).

---

## What This Is

A three-service monorepo: a React dashboard, a FastAPI data-collection backend, and a standalone AI inference service. Together they give you a live view of your Kubernetes cluster with AI-generated root-cause analysis.

---

## Prerequisites

| Tool | Download |
|---|---|
| Minikube | https://minikube.sigs.k8s.io/docs/start/ |
| kubectl | https://kubernetes.io/docs/tasks/tools/ |
| Ollama | https://ollama.com |
| Docker Desktop | https://docs.docker.com/get-docker/ |
| Node.js 20+ | https://nodejs.org/ |
| Python 3.11+ | https://www.python.org/downloads/ |

---

## Setup (run once)

```bash
# Pull the AI model (~800MB)
ollama pull llama3.2:1b

# Start Minikube
minikube start --cpus=2 --memory=3072

# Enable metrics-server (wait ~60 seconds after this)
minikube addons enable metrics-server
```

---

## Deploy Demo Apps

```bash
kubectl apply -f infrastructure/kubernetes/namespace.yaml
kubectl apply -f infrastructure/kubernetes/campus-apps/

# Watch pods start (takes ~60 seconds)
kubectl get pods -n campus --watch
```

All 5 pods should reach `Running` state before continuing.

---

## Run

### With Docker Compose (recommended)

```bash
docker compose up --build
```

- Dashboard: http://localhost:3000
- API: http://localhost:8000/docs
- AI Service: http://localhost:8001/docs

### Without Docker (local dev)

```bash
# Terminal 1 — AI service
cd apps/ai-service && pip install -r requirements.txt
uvicorn src.main:app --port 8001 --reload

# Terminal 2 — API
cd apps/api && pip install -r requirements.txt
uvicorn src.main:app --port 8000 --reload

# Terminal 3 — Dashboard
cd apps/dashboard && npm install && npm run dev
```

---

## Demo Scenarios

### 1 — CPU Spike
```bash
kubectl run stress-cpu --image=polinux/stress --namespace=campus -- stress --cpu 2 --timeout 120s
```
Expected: `stress-cpu` turns red in the graph within 20 seconds. AI names it as root cause.

### 2 — Memory Pressure
```bash
kubectl run stress-mem --image=polinux/stress --namespace=campus -- stress --vm 1 --vm-bytes 300M --timeout 120s
```
Expected: memory bar fills red. AI predicts OOM risk.

### 3 — Auth Cascade
```bash
kubectl scale deployment auth-service --replicas=0 --namespace=campus
```
Expected: auth-service disappears from graph. Dependent services show warning. AI identifies single point of failure.

Restore: `kubectl scale deployment auth-service --replicas=1 --namespace=campus`

### 4 — Recovery
```bash
kubectl delete pod stress-cpu stress-mem -n campus
```
Expected: dashboard returns to all green within 30 seconds.

**Or use the script:** `./infrastructure/scripts/stress-test.sh [cpu|memory|auth|recover]`

---

## API Reference

| Method | Path | Description |
|---|---|---|
| GET | `/health` | Liveness probe |
| GET | `/pods` | All pods + cluster snapshot |
| GET | `/anomalies` | Pods that triggered threshold rules |
| GET | `/graph` | Dependency graph nodes + edges |
| GET | `/insights` | AI analysis (cached 20s) |
| WS | `/live` | Push pods + anomalies every 15s |
| POST | `http://localhost:8001/generate` | Direct AI inference |

Swagger UI: http://localhost:8000/docs

---

## Architecture

```
┌──────────────────────────────────────────────────────────┐
│              MINIKUBE (campus namespace)                  │
│  parking-service  library-service  auth-service           │
│  attendance-service               notif-worker            │
└──────────���───────────┬─────────���─────────────────────────┘
                       │ kubernetes-python-client
                       ▼
┌──────────────────────────────────────────────────────────┐
│         apps/api — FastAPI :8000                          │
│  collectors/ → analysis/ → routes/                       │
└───────────────────────┬──────────────────────────────────┘
           │ HTTP        │ HTTP POST /generate
           │ polling     ▼
           │  ┌──────────────────────────────────────────┐
           │  │   apps/ai-service — FastAPI :8001         │
           │  │   providers/ → prompts/ → parsers/        │
           ��  │        │                                  │
           │  │        └──► Ollama :11434 (llama3.2:1b)  │
           │  └──────────────────────────────────────────┘
           ▼
┌──────────────────────────────────────────────────────────┐
│         apps/dashboard — Vite/React :3000                 │
│  StatusBar · DependencyGraph · InsightPanel · PodTable   │
└──────────────────────────────────────────────────────────┘
```

---

## Environment Variables

| Variable | Default | Service | Description |
|---|---|---|---|
| `OLLAMA_HOST` | `http://localhost:11434` | ai-service | Ollama server URL |
| `OLLAMA_MODEL` | `llama3.2:1b` | ai-service | LLM model name |
| `OPENAI_API_KEY` | *(blank)* | ai-service | Optional cloud fallback |
| `AI_SERVICE_URL` | `http://localhost:8001` | api | URL of ai-service |
| `COLLECT_INTERVAL` | `15` | api | Pod polling interval (seconds) |
| `INSIGHT_CACHE_TTL` | `20` | api | LLM response cache (seconds) |
| `VITE_API_URL` | `http://localhost:8000` | dashboard | Backend URL |

---

## Troubleshooting

**CPU/Memory bars show 0%**
```bash
minikube addons disable metrics-server
minikube addons enable metrics-server
# Wait 60 seconds, then:
kubectl top pods -n campus
```

**AI insight unavailable**
```bash
ollama list           # confirm llama3.2:1b is listed
ollama serve          # start Ollama if not running (Windows: runs automatically)
```

**`ai-service` not connecting**
```bash
curl http://localhost:8001/health   # should return {"status":"ok"}
curl http://localhost:8001/providers  # shows which provider is active
```

# CLAUDE.md — AI Pod Observer: Master Build Instructions

> Feed this file to Claude Code. It contains everything needed to build the
> complete MVP from scratch. Read every section before writing a single line.

---

## 0. What You Are Building

An AI-powered Kubernetes observability MVP called **AI Pod Observer**.

**In plain English:**
A system that watches a Kubernetes cluster, detects problems in real time,
maps how services depend on each other, and explains everything in plain
English using a local LLM (Ollama + llama3).

**Not building:** production monitoring, Prometheus pipelines, multi-agent
AI frameworks, Helm charts, or anything that takes more than 7 days.

**Is building:** 5 Python files + 1 React app that together create a
convincing, intelligent infrastructure demo.

---

## 1. Project Structure to Create

```
ai-pod-observer/
│
├── CLAUDE.md                   ← this file
├── README.md                   ← auto-generate at the end
├── docker-compose.yml          ← runs backend + frontend together
│
├── backend/
│   ├── main.py                 ← FastAPI app (entry point)
│   ├── collector.py            ← Kubernetes API data collection
│   ├── rules.py                ← rule engine + dependency inference
│   ├── llm.py                  ← Ollama LLM integration
│   ├── models.py               ← Pydantic data models
│   ├── requirements.txt
│   └── Dockerfile
│
├── frontend/
│   ├── package.json
│   ├── tailwind.config.js
│   ├── src/
│   │   ├── App.jsx             ← root component + layout
│   │   ├── index.jsx
│   │   ├── hooks/
│   │   │   ├── usePods.js      ← polls /pods every 15s
│   │   │   ├── useInsights.js  ← polls /insights every 20s
│   │   │   └── useGraph.js     ← polls /graph every 15s
│   │   └── components/
│   │       ├── PodTable.jsx    ← live pod health table
│   │       ├── DependencyGraph.jsx ← React Flow graph
│   │       ├── InsightPanel.jsx    ← AI text + anomaly cards
│   │       └── StatusBar.jsx       ← cluster health summary
│   └── Dockerfile
│
└── cluster/
    ├── namespace.yaml
    ├── parking-service.yaml
    ├── library-service.yaml
    ├── attendance-service.yaml
    ├── auth-service.yaml
    └── notif-worker.yaml
```

---

## 2. Build Order (Follow Exactly)

```
Step 1 → backend/models.py        (data shapes first)
Step 2 → backend/collector.py     (kubernetes data)
Step 3 → backend/rules.py         (rule engine)
Step 4 → backend/llm.py           (ollama integration)
Step 5 → backend/main.py          (fastapi glue)
Step 6 → backend/requirements.txt + Dockerfile
Step 7 → cluster/*.yaml           (demo app manifests)
Step 8 → frontend/src/hooks/*     (data fetching)
Step 9 → frontend/src/components/* (UI panels)
Step 10 → frontend/src/App.jsx    (layout)
Step 11 → docker-compose.yml
Step 12 → README.md
```

---

## 3. Backend Files — Full Specification

### 3.1 `backend/models.py`

Define Pydantic models for all data shapes the API serves.

```python
# Models needed:
# PodMetric        — one pod's live stats
# AnomalyEvent     — a flagged pod with reason list
# DependencyEdge   — from/to pod name pair
# ClusterSnapshot  — summary counts (total, healthy, warning, critical)
# InsightResponse  — LLM text + anomaly list + snapshot
# GraphResponse    — nodes list + edges list
```

**PodMetric fields:**
- `name: str`
- `namespace: str`
- `phase: str`           (Running / Pending / Failed / Unknown)
- `cpu_millicores: int`  (raw value from metrics API)
- `cpu_percent: float`   (cpu_millicores / cpu_limit * 100)
- `memory_mb: float`
- `memory_percent: float`
- `restarts: int`
- `age_minutes: int`
- `labels: dict`
- `status: str`          (healthy / warning / critical — computed)

**AnomalyEvent fields:**
- `pod: str`
- `namespace: str`
- `issues: list[str]`    (list of triggered rule names)
- `severity: str`        (warning / critical)
- `cpu_percent: float`
- `memory_percent: float`
- `restarts: int`

**DependencyEdge fields:**
- `id: str`              (f"{source}-{target}")
- `source: str`          (pod or service name)
- `target: str`
- `type: str`            (label_match / namespace_group / time_correlation)

### 3.2 `backend/collector.py`

This is the most important file. Connect to Kubernetes and pull live data.

**Function: `collect_pods() -> list[PodMetric]`**

Logic:
1. `config.load_kube_config()` — works with Minikube automatically
2. Use `client.CoreV1Api().list_pod_for_all_namespaces(watch=False)`
3. Use `client.CustomObjectsApi().list_cluster_custom_object("metrics.k8s.io","v1beta1","pods")`
   to get CPU/memory from metrics-server
4. Join pod list with metrics list on pod name
5. Parse CPU: `"450m"` → `450` millicores; `"2"` → `2000` millicores
6. Parse memory: `"312Mi"` → `312` MB; `"1Gi"` → `1024` MB
7. Get resource limits from `pod.spec.containers[0].resources.limits`
8. Calculate percentages: `cpu_millicores / cpu_limit_millicores * 100`
9. Count restarts from `container_status.restart_count`
10. Compute `status` field: critical if cpu>80% OR mem>85% OR restarts>=3, warning if cpu>60% OR mem>70%, else healthy

**Handle failures gracefully:**
- If metrics-server is not running, return pods with cpu_percent=0, memory_percent=0
- If kubeconfig not found, return empty list with log message
- Wrap everything in try/except, never crash the FastAPI server

**Function: `collect_services() -> list`**

Return raw service list from `client.CoreV1Api().list_service_for_all_namespaces()`

**Function: `collect_events() -> list`**

Return last 50 events from `client.CoreV1Api().list_event_for_all_namespaces()`
Filter to Warning events only, last 10 minutes.

### 3.3 `backend/rules.py`

Simple rule engine. No ML. No statistics. Just thresholds + label matching.

**RULES dict:**
```python
RULES = {
    "cpu_critical":     lambda p: p.cpu_percent > 80,
    "cpu_high":         lambda p: p.cpu_percent > 60,
    "memory_critical":  lambda p: p.memory_percent > 85,
    "memory_high":      lambda p: p.memory_percent > 70,
    "crash_looping":    lambda p: p.restarts >= 5,
    "restarting":       lambda p: p.restarts >= 3,
    "not_running":      lambda p: p.phase != "Running",
    "oom_risk":         lambda p: p.memory_percent > 80 and p.restarts >= 2,
}

SEVERITY = {
    "cpu_critical": "critical",
    "memory_critical": "critical",
    "crash_looping": "critical",
    "oom_risk": "critical",
    "cpu_high": "warning",
    "memory_high": "warning",
    "restarting": "warning",
    "not_running": "warning",
}
```

**Function: `analyze(pods: list[PodMetric]) -> list[AnomalyEvent]`**

For each pod, check all rules. If any fire, create AnomalyEvent.
Severity = max severity of triggered rules (critical > warning).

**Function: `infer_dependencies(pods: list, services: list) -> list[DependencyEdge]`**

Three methods:

Method 1 — Label matching (primary):
```
For each service:
  selector = service.spec.selector (dict of k:v)
  For each pod:
    pod_labels = pod.metadata.labels
    If ALL selector k:v match pod_labels → add edge (service.name → pod.name)
```

Method 2 — `depends-on` label:
```
For each pod:
  If pod has label "depends-on" → add edge (pod.name → label_value)
```

Method 3 — Namespace grouping:
```
Group pods by namespace.
If namespace has 2+ pods, add edges between them.
Skip kube-system and monitoring namespaces.
```

Deduplicate edges by (source, target) pair before returning.

**Function: `compute_snapshot(pods: list[PodMetric]) -> ClusterSnapshot`**

Count total, healthy, warning, critical from pod status fields.

### 3.4 `backend/llm.py`

Ollama integration. 30 lines. No LangChain. No CrewAI.

**Function: `get_insight(pods: list[PodMetric], anomalies: list[AnomalyEvent], snapshot: ClusterSnapshot) -> str`**

Build this prompt exactly:

```
You are an AI infrastructure analyst for a Kubernetes cluster.
Respond as a confident senior SRE. Be direct and specific.

CLUSTER STATE:
- Total pods: {snapshot.total}
- Healthy: {snapshot.healthy} | Warning: {snapshot.warning} | Critical: {snapshot.critical}

TOP PODS BY RESOURCE USAGE (highest CPU first):
{json of top 5 pods by cpu_percent}

DETECTED ANOMALIES:
{json of anomalies list, empty list if none}

YOUR RESPONSE MUST:
1. ROOT CAUSE: Name the specific pod causing the most concern and exactly why.
2. BLAST RADIUS: Which other services will be affected and how.
3. ACTION: Give one specific kubectl command the engineer should run right now.

If no anomalies exist, say the cluster is healthy and highlight which pod
to watch most closely and why.

Format: 3 sentences maximum. No bullet points. No headers. Plain paragraph.
Max 90 words. Be specific with pod names and numbers.
```

Send to Ollama:
```python
requests.post(
    "http://localhost:11434/api/generate",
    json={"model": "llama3", "prompt": prompt, "stream": False},
    timeout=30
)
```

If Ollama is not running, return:
`"AI insight unavailable — Ollama not running. Start with: ollama serve"`

### 3.5 `backend/main.py`

FastAPI application. CORS enabled for all origins (demo only).

**Endpoints:**

`GET /health`
Returns: `{"status": "ok", "version": "1.0.0"}`

`GET /pods`
Returns: `{"pods": [...PodMetric...], "snapshot": ClusterSnapshot}`
Calls: `collect_pods()`, `compute_snapshot()`

`GET /anomalies`
Returns: `{"anomalies": [...AnomalyEvent...], "count": int}`
Calls: `collect_pods()`, `analyze()`

`GET /graph`
Returns: `GraphResponse` with nodes and edges
Nodes format: `{"id": pod.name, "data": {"label": pod.name, "status": pod.status}, "position": {"x": 0, "y": 0}}`
Edges format: DependencyEdge list
Calls: `collect_pods()`, `collect_services()`, `infer_dependencies()`

`GET /insights`
Returns: `InsightResponse` (llm text + anomalies + snapshot)
Calls: all collector functions + analyze() + get_insight()
**Cache this for 20 seconds** — LLM calls are slow

`WebSocket /live`
Every 15 seconds push: `{"pods": [...], "snapshot": {...}, "anomalies": [...]}`
Use `asyncio.sleep(15)` loop

**Startup:**
Log that server is running and which endpoints are available.

### 3.6 `backend/requirements.txt`

```
fastapi==0.111.0
uvicorn[standard]==0.29.0
kubernetes==29.0.0
requests==2.31.0
pydantic==2.7.0
python-multipart==0.0.9
```

### 3.7 `backend/Dockerfile`

```dockerfile
FROM python:3.11-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000", "--reload"]
```

---

## 4. Cluster YAML Files — Full Specification

### 4.1 `cluster/namespace.yaml`

Create namespace `campus` with label `team: platform`.

### 4.2 Service Deployments

Create one YAML file per service. Each file contains:
- `Deployment` + `Service` in same file (separated by `---`)
- Namespace: `campus`
- Replicas: 1
- Resource requests and limits (intentionally tight — creates interesting AI alerts)
- Labels with `depends-on` for dependency inference

**parking-service:**
- image: `python:3.11-slim` (use command to run inline FastAPI)
- cpu limit: `500m`, memory limit: `256Mi`
- labels: `app: parking-service, tier: backend, depends-on: auth-service`
- Service port: 8001→8000
- Use this container command to simulate a real service:
  ```
  command: ["python", "-c"]
  args: ["
  import time, random, math
  while True:
      # simulate CPU work (sensor polling)
      x = sum(math.sqrt(i) for i in range(10000))
      time.sleep(0.1)
  "]
  ```

**library-service:**
- cpu limit: `300m`, memory limit: `512Mi`
- labels: `app: library-service, tier: backend, depends-on: auth-service`
- Container command: allocate ~200MB list in memory and loop
  ```
  command: ["python", "-c"]
  args: ["
  import time
  catalog = ['Book ' + str(i) * 100 for i in range(50000)]
  while True:
      results = [b for b in catalog if 'Book 1' in b]
      time.sleep(0.5)
  "]
  ```

**attendance-service:**
- cpu limit: `400m`, memory limit: `256Mi`
- labels: `app: attendance-service, tier: backend, depends-on: auth-service`
- Container command: write records in a loop (simulates PVC writes)
  ```
  command: ["python", "-c"]
  args: ["
  import time, random
  records = []
  while True:
      records.append({'student': random.randint(1,1000), 'time': time.time()})
      if len(records) > 10000:
          records = []
      time.sleep(0.05)
  "]
  ```

**auth-service:**
- cpu limit: `200m`, memory limit: `128Mi`  ← tight on purpose
- labels: `app: auth-service, tier: core`
- Container command: JWT validation simulation
  ```
  command: ["python", "-c"]
  args: ["
  import time, hashlib
  while True:
      token = hashlib.sha256(str(time.time()).encode()).hexdigest()
      time.sleep(0.01)
  "]
  ```

**notif-worker:**
- cpu limit: `200m`, memory limit: `384Mi`
- labels: `app: notif-worker, tier: worker`
- Container command: steady background loop
  ```
  command: ["python", "-c"]
  args: ["
  import time
  queue = []
  while True:
      queue.append('notification')
      if len(queue) > 100:
          queue.pop(0)
      time.sleep(1)
  "]
  ```

---

## 5. Frontend Files — Full Specification

Tech stack: React 18, React Flow, Recharts, Tailwind CSS, Axios

### 5.1 `frontend/src/hooks/usePods.js`

Custom hook that polls `GET /pods` every 15 seconds.
Returns: `{ pods, snapshot, loading, error }`
Use `useEffect` with `setInterval`. Clear interval on unmount.
Handle fetch errors gracefully (return last known data).

### 5.2 `frontend/src/hooks/useInsights.js`

Custom hook that polls `GET /insights` every 20 seconds.
Returns: `{ insight, anomalies, loading }`
Show loading state while LLM is thinking.

### 5.3 `frontend/src/hooks/useGraph.js`

Custom hook that polls `GET /graph` every 15 seconds.
Returns: `{ nodes, edges, loading }`
Auto-layout nodes in a circle using this formula:
```js
const angle = (index / total) * 2 * Math.PI;
const x = 300 + 200 * Math.cos(angle);
const y = 200 + 150 * Math.sin(angle);
```
Color nodes by pod status: critical=red, warning=amber, healthy=green.

### 5.4 `frontend/src/components/StatusBar.jsx`

Top bar showing cluster summary.

Display:
- Total pods count (blue badge)
- Healthy count (green badge)
- Warning count (amber badge)
- Critical count (red badge)
- Last updated timestamp

Pulse animation on the counts when data refreshes.
Show "LIVE" indicator that blinks every second.

### 5.5 `frontend/src/components/PodTable.jsx`

Props: `{ pods: PodMetric[] }`

Table columns:
1. **Status** — colored dot (🟢 green / 🟡 amber / 🔴 red) + phase text
2. **Pod Name** — truncate if longer than 30 chars, show namespace below in gray
3. **CPU** — progress bar (green→amber→red based on %) + number
4. **Memory** — progress bar + number
5. **Restarts** — badge, red if >= 3
6. **Age** — human readable (e.g. "5m", "2h")

Sort by: critical first, then warning, then healthy.
Animate row background on status change (red flash for new critical).
Show empty state message if no pods found.
Show "Connecting to cluster..." skeleton if loading.

**Progress bar colors:**
- < 60% → green (`bg-green-500`)
- 60–80% → amber (`bg-amber-500`)
- > 80% → red (`bg-red-500`)

### 5.6 `frontend/src/components/DependencyGraph.jsx`

Props: `{ nodes, edges }`

Use React Flow (`reactflow` package).
Node custom styling:
```js
// Node color by status in node.data.status
critical → red border + light red background
warning  → amber border + light amber background
healthy  → green border + light green background
```

Node shows: pod name (bold) + namespace (small gray text below)

Edge styling:
- `label_match` edges → solid line, blue
- `namespace_group` edges → dashed line, gray
- `time_correlation` edges → animated dashed line, orange

Enable: zoom, pan, minimap (bottom right), controls (bottom left).
Show "No dependency data yet" centered if edges is empty.

When a node status is `critical`, add a pulsing red ring animation around it.

### 5.7 `frontend/src/components/InsightPanel.jsx`

Props: `{ insight: string, anomalies: AnomalyEvent[], loading: bool }`

Layout (two sections):

**Top — AI Insight Box:**
- Header: "🤖 AI Analysis" in blue
- If loading: show animated typing dots `...`
- If loaded: show insight text with typewriter effect (reveal chars at 30ms each)
- Small footer: "Powered by Ollama llama3 · Local inference"

**Bottom — Anomaly Cards:**
- One card per anomaly
- Card color: critical=red tint, warning=amber tint
- Shows: pod name, severity badge, list of triggered rule names in plain English:
  - `cpu_critical` → "CPU usage critical (>80%)"
  - `memory_critical` → "Memory pressure critical (>85%)"
  - `crash_looping` → "Container crash-looping (5+ restarts)"
  - `restarting` → "Unstable — multiple restarts"
  - `oom_risk` → "OOM termination risk"
  - `not_running` → "Pod not in Running state"
- Shows: cpu%, memory%, restart count
- If no anomalies: show green card "✅ All pods healthy"

### 5.8 `frontend/src/App.jsx`

Main layout. Dark theme (`bg-gray-950 text-white`).

```
┌─────────────────────────────────────────────────────────┐
│  🔵 AI Pod Observer        [StatusBar — live counts]    │
├──────────────────────────────────────────┬──────────────┤
│                                          │              │
│         DependencyGraph                  │ InsightPanel │
│         (60% width)                      │ (40% width)  │
│                                          │              │
├──────────────────────────────────────────┴──────────────┤
│                  PodTable (full width)                   │
└─────────────────────────────────────────────────────────┘
```

Use CSS Grid for layout. All panels scroll independently.
Header: dark blue gradient background.

### 5.9 `frontend/package.json`

```json
{
  "name": "ai-pod-observer-dashboard",
  "version": "1.0.0",
  "dependencies": {
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "reactflow": "^11.11.3",
    "recharts": "^2.12.7",
    "axios": "^1.6.8",
    "react-scripts": "5.0.1"
  },
  "scripts": {
    "start": "react-scripts start",
    "build": "react-scripts build"
  }
}
```

---

## 6. docker-compose.yml

```yaml
version: "3.9"
services:
  backend:
    build: ./backend
    ports: ["8000:8000"]
    volumes:
      - ~/.kube:/root/.kube:ro     # share host kubeconfig with container
      - ~/.minikube:/root/.minikube:ro
    environment:
      - OLLAMA_HOST=host.docker.internal
    extra_hosts:
      - "host.docker.internal:host-gateway"

  frontend:
    build: ./frontend
    ports: ["3000:3000"]
    environment:
      - REACT_APP_API_URL=http://localhost:8000
    depends_on: [backend]
```

---

## 7. README.md to Generate

Include these sections:
1. **What This Is** — 2 sentences
2. **Prerequisites** — minikube, kubectl, ollama, docker, node
3. **Setup** — exact commands in order
4. **Deploy Demo Apps** — `kubectl apply -f cluster/`
5. **Run** — `docker-compose up`
6. **Demo Scenarios** — the 4 stress test commands
7. **API Reference** — table of all endpoints
8. **Architecture** — the ASCII diagram from Section 2 of the tech doc

---

## 8. Demo Scenarios (Test These Work)

After building, verify these four scenarios work end-to-end:

### Scenario 1 — CPU Spike
```bash
kubectl run stress-cpu \
  --image=polinux/stress \
  --namespace=campus \
  -- stress --cpu 2 --timeout 120s
```
Expected: `stress-cpu` appears in pod table with RED status.
Expected: AI insight mentions CPU spike and affected services.
Expected: Dependency graph shows new red node.

### Scenario 2 — Memory Pressure
```bash
kubectl run stress-mem \
  --image=polinux/stress \
  --namespace=campus \
  -- stress --vm 1 --vm-bytes 300M --timeout 120s
```
Expected: Memory bar fills red. AI predicts OOM risk.

### Scenario 3 — Auth Cascade
```bash
kubectl scale deployment auth-service \
  --replicas=0 \
  --namespace=campus
```
Expected: auth-service goes dark in graph.
Expected: All dependent services show warning (inference).
Expected: AI identifies auth as single point of failure.
Restore: `kubectl scale deployment auth-service --replicas=1 --namespace=campus`

### Scenario 4 — Recovery
```bash
kubectl delete pod stress-cpu -n campus 2>/dev/null; \
kubectl delete pod stress-mem -n campus 2>/dev/null
```
Expected: Dashboard returns to all green within 30 seconds.
Expected: AI says cluster is stable.

---

## 9. Environment Variables

| Variable | Default | Description |
|---|---|---|
| `OLLAMA_HOST` | `http://localhost:11434` | Ollama server URL |
| `OLLAMA_MODEL` | `llama3` | LLM model to use |
| `COLLECT_INTERVAL` | `15` | Seconds between collections |
| `INSIGHT_CACHE_TTL` | `20` | Seconds to cache LLM response |
| `REACT_APP_API_URL` | `http://localhost:8000` | Backend URL for frontend |
| `LOG_LEVEL` | `info` | Python logging level |

Read all from environment with sensible defaults. Never hardcode.

---

## 10. Error Handling Rules

Apply these rules everywhere:

1. **Kubernetes unreachable** → return empty data with `{"error": "cluster_unavailable"}`, do NOT crash
2. **Ollama timeout** → return the string `"AI insight temporarily unavailable."`, log warning
3. **metrics-server missing** → return pods with 0% CPU/memory, add field `"metrics_available": false`
4. **Pod has no resource limits set** → treat limit as 1000m CPU / 512Mi memory for percentage calc
5. **React fetch fails** → show last known data with a "⚠ Reconnecting..." badge, do NOT blank the screen
6. **Empty cluster** → show "No pods found. Is Minikube running?" with setup instructions

---

## 11. Code Quality Rules

- Python: type hints on all function signatures
- Python: docstrings on all public functions (one line)
- React: PropTypes on all components
- React: console.error for fetch failures, never console.log in production paths
- No hardcoded strings — use constants at the top of each file
- No TODO comments in final code — implement everything
- No placeholder/mock data — all data must come from real Kubernetes API

---

## 12. What NOT to Build

Do not add any of the following — they are out of scope:

- Prometheus or Grafana integration
- Authentication / login system
- Database (PostgreSQL, SQLite, Redis)
- Multi-node cluster support
- Helm charts
- CI/CD pipeline
- Kubernetes RBAC configurations
- Service mesh (Istio / Linkerd)
- Advanced LLM features (memory, chains, agents, tools)
- WebSockets for the graph endpoint (polling is fine)
- Historical data / time-series storage
- Alert notifications (email, Slack, PagerDuty)

If tempted to add any of these — stop. Ship the MVP first.

---

## 13. Verification Checklist

Before considering the build complete, verify every item:

**Backend:**
- [ ] `GET /health` returns 200
- [ ] `GET /pods` returns at least 5 pods when cluster is running
- [ ] `GET /pods` returns empty array (not error) when cluster is stopped
- [ ] `GET /anomalies` returns anomaly when stress pod is running
- [ ] `GET /graph` returns edges between campus namespace pods
- [ ] `GET /insights` returns non-empty string (even when Ollama offline)
- [ ] `WebSocket /live` sends data every 15s without disconnecting

**Frontend:**
- [ ] Pod table shows all pods with colored status badges
- [ ] CPU and memory bars animate smoothly on data refresh
- [ ] Dependency graph renders nodes and edges (may need to zoom out)
- [ ] AI panel shows typewriter text reveal effect
- [ ] Status bar counts match pod table counts
- [ ] All panels visible on 1440px wide screen without horizontal scroll
- [ ] "LIVE" indicator blinks in header

**Demo Scenarios:**
- [ ] Stress CPU pod appears red within 20 seconds of creation
- [ ] AI insight changes when anomaly is detected
- [ ] Scaling auth to 0 shows in graph within 20 seconds
- [ ] Deleting stress pods returns dashboard to green

---

## 14. File Size Targets

Keep files small and focused:

| File | Target Lines |
|---|---|
| `collector.py` | < 120 lines |
| `rules.py` | < 80 lines |
| `llm.py` | < 50 lines |
| `models.py` | < 60 lines |
| `main.py` | < 100 lines |
| `PodTable.jsx` | < 120 lines |
| `DependencyGraph.jsx` | < 100 lines |
| `InsightPanel.jsx` | < 100 lines |
| `App.jsx` | < 80 lines |
| Each hook | < 40 lines |

If a file exceeds 150 lines, split it.

---

*End of CLAUDE.md — Begin building from Step 1 in Section 2.*

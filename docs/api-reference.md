# API Reference

Base URL: `http://localhost:8000`

## Endpoints

| Method | Path | Description |
|---|---|---|
| GET | `/health` | Liveness probe |
| GET | `/config` | Non-secret runtime config (intervals, TTLs) |
| GET | `/pods` | All pods + cluster snapshot |
| GET | `/anomalies` | Pods that triggered threshold rules |
| GET | `/graph` | Dependency graph nodes + edges |
| GET | `/insights` | AI insight + anomalies + snapshot (cached 20s) |
| WS | `/live` | Push pods + anomalies every 15s |

---

### GET /health

```json
{"status": "ok", "version": "1.0.0"}
```

---

### GET /pods

```json
{
  "pods": [
    {
      "name": "auth-service-abc123",
      "namespace": "campus",
      "phase": "Running",
      "cpu_millicores": 180,
      "cpu_percent": 90.0,
      "memory_mb": 110.5,
      "memory_percent": 86.3,
      "restarts": 2,
      "age_minutes": 47,
      "labels": {"app": "auth-service", "tier": "core"},
      "status": "critical"
    }
  ],
  "snapshot": {"total": 5, "healthy": 3, "warning": 1, "critical": 1}
}
```

---

### GET /anomalies

```json
{
  "anomalies": [
    {
      "pod": "auth-service-abc123",
      "namespace": "campus",
      "issues": ["cpu_critical", "memory_critical"],
      "severity": "critical",
      "cpu_percent": 90.0,
      "memory_percent": 86.3,
      "restarts": 2,
      "age_minutes": 47
    }
  ],
  "count": 1
}
```

---

### GET /graph

```json
{
  "nodes": [
    {
      "id": "auth-service-abc123",
      "data": {"label": "auth-service-abc123", "status": "critical", "namespace": "campus"},
      "position": {"x": 0, "y": 0}
    }
  ],
  "edges": [
    {
      "id": "parking-service-xyz--auth-service-abc123",
      "source": "parking-service-xyz",
      "target": "auth-service-abc123",
      "type": "label_match"
    }
  ]
}
```

Edge types: `label_match`, `namespace_group`

---

### GET /insights

```json
{
  "insight": "ROOT CAUSE: auth-service has 90% CPU and 86% memory...",
  "anomalies": [...],
  "snapshot": {"total": 5, "healthy": 3, "warning": 1, "critical": 1}
}
```

---

## AI Service API

Base URL: `http://localhost:8001`

### POST /generate

Request:
```json
{
  "pods": [...],
  "anomalies": [...],
  "snapshot": {...},
  "provider": ""
}
```

`provider` is optional. Leave blank for auto-selection (OpenAI if key is set, Ollama otherwise).
Pass `"ollama"` or `"openai"` to force a specific provider.

Response:
```json
{
  "insight": "ROOT CAUSE: ...\nBLAST RADIUS: ...\nCMD: kubectl ...",
  "provider": "ollama",
  "sections": {
    "root_cause": "auth-service has 90% CPU — 2 restarts",
    "blast_radius": "parking-service and library-service will lose auth",
    "action": "kubectl logs auth-service-abc123 -n campus",
    "raw": "..."
  }
}
```

### GET /providers

```json
{
  "ollama": {"available": true, "host": "http://localhost:11434", "model": "llama3.2:1b"},
  "openai": {"available": false, "model": "gpt-4o-mini"},
  "default": "ollama"
}
```

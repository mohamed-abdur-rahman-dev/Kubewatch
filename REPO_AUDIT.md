# Repository Architecture Audit
**Date:** 2026-05-18 | **Scope:** Full repository | **Status:** Complete

---

## Executive Summary

The repository contains **three construction phases** that were never reconciled.
Phase 1 (`backend/` + `frontend/`) is the only running system. Phase 2 (`backend/app/`)
is an incomplete enterprise layer with a fake-data generator. Phase 3 (`apps/`) is the
correct canonical architecture that has never been deployed.

---

## CRITICAL Findings

### C-1: Fake Data Generator in kubernetes.py
**File:** `backend/app/services/kubernetes.py`
`import random` + `_init_metrics_buffer()` generate synthetic CPU/memory time-series.
Returns fabricated metrics with no indication data is synthetic.
**Status:** Resolved in Phase 0 — `backend/app/` deleted.

### C-2: Live API Key in Committed .env File
**File:** `backend/.env`
Real `OPENAI_API_KEY` stored in plaintext. File is NOT in `.gitignore` at the `backend/`
scope level. No git history exists yet so key was not previously committed — but must be
rotated before this repo is pushed to any remote.
**Status:** Handled in Phase 0 — `.env` replaced with `.env.example` (values redacted).
**Action required:** Rotate key at platform.openai.com/api-keys.

### C-3: Three Parallel Incompatible Backend Implementations
- `backend/` — flat files, original, currently running on port 8000
- `backend/app/` — "2.0.0-enterprise", incomplete, fake data, no entry point
- `apps/api/` — canonical monorepo structure, never deployed
**Status:** `backend/app/` deleted in Phase 0. Switch planned in Phase 3.

### C-4: Incompatible Data Model Contracts
| Field | `backend/` | `backend/app/` | `apps/api/` |
|---|---|---|---|
| Pod model | `PodMetric` | `PodInfo` | `PodMetric` |
| CPU field | `cpu_percent` | `cpu_usage` | `cpu_percent` |
| Memory field | `memory_percent` | `memory_usage` | `memory_percent` |
**Status:** `backend/app/` deleted. `backend/` and `apps/api/` agree — safe to migrate.

---

## HIGH Findings

### H-1: Two Active Frontend Directories Diverging
- `frontend/` — running, flat component structure, 4 ghost components
- `apps/dashboard/` — canonical, organized subdirs, utility layer extracted
**Status:** Switch planned in Phase 2.

### H-2: Duplicate Kubernetes YAMLs
- `cluster/` — canonical per CLAUDE.md
- `infrastructure/kubernetes/campus-apps/` — copy-paste duplicate
**Status:** Archive + delete planned in Phase 4.

### H-3: Two docker-compose.yml Files
- `./docker-compose.yml` — canonical, currently used
- `./infrastructure/docker/docker-compose.yml` — duplicate, different env vars
**Status:** Delete planned in Phase 4.

### H-4: Undeclared Dependencies in backend/app
`pydantic_settings` and `openai` used but not in any `requirements.txt`.
**Status:** Resolved — `backend/app/` deleted in Phase 0.

### H-5: Two Python Runtimes Active
`backend/__pycache__` = CPython 3.14. `backend/app/__pycache__` = CPython 3.11.
**Status:** `backend/app/` deleted in Phase 0 eliminates the 3.11 pycache.

### H-6: AI Session Artifacts at Repo Root
`CONTEXT.md`, `TASKS.md`, `PROMPTS.md`, `DEMO_SCRIPT.md` — LLM scaffolding, not docs.
**Status:** Deleted in Phase 0. `ARCHITECTURE.md` retained (real content).

---

## MEDIUM Findings

### M-1: Ghost Components in frontend/src/components/
Not imported anywhere: `AiInsightsPanel.jsx`, `AlertCards.jsx`, `MetricsCards.jsx`,
`PodMetricsTable.jsx`, `ProviderToggle.jsx`.
`ErrorBoundary.jsx` — not imported but structurally valid; evaluated separately.
**Status:** Deleted in Phase 0 after import verification.

### M-2: Unused Hook and Context
`hooks/useObservability.js` — not imported by any component (imports `services/api.js` internally).
`context/ToastContext.jsx` — no Provider in component tree.
`services/api.js` — only imported by `useObservability.js` (dead chain).
**Status:** Deleted in Phase 0.

### M-3: Design Token Duplication
`frontend/src/styles/design-tokens.js` vs `apps/dashboard/src/styles/tokens.js`.
Neither actively imported (colors inlined as Tailwind classes).
**Status:** `frontend/` deprecated; `apps/dashboard/` tokens.js retained.

### M-4: Virtual Environments Inside Repository
`.venv/` at root, `backend/venv/` — not repo content.
**Status:** Added to `.gitignore` in Phase 0. Directories left on disk (not deleted — may be active).

### M-5: Empty Directory
`k8s/` — no content, no README.
**Status:** Deleted in Phase 0.

---

## LOW Findings

### L-1: Binary Screenshots in docs/
`docs/Screenshot_2026-05-17-*.jpg` — Android browser screenshots, not referenced.
**Status:** Deleted in Phase 0.

### L-2: backend/app Has No Entry Point
No runnable `main.py` at execution root, no Dockerfile, no start script.
**Status:** Resolved — deleted in Phase 0.

### L-3: Inconsistent CORS Strategy Across Backends
Three different `allow_origins` configurations. Resolved when backends consolidated.

### L-4: NODE_W Constant Triplicated
Defined in `useGraph.js` (frontend), `useGraph.js` (dashboard), `DependencyGraph.jsx` (dashboard).
**Status:** Deduplicate in Phase 4.

---

## Canonical Architecture Decision Record

| Layer | Canonical Path | Deprecated Path |
|---|---|---|
| Frontend | `apps/dashboard/` | `frontend/` |
| Backend API | `apps/api/` | `backend/` |
| AI Service | `apps/ai-service/` | — |
| K8s Manifests | `cluster/` | `infrastructure/kubernetes/campus-apps/` |
| docker-compose | `./docker-compose.yml` | `infrastructure/docker/docker-compose.yml` |

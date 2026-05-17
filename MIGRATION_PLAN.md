# Migration Plan: Single Canonical Architecture
**Date:** 2026-05-18 | **Architect:** Principal Engineer | **Status:** In Progress

---

## Objective

Consolidate three-phase architectural entropy into one canonical frontend, one canonical
backend, and one canonical AI service — with zero regression and full rollback safety
at every step.

---

## Canonical Decisions

| Layer | Canonical | Deprecated | Action |
|---|---|---|---|
| Frontend | `apps/dashboard/` | `frontend/` | Phase 2 → Phase 4 delete |
| Backend | `apps/api/` | `backend/` | Phase 3 → Phase 4 delete |
| AI Service | `apps/ai-service/` | — | Already canonical |
| K8s | `cluster/` | `infrastructure/kubernetes/campus-apps/` | Phase 4 |
| docker-compose | `./docker-compose.yml` | `infrastructure/docker/docker-compose.yml` | Phase 4 |

---

## Phase Dependency Graph

```
Phase 0 (safe deletions)
    │
    ├──────────────────────────┐
    │                          │
Phase 1                    Phase 2
(verify apps/api parallel) (switch frontend)
    │                          │
    └──────────┬───────────────┘
               │
           Phase 3
       (switch backend)
               │
           Phase 4
         (final cleanup)
```

---

## Phase 0 — Safe Cleanup
**Status:** In Progress
**Risk:** Zero — no running code paths touched

### Tasks
- [x] Initialize git repository
- [x] Write REPO_AUDIT.md, MIGRATION_PLAN.md, CLEANUP_LOG.md
- [ ] Delete `backend/app/` (fake data generator, never run)
- [ ] Handle `backend/.env` → `backend/.env.example` (**KEY MUST BE ROTATED FIRST**)
- [ ] Delete ghost components in `frontend/src/components/`
- [ ] Delete unused hook, context, service in `frontend/src/`
- [ ] Delete `k8s/` (empty)
- [ ] Delete `docs/Screenshot_*.jpg` (binary junk)
- [ ] Delete root AI artifacts (`CONTEXT.md`, `TASKS.md`, `PROMPTS.md`, `DEMO_SCRIPT.md`)
- [ ] Update `.gitignore`
- [ ] Create baseline git commit

### Gate
Run `docker-compose up` → `localhost:3000` and `localhost:8000` respond identically
to pre-Phase-0 baseline.

### Rollback
`git revert <commit-hash>` for any individual deletion.

---

## Phase 1 — Backend Parallel Verification
**Status:** Pending
**Risk:** Low — no traffic switched

### Tasks
- [ ] Start `apps/api/` on port 8002 via `docker-compose.override.yml` (not committed)
- [ ] Compare `/pods`, `/anomalies`, `/graph`, `/insights`, `/health` responses
- [ ] Verify WebSocket `/live` sends on correct interval
- [ ] Verify `ai_client.py` → `apps/ai-service/` chain works
- [ ] Document and fix any behavioral differences (only in `apps/api/`)

### Gate
`apps/api/` and `backend/` return equivalent data across 3 consecutive poll cycles.

### Rollback
Stop port-8002 service. `docker-compose.yml` unchanged.

---

## Phase 2 — Frontend Switchover
**Status:** Pending
**Depends on:** Phase 0

### Tasks
- [ ] Verify `apps/dashboard/` builds cleanly (`npm run build`)
- [ ] Confirm `VITE_API_URL=http://localhost:8000` in `apps/dashboard/.env`
- [ ] Update root `docker-compose.yml`: frontend build context `./apps/dashboard`
- [ ] Run and verify full UI: graph, pods, insights, resize handle, brand
- [ ] Pass all CLAUDE.md §13 checklist items

### Gate
All CLAUDE.md §13 items pass. Brand shows "Kubewatch". No JS console errors.

### Rollback
`git revert` the docker-compose change. `frontend/` still on disk.

---

## Phase 3 — Backend Switchover
**Status:** Pending
**Depends on:** Phase 1 + Phase 2

### Tasks
- [ ] Update root `docker-compose.yml`: backend build context `./apps/api`
- [ ] Add `apps/ai-service/` as service on port 8001 if not present
- [ ] Verify env var parity with `backend/.env.example`
- [ ] Full verification pass (same as Phase 2 gate)
- [ ] Monitor 48 hours
- [ ] Tag commit as `v1.0-canonical-backend`

### Gate
48h uptime, all endpoints responding, no regressions vs Phase 2 baseline.

### Rollback
`git revert` docker-compose commit. `backend/` still on disk.

---

## Phase 4 — Final Cleanup
**Status:** Pending
**Depends on:** Phase 3 stable 48h + `v1.0-canonical-backend` tag exists

### Tasks
- [ ] Delete `frontend/`
- [ ] Delete `backend/`
- [ ] Archive `infrastructure/kubernetes/campus-apps/` → `_archive/`
- [ ] Delete `_archive/` after CI verification
- [ ] Delete `infrastructure/docker/docker-compose.yml`
- [ ] Deduplicate `NODE_W` constant (three locations → one)
- [ ] Delete `apps/dashboard/src/styles/tokens.js` if unused

### Gate
Full E2E test pass. `tree` output matches target structure.

---

## Target Structure (End State)

```
ai-k8s-observability/
├── CLAUDE.md
├── ARCHITECTURE.md
├── README.md
├── MIGRATION_PLAN.md
├── REPO_AUDIT.md
├── docker-compose.yml
├── .env.example
├── .gitignore
├── apps/
│   ├── api/
│   ├── ai-service/
│   └── dashboard/
├── cluster/
└── scripts/
```

---

## Rollback Safety Principles

1. Nothing deleted until replacement runs stably in production
2. Each change is one atomic `git commit` — reversible with `git revert`
3. Port numbers never change (8000, 3000) — only what serves them changes
4. System is stateless — no data migration required
5. Git tag at Phase 3 completion = recovery point before final deletions

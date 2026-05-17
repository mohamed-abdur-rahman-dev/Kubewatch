# Frontend Onboarding

## Stack

- **React 18** + **Vite** (NOT Create React App — env vars use `VITE_` prefix)
- **React Flow** — dependency graph
- **Tailwind CSS** — utility-first styling
- **Axios** — HTTP polling via `apps/dashboard/src/services/api.js`

## Local Dev

```bash
cd apps/dashboard
cp .env.example .env          # sets VITE_API_URL=http://localhost:8000
npm install
npm run dev                   # starts Vite on port 3000
```

The backend API must be running at port 8000 for data to load.

## Key Files

| File | Purpose |
|---|---|
| `src/App.jsx` | Root layout — grid of StatusBar, DependencyGraph, InsightPanel, PodTable |
| `src/hooks/usePods.js` | Polls `/pods` every 15s, returns `{ pods, snapshot, loading }` |
| `src/hooks/useInsights.js` | Polls `/insights` every 20s |
| `src/hooks/useGraph.js` | Polls `/graph` every 15s, runs BFS layout algorithm |
| `src/services/api.js` | All `axios.get()` calls — single source of truth for URLs |
| `src/utils/constants.js` | `STATUS_TOKENS`, `RULE_LABELS`, `STATUS_ORDER` |
| `src/utils/formatters.js` | `formatAge()`, `formatCpu()`, `formatBytes()` |

## Component Tree

```
App
├── layout/StatusBar      — cluster health counts + LIVE blink
├── graph/DependencyGraph — React Flow nodes (colored by status)
│   ├── graph/GraphLegend
│   └── graph/NodeDrawer  — click-to-inspect pod drawer
├── insights/InsightPanel — AI text + anomaly cards
│   ├── insights/RiskDial
│   ├── insights/AnomalyCard
│   └── insights/ActionBlock
└── pods/PodTable         — sortable pod health table
    ├── pods/PodRow
    └── pods/NamespaceFilter
```

## Adding a New Component

1. Create in the appropriate sub-folder under `src/components/`
2. Import `STATUS_TOKENS` from `../../utils/constants` for status colors
3. Import `formatAge` from `../../utils/formatters` if you need human-readable ages
4. Add PropTypes — the linter enforces them

## Environment Variables

Only `VITE_` prefixed vars are visible to browser code. Never put secrets here.

| Variable | Default | Description |
|---|---|---|
| `VITE_API_URL` | `http://localhost:8000` | Backend API base URL |

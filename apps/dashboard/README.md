# Dashboard — Frontend Team

React 18 + Vite dashboard for AI Pod Observer. Visualises Kubernetes pod health,
dependency graphs, and AI-generated insights in real time.

## Quick Start

```bash
cd apps/dashboard
cp .env.example .env          # set VITE_API_URL to the API service address
npm install
npm run dev                   # http://localhost:3000
```

## Environment Variables

| Variable                | Default                   | Description                            |
|-------------------------|---------------------------|----------------------------------------|
| `VITE_API_URL`          | `http://localhost:8000`   | API service base URL                   |
| `VITE_POLL_INTERVAL_MS` | `15000`                   | Pod/graph poll interval (ms)           |
| `VITE_INSIGHT_POLL_MS`  | `60000`                   | Ollama insight poll interval (ms)      |

## Component Structure

```
src/components/
  graph/        → DependencyGraph.jsx  GraphLegend.jsx  NodeDrawer.jsx
  insights/     → InsightPanel.jsx  AnomalyCard.jsx  ActionBlock.jsx  RiskDial.jsx
  pods/         → PodTable.jsx  PodRow.jsx  NamespaceFilter.jsx
  layout/       → StatusBar.jsx  AppShell.jsx

src/hooks/      → usePods.js  useInsights.js  useGraph.js  useConfig.js
src/services/   → api.js  (centralised axios client)
src/utils/      → formatters.js  constants.js
src/styles/     → index.css  tokens.js
```

## Adding a New Component

1. Create in the correct subfolder (graph/, insights/, pods/, layout/)
2. Use PropTypes for all props
3. Import shared constants from `../../utils/constants`
4. Import formatters from `../../utils/formatters`
5. Never hardcode color values — use `STATUS_TOKENS` from constants.js

## API Contract

The dashboard calls the API service (apps/api). See [docs/api-reference.md](../../docs/api-reference.md).

| Endpoint               | Hook / Client       | Poll Interval |
|------------------------|---------------------|---------------|
| `GET /pods`            | usePods             | 15s           |
| `GET /graph`           | useGraph            | 15s           |
| `GET /insights`        | useInsights         | 60s (Ollama)  |
| `GET /config`          | useConfig           | once on mount |

## Build for Production

```bash
npm run build           # outputs to dist/
# or via Docker:
docker build --build-arg VITE_API_URL=http://api:8000 -t dashboard .
```

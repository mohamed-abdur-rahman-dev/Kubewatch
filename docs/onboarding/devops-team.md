# DevOps Onboarding

## Prerequisites

| Tool | Version | Install |
|---|---|---|
| Minikube | ≥ 1.32 | https://minikube.sigs.k8s.io/docs/start/ |
| kubectl | ≥ 1.29 | https://kubernetes.io/docs/tasks/tools/ |
| Ollama | ≥ 0.3 | https://ollama.com |
| Docker | ≥ 24 | https://docs.docker.com/get-docker/ |
| Node.js | ≥ 20 | https://nodejs.org |
| Python | ≥ 3.11 | https://www.python.org/downloads/ |

## One-Command Setup

```bash
chmod +x infrastructure/scripts/setup.sh
./infrastructure/scripts/setup.sh
```

This script:
1. Verifies all prerequisites are installed
2. Pulls the `llama3.2:1b` Ollama model
3. Starts Minikube (2 CPUs, 3GB RAM)
4. Enables the metrics-server addon
5. Deploys the campus namespace + 5 demo apps
6. Runs `npm install` for the dashboard

## Running the Stack

### Docker Compose (recommended)

```bash
docker compose -f infrastructure/docker/docker-compose.yml up --build
```

Services:
- Dashboard: http://localhost:3000
- API: http://localhost:8000
- AI Service: http://localhost:8001

### Local Dev (without Docker)

```bash
# Terminal 1 — AI service
cd apps/ai-service && uvicorn src.main:app --reload --port 8001

# Terminal 2 — API
cd apps/api && uvicorn src.main:app --reload --port 8000

# Terminal 3 — Dashboard
cd apps/dashboard && npm run dev
```

## Kubernetes Setup

```bash
# Apply all resources
kubectl apply -f infrastructure/kubernetes/namespace.yaml
kubectl apply -f infrastructure/kubernetes/campus-apps/

# Verify pods are running
kubectl get pods -n campus

# Check metrics-server is working
kubectl top pods -n campus
```

## Demo Scenarios

```bash
chmod +x infrastructure/scripts/stress-test.sh

./infrastructure/scripts/stress-test.sh cpu     # CPU spike
./infrastructure/scripts/stress-test.sh memory  # Memory pressure
./infrastructure/scripts/stress-test.sh auth    # Auth cascade
./infrastructure/scripts/stress-test.sh recover # Clean up all
```

## Teardown

```bash
chmod +x infrastructure/scripts/teardown.sh
./infrastructure/scripts/teardown.sh
```

## Ollama Tips

- Keep Ollama running before starting the stack: `ollama serve`
- The model stays loaded between calls (`keep_alive: -1`) — first inference
  takes 60-90s on 8GB RAM, subsequent calls take 5-15s
- To check if Ollama is running: `curl http://localhost:11434/api/tags`

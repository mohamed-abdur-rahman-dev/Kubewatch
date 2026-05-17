#!/usr/bin/env bash
# setup.sh — First-time environment setup for AI Pod Observer.
# Run once after cloning. Idempotent — safe to re-run.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/../.." && pwd)"

echo "=== AI Pod Observer — Setup ==="

# ── 1. Check prerequisites ──────────────────────────────────────────────────
check_cmd() {
  if ! command -v "$1" &>/dev/null; then
    echo "ERROR: '$1' not found. Install it first: $2"
    exit 1
  fi
}

check_cmd minikube "https://minikube.sigs.k8s.io/docs/start/"
check_cmd kubectl   "https://kubernetes.io/docs/tasks/tools/"
check_cmd ollama    "https://ollama.com"
check_cmd docker    "https://docs.docker.com/get-docker/"
check_cmd node      "https://nodejs.org"
check_cmd python3   "https://www.python.org/downloads/"

echo "✓ All prerequisites found"

# ── 2. Pull Ollama model ────────────────────────────────────────────────────
echo "Pulling llama3.2:1b (this takes 1-2 minutes on first run)..."
ollama pull llama3.2:1b
echo "✓ Model ready"

# ── 3. Start Minikube ───────────────────────────────────────────────────────
if ! minikube status --format='{{.Host}}' 2>/dev/null | grep -q "Running"; then
  echo "Starting Minikube..."
  minikube start --cpus=2 --memory=3072 --driver=docker
fi
echo "✓ Minikube running"

# ── 4. Enable metrics-server ───────────────────────────────────────────────
minikube addons enable metrics-server
echo "✓ metrics-server enabled"

# ── 5. Deploy campus apps ──────────────────────────────────────────────────
kubectl apply -f "${ROOT_DIR}/infrastructure/kubernetes/namespace.yaml"
kubectl apply -f "${ROOT_DIR}/infrastructure/kubernetes/campus-apps/"
echo "✓ Campus apps deployed"

# ── 6. Install frontend deps ───────────────────────────────────────────────
echo "Installing dashboard dependencies..."
cd "${ROOT_DIR}/apps/dashboard" && npm install --silent
echo "✓ npm install done"

echo ""
echo "=== Setup complete ==="
echo "Next: run infrastructure/scripts/start.sh  OR  docker compose -f infrastructure/docker/docker-compose.yml up"

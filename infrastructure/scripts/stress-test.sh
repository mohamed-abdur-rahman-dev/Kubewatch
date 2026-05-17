#!/usr/bin/env bash
# stress-test.sh — Inject the four demo scenarios from CLAUDE.md §8.
# Each scenario is a function; pass a name to run just that one,
# or run without args to get a menu.
set -euo pipefail

NAMESPACE="campus"

usage() {
  echo "Usage: $0 [cpu|memory|auth|recover|all]"
  echo ""
  echo "  cpu     — Spawn a CPU stress pod (2 cores, 120s)"
  echo "  memory  — Spawn a memory stress pod (300MB, 120s)"
  echo "  auth    — Scale auth-service to 0 replicas (cascade scenario)"
  echo "  recover — Delete stress pods and restore auth-service"
  echo "  all     — Run cpu + memory (auth is manual — requires restore step)"
  exit 1
}

scenario_cpu() {
  echo "==> Scenario 1: CPU Spike"
  kubectl run stress-cpu \
    --image=polinux/stress \
    --namespace="${NAMESPACE}" \
    -- stress --cpu 2 --timeout 120s
  echo "✓ stress-cpu pod created. Dashboard should turn red within 20s."
}

scenario_memory() {
  echo "==> Scenario 2: Memory Pressure"
  kubectl run stress-mem \
    --image=polinux/stress \
    --namespace="${NAMESPACE}" \
    -- stress --vm 1 --vm-bytes 300M --timeout 120s
  echo "✓ stress-mem pod created. Memory bar should fill red within 20s."
}

scenario_auth() {
  echo "==> Scenario 3: Auth Cascade"
  kubectl scale deployment auth-service --replicas=0 --namespace="${NAMESPACE}"
  echo "✓ auth-service scaled to 0. Watch graph — dependent services should warn."
  echo "   Restore with: $0 recover"
}

scenario_recover() {
  echo "==> Scenario 4: Recovery"
  kubectl delete pod stress-cpu -n "${NAMESPACE}" 2>/dev/null || true
  kubectl delete pod stress-mem -n "${NAMESPACE}" 2>/dev/null || true
  kubectl scale deployment auth-service --replicas=1 --namespace="${NAMESPACE}" 2>/dev/null || true
  echo "✓ Stress pods deleted, auth-service restored. Dashboard should go green within 30s."
}

case "${1:-}" in
  cpu)     scenario_cpu    ;;
  memory)  scenario_memory ;;
  auth)    scenario_auth   ;;
  recover) scenario_recover ;;
  all)
    scenario_cpu
    scenario_memory
    ;;
  *)       usage ;;
esac

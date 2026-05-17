#!/usr/bin/env bash
# teardown.sh — Clean up everything created by this project.
# WARNING: This deletes the campus namespace and all pods inside it.
set -euo pipefail

echo "=== AI Pod Observer — Teardown ==="
echo "This will delete:"
echo "  - campus namespace and all pods"
echo "  - stress-cpu and stress-mem pods (if present)"
echo ""
read -r -p "Continue? [y/N] " confirm
if [[ "${confirm}" != "y" && "${confirm}" != "Y" ]]; then
  echo "Aborted."
  exit 0
fi

kubectl delete namespace campus --ignore-not-found
echo "✓ campus namespace deleted"

# metrics-server is a minikube addon — disable rather than delete
minikube addons disable metrics-server 2>/dev/null || true
echo "✓ metrics-server addon disabled"

echo ""
echo "=== Teardown complete ==="
echo "To stop Minikube: minikube stop"
echo "To delete Minikube cluster: minikube delete"

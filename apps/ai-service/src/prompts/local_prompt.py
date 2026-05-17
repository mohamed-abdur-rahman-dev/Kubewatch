"""
local_prompt.py — Ultra-short prompt for llama3.2:1b.

Template and builder extracted verbatim from backend/llm.py.
Kept under 150 tokens total so the 512-token context window has room for
the model's 80-token response without truncation.
"""
from typing import List


# Deliberately terse — 1B models perform better with fewer tokens in the prompt.
LOCAL_PROMPT_TEMPLATE = """\
Cluster: {total} pods | {critical} critical | {warning} warning

Issues:
{issues}

Reply with exactly 3 lines, no other text:
ROOT CAUSE: [pod] has [problem]
BLAST RADIUS: [affected services or 'none']
CMD: kubectl [command] -n [namespace]
"""


def build_local_prompt(pods: list, anomalies: list, snapshot) -> str:
    """Build a short structured prompt for small local models (llama3.2:1b)."""
    if anomalies:
        lines = [
            f"- {a['pod']}: {a['severity']}, {a['cpu_percent']:.0f}% CPU, "
            f"{a['memory_percent']:.0f}% mem, {a['restarts']} restarts"
            for a in anomalies[:2]
        ]
        issues = "\n".join(lines)
    else:
        pods_sorted = sorted(pods, key=lambda p: p.get("cpu_percent", 0), reverse=True)
        top  = pods_sorted[0] if pods_sorted else {}
        name = top.get("name", "unknown")
        cpu  = top.get("cpu_percent", 0)
        issues = f"- {name}: {cpu:.0f}% CPU (highest, all pods healthy)"
    return LOCAL_PROMPT_TEMPLATE.format(
        total=snapshot.get("total", 0),
        critical=snapshot.get("critical", 0),
        warning=snapshot.get("warning", 0),
        issues=issues,
    )

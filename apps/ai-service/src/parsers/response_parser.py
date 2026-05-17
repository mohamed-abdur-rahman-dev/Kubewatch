"""
response_parser.py — Extract structured sections from raw LLM output.

parse_insight_sections() is extracted verbatim from backend/llm.py.
1B models sometimes output noisy text before/after the three required lines;
this parser is tolerant of that — it scans all lines and picks the first
match for each prefix.
"""
from typing import Dict


def parse_insight_sections(raw: str) -> Dict[str, str]:
    """
    Parse raw LLM output into ROOT CAUSE / BLAST RADIUS / CMD sections.

    Returns a dict with keys: root_cause, blast_radius, action, raw.
    Handles imperfect output from small models (extra text, wrong casing).
    """
    result: Dict[str, str] = {
        "root_cause":   "",
        "blast_radius": "",
        "action":       "",
        "raw":          raw,
    }

    # Fallback strings from the providers — don't try to parse them as LLM output.
    if not raw or raw.startswith((
        "ERROR", "TIMEOUT", "Local AI", "OpenAI",
        "AI analysis", "AI insight",
    )):
        result["root_cause"] = raw
        return result

    for line in raw.strip().splitlines():
        line  = line.strip()
        upper = line.upper()
        if upper.startswith("ROOT CAUSE:") and not result["root_cause"]:
            result["root_cause"] = line.split(":", 1)[-1].strip()
        elif upper.startswith("BLAST RADIUS:") and not result["blast_radius"]:
            result["blast_radius"] = line.split(":", 1)[-1].strip()
        elif upper.startswith(("CMD:", "ACTION:")) and not result["action"]:
            result["action"] = line.split(":", 1)[-1].strip()

    # If the model didn't follow the format at all, use the raw text as root_cause.
    if not result["root_cause"]:
        result["root_cause"] = raw[:200]

    return result

"""
test_parsers.py — Unit tests for response_parser.py.

No LLM calls needed — tests feed raw strings directly to the parser
and check that the structured sections come out correctly.
"""
from src.parsers.response_parser import parse_insight_sections


class TestParseInsightSections:
    def test_parses_well_formed_output(self):
        raw = (
            "ROOT CAUSE: auth-service-abc has high CPU — 4 restarts, 90% CPU, 40% memory\n"
            "BLAST RADIUS: parking-service and library-service will lose auth tokens\n"
            "CMD: kubectl logs auth-service-abc -n campus"
        )
        result = parse_insight_sections(raw)
        assert "auth-service-abc" in result["root_cause"]
        assert "parking-service"  in result["blast_radius"]
        assert result["action"].startswith("kubectl")

    def test_parses_lowercase_prefixes(self):
        raw = "root cause: oom\nblast radius: none\ncmd: kubectl get pods"
        result = parse_insight_sections(raw)
        assert result["root_cause"] == "oom"
        assert result["action"] == "kubectl get pods"

    def test_fallback_string_goes_to_root_cause(self):
        raw = "Local AI unavailable — Ollama not running. Start with: ollama serve"
        result = parse_insight_sections(raw)
        assert result["root_cause"] == raw
        assert result["blast_radius"] == ""

    def test_garbled_output_uses_raw_as_root_cause(self):
        raw = "The model is thinking..."
        result = parse_insight_sections(raw)
        assert result["root_cause"] == raw

    def test_empty_string_returns_empty_sections(self):
        result = parse_insight_sections("")
        assert result["root_cause"] == ""
        assert result["raw"] == ""

    def test_action_prefix_cmd_and_action_both_work(self):
        raw = "ROOT CAUSE: x\nBLAST RADIUS: y\nACTION: kubectl describe pod x"
        result = parse_insight_sections(raw)
        assert result["action"] == "kubectl describe pod x"

"""
test_providers.py — Unit tests for Ollama and OpenAI providers.

Uses unittest.mock to avoid real HTTP calls. Tests verify:
- Successful response parsing
- Each error condition returns a graceful fallback string (not an exception)
"""
from unittest.mock import MagicMock, patch

import pytest

from src.providers.ollama  import OllamaProvider
from src.providers.openai  import OpenAIProvider


class TestOllamaProvider:
    def setup_method(self):
        self.provider = OllamaProvider()

    def test_successful_response_returns_text(self):
        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_resp.json.return_value = {"response": "ROOT CAUSE: ok"}
        with patch("src.providers.ollama._session.post", return_value=mock_resp):
            result = self.provider.generate("test prompt")
        assert result.text == "ROOT CAUSE: ok"
        assert result.success is True
        assert result.provider == "ollama"

    def test_connection_error_returns_fallback(self):
        import requests
        with patch("src.providers.ollama._session.post", side_effect=requests.exceptions.ConnectionError):
            result = self.provider.generate("test prompt")
        assert "Ollama not running" in result.text
        assert result.success is False

    def test_timeout_returns_fallback(self):
        import requests
        with patch("src.providers.ollama._session.post", side_effect=requests.exceptions.Timeout):
            result = self.provider.generate("test prompt")
        assert "timed out" in result.text.lower()
        assert result.success is False

    def test_model_not_found_500_returns_pull_hint(self):
        mock_resp = MagicMock()
        mock_resp.status_code = 500
        mock_resp.text = '{"error": "model not found, try ollama pull llama3.2:1b"}'
        with patch("src.providers.ollama._session.post", return_value=mock_resp):
            result = self.provider.generate("test prompt")
        assert "ollama pull" in result.text
        assert result.success is False


class TestOpenAIProvider:
    def setup_method(self):
        self.provider = OpenAIProvider()

    def test_missing_api_key_returns_config_message(self):
        with patch("src.providers.openai.config") as mock_cfg:
            mock_cfg.openai_api_key = ""
            result = self.provider.generate("test")
        assert "API key" in result.text
        assert result.success is False

    def test_successful_response_returns_content(self):
        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_resp.json.return_value = {
            "choices": [{"message": {"content": "ROOT CAUSE: all healthy"}}]
        }
        import requests
        with patch("src.providers.openai.config") as mock_cfg:
            mock_cfg.openai_api_key = "sk-test"
            mock_cfg.openai_model   = "gpt-4o-mini"
            mock_cfg.openai_timeout = 30
            with patch("src.providers.openai.requests.post", return_value=mock_resp):
                result = self.provider.generate("test prompt")
        assert result.text == "ROOT CAUSE: all healthy"
        assert result.success is True

    def test_quota_exceeded_returns_switch_message(self):
        mock_resp = MagicMock()
        mock_resp.status_code = 429
        import requests as req
        with patch("src.providers.openai.config") as mock_cfg:
            mock_cfg.openai_api_key = "sk-test"
            mock_cfg.openai_model   = "gpt-4o-mini"
            mock_cfg.openai_timeout = 30
            with patch("src.providers.openai.requests.post", return_value=mock_resp):
                result = self.provider.generate("test prompt")
        assert "quota" in result.text.lower()
        assert result.success is False

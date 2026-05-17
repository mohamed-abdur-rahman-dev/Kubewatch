"""
base.py — Abstract base for LLM providers.

Each provider (Ollama, OpenAI) implements LLMProvider so the service can
swap backends without changing any calling code.
"""
from abc import ABC, abstractmethod
from dataclasses import dataclass


@dataclass
class LLMResponse:
    """Normalised response from any LLM backend."""
    text:     str
    provider: str  # 'ollama' | 'openai'
    success:  bool = True


class LLMProvider(ABC):
    """Interface every LLM provider must implement."""

    @property
    @abstractmethod
    def name(self) -> str:
        """Short identifier: 'ollama' | 'openai'."""

    @abstractmethod
    def generate(self, prompt: str) -> LLMResponse:
        """Send *prompt* to the LLM and return a normalised response."""

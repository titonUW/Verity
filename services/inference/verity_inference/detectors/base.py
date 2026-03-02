"""
Base detector interface and registry.
"""

from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from enum import Enum
from typing import Any, ClassVar


class Verdict(str, Enum):
    """Detection verdict."""
    AI = "ai"
    HUMAN = "human"
    UNCERTAIN = "uncertain"
    UNAVAILABLE = "unavailable"


@dataclass
class DetectorResult:
    """Result from a detector."""

    name: str
    verdict: Verdict
    confidence: float  # 0.0 to 1.0
    model_version: str
    processing_time_ms: int = 0
    error: str | None = None
    metadata: dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> dict[str, Any]:
        """Convert to dictionary for JSON serialization."""
        return {
            "name": self.name,
            "verdict": self.verdict.value,
            "confidence": self.confidence,
            "model_version": self.model_version,
            "processing_time_ms": self.processing_time_ms,
            "error": self.error,
            "metadata": self.metadata,
        }


class BaseDetector(ABC):
    """Abstract base class for all detectors."""

    name: ClassVar[str]
    version: ClassVar[str]
    media_types: ClassVar[list[str]]  # ["image", "video", "audio", "text"]

    def __init__(self):
        self._loaded = False

    @property
    def available(self) -> bool:
        """Check if detector is available (weights present, etc.)."""
        return True

    @abstractmethod
    async def load(self) -> None:
        """Load model weights and initialize detector."""
        pass

    @abstractmethod
    async def detect(self, data: bytes, options: dict[str, Any] | None = None) -> DetectorResult:
        """
        Run detection on input data.

        Args:
            data: Raw bytes of the media content
            options: Optional detection options

        Returns:
            DetectorResult with verdict, confidence, and metadata
        """
        pass

    async def unload(self) -> None:
        """Unload model to free memory."""
        self._loaded = False

    def unavailable_result(self, reason: str) -> DetectorResult:
        """Return an unavailable result with reason."""
        return DetectorResult(
            name=self.name,
            verdict=Verdict.UNAVAILABLE,
            confidence=0.0,
            model_version=self.version,
            error=reason,
        )


class DetectorRegistry:
    """Registry for detector instances."""

    _detectors: dict[str, BaseDetector] = {}

    @classmethod
    def register(cls, detector: BaseDetector) -> None:
        """Register a detector instance."""
        cls._detectors[detector.name] = detector

    @classmethod
    def get(cls, name: str) -> BaseDetector | None:
        """Get a detector by name."""
        return cls._detectors.get(name)

    @classmethod
    def get_all(cls) -> dict[str, BaseDetector]:
        """Get all registered detectors."""
        return cls._detectors.copy()

    @classmethod
    def get_for_media_type(cls, media_type: str) -> list[BaseDetector]:
        """Get all detectors that support a media type."""
        return [
            d for d in cls._detectors.values()
            if media_type in d.media_types and d.available
        ]

    @classmethod
    def clear(cls) -> None:
        """Clear all registered detectors (for testing)."""
        cls._detectors.clear()

"""
Watermark Detection

Detects AI watermarks embedded in content (e.g., SynthID for text).
"""

import re
import time
from dataclasses import dataclass
from typing import Any

from ..config import get_settings


@dataclass
class WatermarkResult:
    """Watermark detection result."""
    detected: bool = False
    type: str | None = None
    confidence: float = 0.0
    source: str | None = None
    error: str | None = None
    processing_time_ms: int = 0

    def to_dict(self) -> dict[str, Any]:
        return {
            "detected": self.detected,
            "type": self.type,
            "confidence": self.confidence,
            "source": self.source,
            "error": self.error,
        }


class WatermarkDetector:
    """
    Detect AI watermarks in content.

    Supports detection of:
    - SynthID (Google's text watermarking)
    - Image watermarks (basic detection)
    - Audio watermarks (placeholder)

    Limitations:
    - SynthID detection requires specific analysis
    - Many watermarks are designed to be invisible
    - False negatives are common
    """

    def __init__(self):
        self._loaded = False

    async def load(self) -> None:
        """Initialize watermark detection."""
        self._loaded = True

    async def detect_text_watermark(self, text: str) -> WatermarkResult:
        """
        Detect watermarks in text (e.g., SynthID).

        SynthID uses statistical patterns in token selection that are
        invisible to humans but detectable with analysis.

        This is a basic heuristic implementation - full SynthID detection
        would require the original model weights.
        """
        start_time = time.time()

        settings = get_settings()
        if not settings.enable_watermark_detection:
            return WatermarkResult(
                detected=False,
                error="Watermark detection disabled",
                processing_time_ms=int((time.time() - start_time) * 1000),
            )

        try:
            # Basic heuristics for watermark detection
            # Real SynthID detection would analyze token distributions

            # Check for unusual Unicode characters sometimes used in watermarks
            unusual_chars = self._check_unusual_unicode(text)

            # Check for zero-width characters (sometimes used for marking)
            zero_width = self._check_zero_width(text)

            # Statistical analysis of character/word patterns
            pattern_score = self._analyze_patterns(text)

            # Combine signals
            if zero_width or unusual_chars:
                return WatermarkResult(
                    detected=True,
                    type="unicode_marking",
                    confidence=0.8,
                    source="Unknown",
                    processing_time_ms=int((time.time() - start_time) * 1000),
                )

            if pattern_score > 0.7:
                return WatermarkResult(
                    detected=True,
                    type="statistical_pattern",
                    confidence=pattern_score,
                    source="Unknown (possible SynthID)",
                    processing_time_ms=int((time.time() - start_time) * 1000),
                )

            return WatermarkResult(
                detected=False,
                processing_time_ms=int((time.time() - start_time) * 1000),
            )

        except Exception as e:
            return WatermarkResult(
                detected=False,
                error=str(e),
                processing_time_ms=int((time.time() - start_time) * 1000),
            )

    async def detect_image_watermark(self, data: bytes) -> WatermarkResult:
        """
        Detect watermarks in images.

        Checks for:
        - Visible watermarks (text overlay)
        - Invisible watermarks (DCT domain)
        - Metadata-based markers
        """
        start_time = time.time()

        settings = get_settings()
        if not settings.enable_watermark_detection:
            return WatermarkResult(
                detected=False,
                error="Watermark detection disabled",
                processing_time_ms=int((time.time() - start_time) * 1000),
            )

        try:
            from PIL import Image
            import io

            image = Image.open(io.BytesIO(data))

            # Check EXIF/metadata for AI markers
            exif_marker = self._check_image_metadata(image)

            # Basic visible watermark detection (placeholder)
            # Full implementation would use OCR and edge detection

            if exif_marker:
                return WatermarkResult(
                    detected=True,
                    type="metadata_marker",
                    confidence=0.9,
                    source=exif_marker,
                    processing_time_ms=int((time.time() - start_time) * 1000),
                )

            return WatermarkResult(
                detected=False,
                processing_time_ms=int((time.time() - start_time) * 1000),
            )

        except Exception as e:
            return WatermarkResult(
                detected=False,
                error=str(e),
                processing_time_ms=int((time.time() - start_time) * 1000),
            )

    def _check_unusual_unicode(self, text: str) -> bool:
        """Check for unusual Unicode characters that might be watermarks."""
        # Characters sometimes used for invisible marking
        watermark_chars = [
            '\u200b',  # Zero-width space
            '\u200c',  # Zero-width non-joiner
            '\u200d',  # Zero-width joiner
            '\ufeff',  # BOM
            '\u2060',  # Word joiner
            '\u180e',  # Mongolian vowel separator
        ]

        for char in watermark_chars:
            if char in text:
                return True

        return False

    def _check_zero_width(self, text: str) -> bool:
        """Check for zero-width characters."""
        # Count zero-width characters
        zero_width_pattern = r'[\u200b\u200c\u200d\u2060\ufeff]'
        matches = re.findall(zero_width_pattern, text)

        # More than a few is suspicious
        return len(matches) > 3

    def _analyze_patterns(self, text: str) -> float:
        """
        Analyze text for statistical patterns that might indicate watermarking.

        This is a simplified heuristic - real detection would need more
        sophisticated analysis.
        """
        if len(text) < 100:
            return 0.0

        # Check for unusual spacing patterns
        spaces = text.count(' ')
        words = len(text.split())

        if words > 0:
            space_ratio = spaces / words
            # Normal ratio is close to 1
            if space_ratio > 1.5 or space_ratio < 0.5:
                return 0.6

        # Check for unusual punctuation distribution
        punct_count = sum(1 for c in text if c in '.,;:!?')
        if words > 0 and punct_count / words > 0.3:
            return 0.5

        return 0.0

    def _check_image_metadata(self, image) -> str | None:
        """Check image metadata for AI generation markers."""
        try:
            # Check EXIF data
            exif = image.getexif() if hasattr(image, 'getexif') else None

            if exif:
                # Look for software tags indicating AI generation
                software_tag = exif.get(305)  # Software tag
                if software_tag:
                    ai_indicators = ['dall-e', 'midjourney', 'stable diffusion', 'ai', 'generated']
                    if any(ind in str(software_tag).lower() for ind in ai_indicators):
                        return str(software_tag)

            # Check for PNG text chunks
            if hasattr(image, 'info'):
                info = image.info
                for key in ['parameters', 'Comment', 'prompt', 'workflow']:
                    if key in info:
                        value = str(info[key]).lower()
                        if any(ind in value for ind in ['stable diffusion', 'comfyui', 'automatic1111']):
                            return f"{key}: AI generation metadata found"

            return None

        except Exception:
            return None

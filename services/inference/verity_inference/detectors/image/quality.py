"""
Image Quality Detector

Analyzes image quality metrics like blur, compression artifacts, and resolution.
"""

import io
import time
from typing import Any, ClassVar

import numpy as np
from PIL import Image

from ..base import BaseDetector, DetectorResult, Verdict


class ImageQualityDetector(BaseDetector):
    """
    Detect image quality issues.

    Checks for:
    - Blur/sharpness
    - Compression artifacts (JPEG blocking)
    - Resolution adequacy
    - File format issues
    """

    name: ClassVar[str] = "quality"
    version: ClassVar[str] = "1.0.0"
    media_types: ClassVar[list[str]] = ["image"]

    async def load(self) -> None:
        """No model loading needed for quality checks."""
        self._loaded = True

    async def detect(self, data: bytes, options: dict[str, Any] | None = None) -> DetectorResult:
        """Analyze image quality metrics."""
        start_time = time.time()

        try:
            # Load image
            image = Image.open(io.BytesIO(data))
            rgb_image = image.convert("RGB")

            # Run quality checks
            blur_score = self._detect_blur(rgb_image)
            compression_score = self._detect_compression_artifacts(rgb_image)
            resolution = image.size

            # Calculate overall quality score (higher = better quality)
            # Invert because low blur and low compression = high quality
            quality_score = 1.0 - (blur_score * 0.5 + compression_score * 0.5)

            # Determine verdict (for quality, we report issues)
            # High quality = "human" (no issues), low quality = "ai" (has issues)
            if quality_score >= 0.7:
                verdict = Verdict.HUMAN  # Good quality
            elif quality_score <= 0.3:
                verdict = Verdict.AI  # Poor quality / has issues
            else:
                verdict = Verdict.UNCERTAIN

            processing_time = int((time.time() - start_time) * 1000)

            return DetectorResult(
                name=self.name,
                verdict=verdict,
                confidence=quality_score,
                model_version=self.version,
                processing_time_ms=processing_time,
                metadata={
                    "blur_score": blur_score,
                    "compression_score": compression_score,
                    "resolution": {"width": resolution[0], "height": resolution[1]},
                    "format": image.format,
                    "mode": image.mode,
                    "is_high_quality": quality_score >= 0.7,
                },
            )

        except Exception as e:
            processing_time = int((time.time() - start_time) * 1000)
            return DetectorResult(
                name=self.name,
                verdict=Verdict.UNAVAILABLE,
                confidence=0.0,
                model_version=self.version,
                processing_time_ms=processing_time,
                error=str(e),
            )

    def _detect_blur(self, image: Image.Image) -> float:
        """
        Detect blur using Laplacian variance.
        Higher variance = sharper image = lower blur score.
        """
        gray = np.array(image.convert("L")).astype(float)

        # Laplacian approximation using simple kernel
        # [0, 1, 0]
        # [1, -4, 1]
        # [0, 1, 0]
        laplacian = (
            -4 * gray[1:-1, 1:-1]
            + gray[:-2, 1:-1]  # top
            + gray[2:, 1:-1]   # bottom
            + gray[1:-1, :-2]  # left
            + gray[1:-1, 2:]   # right
        )

        variance = np.var(laplacian)

        # Normalize: low variance = blurry
        # Typical sharp images have variance > 500
        blur_score = 1.0 - min(variance / 500.0, 1.0)

        return blur_score

    def _detect_compression_artifacts(self, image: Image.Image) -> float:
        """
        Detect JPEG compression artifacts (blocking).
        Checks for 8x8 block patterns typical of heavy JPEG compression.
        """
        gray = np.array(image.convert("L")).astype(float)
        h, w = gray.shape

        # Look for 8x8 block boundaries
        block_size = 8
        artifacts = []

        # Check horizontal block boundaries
        for x in range(block_size, w - block_size, block_size):
            left = gray[:, x-1]
            right = gray[:, x]
            diff = np.abs(left - right)
            artifacts.append(np.mean(diff))

        # Check vertical block boundaries
        for y in range(block_size, h - block_size, block_size):
            top = gray[y-1, :]
            bottom = gray[y, :]
            diff = np.abs(top - bottom)
            artifacts.append(np.mean(diff))

        if not artifacts:
            return 0.0

        # Compare block boundary differences to overall image variation
        overall_diff_h = np.mean(np.abs(np.diff(gray, axis=1)))
        overall_diff_v = np.mean(np.abs(np.diff(gray, axis=0)))
        overall_diff = (overall_diff_h + overall_diff_v) / 2

        block_boundary_diff = np.mean(artifacts)

        # If block boundaries have higher differences, it indicates compression
        if overall_diff > 0:
            ratio = block_boundary_diff / overall_diff
            # Ratio close to 1 = uniform (no blocking)
            # Ratio > 1 = more artifacts at block boundaries
            compression_score = max(0, min((ratio - 1.0) * 2, 1.0))
        else:
            compression_score = 0.0

        return compression_score

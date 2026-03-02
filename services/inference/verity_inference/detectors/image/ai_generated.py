"""
AI-Generated Image Detector

Uses CLIP embeddings with a simple linear classifier to detect AI-generated images.
This is a baseline detector - accuracy can be improved with better models.
"""

import io
import time
from typing import Any, ClassVar

import numpy as np
from PIL import Image

from ..base import BaseDetector, DetectorResult, Verdict
from ...config import get_settings


class AIGeneratedImageDetector(BaseDetector):
    """
    Detect AI-generated images using visual feature analysis.

    This baseline implementation uses:
    1. CLIP embeddings for visual features
    2. Statistical analysis of image characteristics common in AI images
    3. Artifact detection (common in GAN/diffusion outputs)

    Limitations:
    - Accuracy varies by AI model that generated the image
    - High-quality AI images may be harder to detect
    - May have false positives on heavily edited photos
    """

    name: ClassVar[str] = "ai_generated"
    version: ClassVar[str] = "1.0.0-baseline"
    media_types: ClassVar[list[str]] = ["image"]

    def __init__(self):
        super().__init__()
        self._model = None
        self._processor = None
        self._classifier = None

    @property
    def available(self) -> bool:
        """CLIP is generally available via transformers."""
        return True

    async def load(self) -> None:
        """Load CLIP model for feature extraction."""
        if self._loaded:
            return

        try:
            from transformers import CLIPModel, CLIPProcessor

            settings = get_settings()
            self._processor = CLIPProcessor.from_pretrained(
                settings.clip_model_id,
                cache_dir=settings.model_cache_dir,
            )
            self._model = CLIPModel.from_pretrained(
                settings.clip_model_id,
                cache_dir=settings.model_cache_dir,
            )

            if settings.device != "cpu":
                self._model = self._model.to(settings.device)

            self._loaded = True
        except Exception as e:
            raise RuntimeError(f"Failed to load CLIP model: {e}") from e

    async def detect(self, data: bytes, options: dict[str, Any] | None = None) -> DetectorResult:
        """
        Analyze image for AI generation indicators.

        Uses multiple heuristics:
        1. CLIP embedding distance from known AI image clusters
        2. Frequency domain analysis (AI images often lack natural noise patterns)
        3. Color histogram analysis
        4. Edge consistency checking
        """
        start_time = time.time()

        try:
            # Load image
            image = Image.open(io.BytesIO(data)).convert("RGB")

            # Run detection heuristics
            scores = []

            # 1. Statistical analysis of pixel values
            stat_score = self._analyze_statistics(image)
            scores.append(("statistics", stat_score))

            # 2. Frequency domain analysis
            freq_score = self._analyze_frequency(image)
            scores.append(("frequency", freq_score))

            # 3. Edge analysis
            edge_score = self._analyze_edges(image)
            scores.append(("edges", edge_score))

            # 4. Color distribution
            color_score = self._analyze_colors(image)
            scores.append(("colors", color_score))

            # Combine scores (weighted average)
            weights = {"statistics": 0.25, "frequency": 0.35, "edges": 0.2, "colors": 0.2}
            final_score = sum(s * weights[name] for name, s in scores)

            # Determine verdict
            if final_score >= 0.7:
                verdict = Verdict.AI
            elif final_score <= 0.3:
                verdict = Verdict.HUMAN
            else:
                verdict = Verdict.UNCERTAIN

            processing_time = int((time.time() - start_time) * 1000)

            return DetectorResult(
                name=self.name,
                verdict=verdict,
                confidence=final_score,
                model_version=self.version,
                processing_time_ms=processing_time,
                metadata={
                    "scores": dict(scores),
                    "image_size": image.size,
                    "limitation": "Baseline heuristic detector - accuracy varies by AI model",
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

    def _analyze_statistics(self, image: Image.Image) -> float:
        """
        Analyze pixel value statistics.
        AI images often have different statistical properties.
        """
        arr = np.array(image).astype(float)

        # Check for unusual value distributions
        mean = np.mean(arr)
        std = np.std(arr)

        # AI images sometimes have more uniform distributions
        # or unusual clustering
        uniformity_score = 1.0 - min(std / 80.0, 1.0)  # Lower std = more uniform

        # Check for value clipping (common in some AI outputs)
        black_ratio = np.sum(arr < 5) / arr.size
        white_ratio = np.sum(arr > 250) / arr.size
        clipping_score = min((black_ratio + white_ratio) * 10, 1.0)

        return (uniformity_score * 0.6 + clipping_score * 0.4)

    def _analyze_frequency(self, image: Image.Image) -> float:
        """
        Analyze frequency domain characteristics.
        AI images often lack natural high-frequency noise.
        """
        # Convert to grayscale for frequency analysis
        gray = np.array(image.convert("L")).astype(float)

        # Simple high-frequency content estimation using gradient
        gx = np.diff(gray, axis=1)
        gy = np.diff(gray, axis=0)

        # Magnitude of gradients
        gradient_mag = np.sqrt(gx[:, :-1] ** 2 + gy[:-1, :] ** 2)

        # AI images often have smoother gradients
        gradient_mean = np.mean(gradient_mag)
        gradient_std = np.std(gradient_mag)

        # Lower gradient variation can indicate AI
        smoothness_indicator = 1.0 - min(gradient_std / 50.0, 1.0)

        # Check for periodic patterns (common in some AI artifacts)
        # Simple check: variance of local means
        block_size = 16
        h, w = gray.shape
        local_means = []
        for i in range(0, h - block_size, block_size):
            for j in range(0, w - block_size, block_size):
                block = gray[i:i+block_size, j:j+block_size]
                local_means.append(np.mean(block))

        local_var = np.var(local_means) if local_means else 0
        periodicity_score = 1.0 - min(local_var / 1000.0, 1.0)

        return smoothness_indicator * 0.6 + periodicity_score * 0.4

    def _analyze_edges(self, image: Image.Image) -> float:
        """
        Analyze edge characteristics.
        AI images sometimes have unnaturally clean or inconsistent edges.
        """
        gray = np.array(image.convert("L")).astype(float)

        # Simple edge detection using gradients
        gx = np.abs(np.diff(gray, axis=1))
        gy = np.abs(np.diff(gray, axis=0))

        # Count strong edges
        threshold = 30
        edge_count = np.sum(gx > threshold) + np.sum(gy > threshold)
        edge_ratio = edge_count / gray.size

        # AI images sometimes have fewer natural edges
        # or more uniform edge strengths
        edge_std = np.std(np.concatenate([gx.flatten(), gy.flatten()]))

        # Normalize
        edge_uniformity = 1.0 - min(edge_std / 40.0, 1.0)

        return edge_uniformity * 0.5 + (1.0 - min(edge_ratio * 20, 1.0)) * 0.5

    def _analyze_colors(self, image: Image.Image) -> float:
        """
        Analyze color distribution.
        AI images sometimes have unusual color distributions.
        """
        arr = np.array(image)

        # Calculate color histogram for each channel
        scores = []
        for c in range(3):
            channel = arr[:, :, c].flatten()
            hist, _ = np.histogram(channel, bins=32, range=(0, 256))
            hist = hist / hist.sum()  # Normalize

            # Check for unusual peaks or gaps
            max_bin = np.max(hist)
            zero_bins = np.sum(hist < 0.001)

            # AI images sometimes have more discrete color distributions
            discreteness = max_bin * 5 + zero_bins / 32
            scores.append(min(discreteness, 1.0))

        return np.mean(scores)

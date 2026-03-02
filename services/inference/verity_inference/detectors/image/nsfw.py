"""
NSFW Image Detector

Uses a pretrained classifier to detect NSFW content.
"""

import io
import time
from typing import Any, ClassVar

from PIL import Image

from ..base import BaseDetector, DetectorResult, Verdict
from ...config import get_settings


class NSFWDetector(BaseDetector):
    """
    Detect NSFW (Not Safe For Work) content in images.

    Uses the Falconsai/nsfw_image_detection model from HuggingFace
    or falls back to a simple heuristic if the model is unavailable.
    """

    name: ClassVar[str] = "nsfw"
    version: ClassVar[str] = "1.0.0"
    media_types: ClassVar[list[str]] = ["image"]

    def __init__(self):
        super().__init__()
        self._pipeline = None
        self._model_available = False

    @property
    def available(self) -> bool:
        """Check if NSFW detection is enabled."""
        settings = get_settings()
        return settings.enable_nsfw_detection

    async def load(self) -> None:
        """Load NSFW classification model."""
        if self._loaded:
            return

        settings = get_settings()

        if not settings.enable_nsfw_detection:
            self._loaded = True
            return

        try:
            from transformers import pipeline

            self._pipeline = pipeline(
                "image-classification",
                model=settings.nsfw_model_id,
                device=0 if settings.device == "cuda" else -1,
            )
            self._model_available = True
        except Exception:
            # Model not available, will use heuristic fallback
            self._model_available = False

        self._loaded = True

    async def detect(self, data: bytes, options: dict[str, Any] | None = None) -> DetectorResult:
        """Detect NSFW content in the image."""
        start_time = time.time()

        if not self.available:
            return self.unavailable_result("NSFW detection disabled")

        try:
            image = Image.open(io.BytesIO(data)).convert("RGB")

            if self._model_available and self._pipeline:
                # Use the model
                results = self._pipeline(image)

                # Find NSFW score
                nsfw_score = 0.0
                for result in results:
                    label = result["label"].lower()
                    if "nsfw" in label or "porn" in label or "sexy" in label:
                        nsfw_score = max(nsfw_score, result["score"])
                    elif "safe" in label or "normal" in label:
                        nsfw_score = min(nsfw_score, 1.0 - result["score"])

                confidence = nsfw_score
            else:
                # Fallback: basic skin tone detection heuristic
                # This is very basic and not accurate
                confidence = self._heuristic_check(image)

            # Determine verdict (AI = NSFW detected, HUMAN = safe)
            if confidence >= 0.7:
                verdict = Verdict.AI  # NSFW detected
            elif confidence <= 0.3:
                verdict = Verdict.HUMAN  # Safe
            else:
                verdict = Verdict.UNCERTAIN

            processing_time = int((time.time() - start_time) * 1000)

            return DetectorResult(
                name=self.name,
                verdict=verdict,
                confidence=confidence,
                model_version=self.version + ("-model" if self._model_available else "-heuristic"),
                processing_time_ms=processing_time,
                metadata={
                    "is_nsfw": confidence >= 0.5,
                    "model_used": "transformer" if self._model_available else "heuristic",
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

    def _heuristic_check(self, image: Image.Image) -> float:
        """
        Basic heuristic NSFW check based on skin tone ratios.
        This is NOT accurate and should only be used as a fallback.
        """
        import numpy as np

        # Resize for faster processing
        img = image.resize((100, 100))
        arr = np.array(img)

        # Very basic skin tone detection in RGB
        r, g, b = arr[:, :, 0], arr[:, :, 1], arr[:, :, 2]

        # Simple skin color bounds
        skin_mask = (
            (r > 95) & (g > 40) & (b > 20) &
            (r > g) & (r > b) &
            (np.abs(r.astype(int) - g.astype(int)) > 15) &
            (r - np.minimum(g, b) > 15)
        )

        skin_ratio = np.sum(skin_mask) / skin_mask.size

        # High skin ratio might indicate NSFW, but this is very unreliable
        # Return low confidence since this is just a heuristic
        return min(skin_ratio * 2, 0.5)  # Cap at 0.5 to indicate uncertainty

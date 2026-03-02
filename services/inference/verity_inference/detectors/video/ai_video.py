"""
AI-Generated Video Detector

Analyzes video frames for AI generation indicators.
"""

import io
import tempfile
import time
from typing import Any, ClassVar

import numpy as np
from PIL import Image

from ..base import BaseDetector, DetectorResult, Verdict
from ..image.ai_generated import AIGeneratedImageDetector
from ...config import get_settings


class AIVideoDetector(BaseDetector):
    """
    Detect AI-generated video content.

    Uses frame sampling and applies image AI detection to each frame.
    Also analyzes temporal consistency between frames.

    Limitations:
    - Accuracy depends on underlying image detector
    - May miss AI content in specific frames
    - Heavy videos may take longer to process
    """

    name: ClassVar[str] = "ai_video"
    version: ClassVar[str] = "1.0.0-baseline"
    media_types: ClassVar[list[str]] = ["video"]

    def __init__(self):
        super().__init__()
        self._image_detector = AIGeneratedImageDetector()
        self._cv2_available = False

    @property
    def available(self) -> bool:
        settings = get_settings()
        return settings.enable_video_detection

    async def load(self) -> None:
        """Load required components."""
        if self._loaded:
            return

        try:
            import cv2
            self._cv2_available = True
        except ImportError:
            self._cv2_available = False

        await self._image_detector.load()
        self._loaded = True

    async def detect(self, data: bytes, options: dict[str, Any] | None = None) -> DetectorResult:
        """Analyze video for AI generation indicators."""
        start_time = time.time()

        if not self._cv2_available:
            return DetectorResult(
                name=self.name,
                verdict=Verdict.UNAVAILABLE,
                confidence=0.0,
                model_version=self.version,
                processing_time_ms=int((time.time() - start_time) * 1000),
                error="OpenCV not available. Install opencv-python.",
            )

        try:
            import cv2

            # Write to temp file for OpenCV
            with tempfile.NamedTemporaryFile(suffix=".mp4", delete=False) as f:
                f.write(data)
                temp_path = f.name

            cap = cv2.VideoCapture(temp_path)

            if not cap.isOpened():
                return DetectorResult(
                    name=self.name,
                    verdict=Verdict.UNAVAILABLE,
                    confidence=0.0,
                    model_version=self.version,
                    processing_time_ms=int((time.time() - start_time) * 1000),
                    error="Could not open video file",
                )

            fps = cap.get(cv2.CAP_PROP_FPS)
            frame_count = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
            duration = frame_count / fps if fps > 0 else 0

            # Sample frames for analysis
            max_frames = options.get("max_frames", 10) if options else 10
            frame_interval = max(1, frame_count // max_frames)

            frame_scores = []
            temporal_scores = []
            prev_frame = None

            for i in range(0, frame_count, frame_interval):
                cap.set(cv2.CAP_PROP_POS_FRAMES, i)
                ret, frame = cap.read()

                if not ret:
                    continue

                # Convert BGR to RGB
                frame_rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
                pil_image = Image.fromarray(frame_rgb)

                # Encode to bytes for detector
                buffer = io.BytesIO()
                pil_image.save(buffer, format="PNG")
                frame_bytes = buffer.getvalue()

                # Run image detector on frame
                result = await self._image_detector.detect(frame_bytes)
                if result.verdict != Verdict.UNAVAILABLE:
                    frame_scores.append(result.confidence)

                # Temporal consistency check
                if prev_frame is not None:
                    temporal_score = self._check_temporal_consistency(prev_frame, frame_rgb)
                    temporal_scores.append(temporal_score)

                prev_frame = frame_rgb

                if len(frame_scores) >= max_frames:
                    break

            cap.release()

            # Remove temp file
            import os
            os.unlink(temp_path)

            if not frame_scores:
                return DetectorResult(
                    name=self.name,
                    verdict=Verdict.UNAVAILABLE,
                    confidence=0.0,
                    model_version=self.version,
                    processing_time_ms=int((time.time() - start_time) * 1000),
                    error="Could not analyze any frames",
                )

            # Aggregate scores
            avg_frame_score = np.mean(frame_scores)
            avg_temporal_score = np.mean(temporal_scores) if temporal_scores else 0.5

            # Combine (weighted)
            final_score = avg_frame_score * 0.7 + avg_temporal_score * 0.3

            # Determine verdict
            if final_score >= 0.65:
                verdict = Verdict.AI
            elif final_score <= 0.35:
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
                    "frames_analyzed": len(frame_scores),
                    "total_frames": frame_count,
                    "duration_seconds": duration,
                    "fps": fps,
                    "avg_frame_score": avg_frame_score,
                    "avg_temporal_score": avg_temporal_score,
                    "limitation": "Frame-sampling based analysis",
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

    def _check_temporal_consistency(self, frame1: np.ndarray, frame2: np.ndarray) -> float:
        """
        Check temporal consistency between frames.
        AI videos may have unnatural frame transitions.
        """
        # Simple difference analysis
        diff = np.abs(frame1.astype(float) - frame2.astype(float))
        mean_diff = np.mean(diff)

        # Check for sudden large changes (might indicate generation artifacts)
        high_diff_ratio = np.mean(diff > 100)

        # Very uniform or very erratic transitions can indicate AI
        if mean_diff < 5:  # Almost no change (loop/static)
            return 0.6
        elif high_diff_ratio > 0.3:  # Too many large changes
            return 0.7
        else:
            return 0.3  # Normal transition

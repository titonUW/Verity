"""
AI-Generated Music Detector

Analyzes audio for synthetic music characteristics.
"""

import io
import time
from typing import Any, ClassVar

import numpy as np

from ..base import BaseDetector, DetectorResult, Verdict
from ...config import get_settings


class AIMusicDetector(BaseDetector):
    """
    Detect AI-generated music in audio.

    This baseline implementation analyzes:
    1. Spectral patterns
    2. Rhythmic consistency
    3. Harmonic structure
    4. Dynamic range

    Limitations:
    - Requires librosa for functionality
    - May confuse heavily processed music with AI
    - Accuracy varies by AI music generation method
    """

    name: ClassVar[str] = "ai_music"
    version: ClassVar[str] = "1.0.0-baseline"
    media_types: ClassVar[list[str]] = ["audio"]

    def __init__(self):
        super().__init__()
        self._librosa_available = False

    @property
    def available(self) -> bool:
        settings = get_settings()
        return settings.enable_audio_detection

    async def load(self) -> None:
        """Check if audio processing libraries are available."""
        if self._loaded:
            return

        try:
            import librosa
            import soundfile
            self._librosa_available = True
        except ImportError:
            self._librosa_available = False

        self._loaded = True

    async def detect(self, data: bytes, options: dict[str, Any] | None = None) -> DetectorResult:
        """Analyze audio for AI music indicators."""
        start_time = time.time()

        if not self._librosa_available:
            return DetectorResult(
                name=self.name,
                verdict=Verdict.UNAVAILABLE,
                confidence=0.0,
                model_version=self.version,
                processing_time_ms=int((time.time() - start_time) * 1000),
                error="Audio processing libraries not available. Install librosa and soundfile.",
            )

        try:
            import librosa
            import soundfile as sf

            # Load audio
            audio_data, sr = sf.read(io.BytesIO(data))

            # Convert to mono if stereo
            if len(audio_data.shape) > 1:
                audio_data = np.mean(audio_data, axis=1)

            audio_data = audio_data.astype(np.float32)
            duration = len(audio_data) / sr

            # Run analysis
            rhythm_score = self._analyze_rhythm(audio_data, sr)
            harmonic_score = self._analyze_harmonics(audio_data, sr)
            dynamic_score = self._analyze_dynamics(audio_data, sr)
            repetition_score = self._analyze_repetition(audio_data, sr)

            # Combine scores
            final_score = (
                rhythm_score * 0.3 +
                harmonic_score * 0.25 +
                dynamic_score * 0.2 +
                repetition_score * 0.25
            )

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
                    "scores": {
                        "rhythm": rhythm_score,
                        "harmonics": harmonic_score,
                        "dynamics": dynamic_score,
                        "repetition": repetition_score,
                    },
                    "duration_seconds": duration,
                    "sample_rate": sr,
                    "limitation": "Heuristic detector - may confuse processed music with AI",
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

    def _analyze_rhythm(self, audio: np.ndarray, sr: int) -> float:
        """
        Analyze rhythmic patterns.
        AI music often has unnaturally perfect timing.
        """
        import librosa

        # Get tempo and beat frames
        tempo, beat_frames = librosa.beat.beat_track(y=audio, sr=sr)
        beat_times = librosa.frames_to_time(beat_frames, sr=sr)

        if len(beat_times) < 4:
            return 0.5

        # Calculate inter-beat intervals
        ibis = np.diff(beat_times)

        # Check for perfect regularity (AI indicator)
        ibi_std = np.std(ibis)
        ibi_mean = np.mean(ibis)

        if ibi_mean == 0:
            return 0.5

        cv = ibi_std / ibi_mean

        # Lower CV = more regular = more likely AI
        regularity_score = 1.0 - min(cv / 0.1, 1.0)

        return regularity_score

    def _analyze_harmonics(self, audio: np.ndarray, sr: int) -> float:
        """
        Analyze harmonic structure.
        AI music may have unusual harmonic patterns.
        """
        import librosa

        # Compute chromagram
        chroma = librosa.feature.chroma_stft(y=audio, sr=sr)

        # Check for harmonic diversity
        chroma_mean = np.mean(chroma, axis=1)
        diversity = np.std(chroma_mean)

        # Low diversity = limited harmonic content = potential AI indicator
        diversity_score = 1.0 - min(diversity / 0.3, 1.0)

        # Check for unusual chord progressions
        # (simplified: look for sudden changes)
        chroma_diff = np.diff(chroma, axis=1)
        change_rate = np.mean(np.abs(chroma_diff))

        # Very smooth or very erratic can both indicate AI
        if change_rate < 0.1 or change_rate > 0.8:
            pattern_score = 0.7
        else:
            pattern_score = 0.3

        return (diversity_score + pattern_score) / 2

    def _analyze_dynamics(self, audio: np.ndarray, sr: int) -> float:
        """
        Analyze dynamic range and variation.
        AI music may have unnatural dynamics.
        """
        # Calculate RMS energy over time
        frame_length = int(sr * 0.1)  # 100ms frames
        hop_length = frame_length // 2

        rms_values = []
        for i in range(0, len(audio) - frame_length, hop_length):
            frame = audio[i:i+frame_length]
            rms = np.sqrt(np.mean(frame ** 2))
            rms_values.append(rms)

        if not rms_values:
            return 0.5

        rms_array = np.array(rms_values)

        # Calculate dynamic range
        dynamic_range = np.max(rms_array) / (np.min(rms_array) + 1e-6)

        # Very compressed or very extreme dynamics can indicate AI
        if dynamic_range < 3:
            dynamics_score = 0.7  # Too compressed
        elif dynamic_range > 100:
            dynamics_score = 0.6  # Too extreme
        else:
            dynamics_score = 0.3  # Natural range

        return dynamics_score

    def _analyze_repetition(self, audio: np.ndarray, sr: int) -> float:
        """
        Analyze repetitive patterns.
        AI music may have unnatural repetition.
        """
        import librosa

        # Get tempo for segment length estimation
        tempo, _ = librosa.beat.beat_track(y=audio, sr=sr)

        # Segment length based on tempo (roughly 4 beats)
        if tempo > 0:
            segment_length = int(sr * 60 / tempo * 4)
        else:
            segment_length = sr * 4  # Default 4 seconds

        # Compare segments
        num_segments = len(audio) // segment_length
        if num_segments < 2:
            return 0.5

        similarities = []
        for i in range(num_segments - 1):
            seg1 = audio[i * segment_length:(i + 1) * segment_length]
            seg2 = audio[(i + 1) * segment_length:(i + 2) * segment_length]

            # Simple correlation
            if len(seg1) == len(seg2):
                corr = np.corrcoef(seg1, seg2)[0, 1]
                if not np.isnan(corr):
                    similarities.append(abs(corr))

        if not similarities:
            return 0.5

        # High similarity between segments = more likely AI
        avg_similarity = np.mean(similarities)
        return min(avg_similarity, 1.0)

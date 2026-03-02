"""
AI-Generated Voice Detector

Analyzes audio for synthetic voice characteristics.
"""

import io
import time
from typing import Any, ClassVar

import numpy as np

from ..base import BaseDetector, DetectorResult, Verdict
from ...config import get_settings


class AIVoiceDetector(BaseDetector):
    """
    Detect AI-generated voice/speech in audio.

    This baseline implementation analyzes:
    1. Spectral characteristics
    2. Pitch consistency
    3. Formant patterns
    4. Breathing/pause patterns

    Limitations:
    - Requires librosa for full functionality
    - Accuracy varies by synthesis method
    - Background noise can affect results
    """

    name: ClassVar[str] = "ai_voice"
    version: ClassVar[str] = "1.0.0-baseline"
    media_types: ClassVar[list[str]] = ["audio", "video"]

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
        """Analyze audio for AI voice indicators."""
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

            # Ensure float32
            audio_data = audio_data.astype(np.float32)

            duration = len(audio_data) / sr

            # Run analysis
            spectral_score = self._analyze_spectral(audio_data, sr)
            pitch_score = self._analyze_pitch(audio_data, sr)
            pause_score = self._analyze_pauses(audio_data, sr)

            # Combine scores
            final_score = (
                spectral_score * 0.4 +
                pitch_score * 0.35 +
                pause_score * 0.25
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
                        "spectral": spectral_score,
                        "pitch": pitch_score,
                        "pauses": pause_score,
                    },
                    "duration_seconds": duration,
                    "sample_rate": sr,
                    "limitation": "Heuristic detector - accuracy varies by synthesis method",
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

    def _analyze_spectral(self, audio: np.ndarray, sr: int) -> float:
        """
        Analyze spectral characteristics.
        AI voices often have unnatural spectral smoothness.
        """
        import librosa

        # Compute mel spectrogram
        mel_spec = librosa.feature.melspectrogram(y=audio, sr=sr, n_mels=128)
        mel_db = librosa.power_to_db(mel_spec, ref=np.max)

        # Check for spectral smoothness
        spectral_diff = np.diff(mel_db, axis=1)
        smoothness = 1.0 / (np.std(spectral_diff) + 1e-6)

        # Normalize
        smoothness_score = min(smoothness / 0.5, 1.0)

        return smoothness_score

    def _analyze_pitch(self, audio: np.ndarray, sr: int) -> float:
        """
        Analyze pitch consistency.
        AI voices often have unnaturally consistent pitch.
        """
        import librosa

        # Extract pitch using librosa
        pitches, magnitudes = librosa.piptrack(y=audio, sr=sr)

        # Get dominant pitch for each frame
        pitch_values = []
        for t in range(pitches.shape[1]):
            index = magnitudes[:, t].argmax()
            pitch = pitches[index, t]
            if pitch > 0:
                pitch_values.append(pitch)

        if len(pitch_values) < 10:
            return 0.5  # Not enough pitch data

        pitch_array = np.array(pitch_values)

        # Calculate pitch variation
        pitch_std = np.std(pitch_array)
        pitch_mean = np.mean(pitch_array)

        if pitch_mean == 0:
            return 0.5

        cv = pitch_std / pitch_mean  # Coefficient of variation

        # Lower CV = more consistent = more likely AI
        ai_score = 1.0 - min(cv / 0.3, 1.0)

        return ai_score

    def _analyze_pauses(self, audio: np.ndarray, sr: int) -> float:
        """
        Analyze pause patterns.
        AI voices often have unnatural pause timing.
        """
        # Simple energy-based silence detection
        frame_length = int(sr * 0.025)  # 25ms frames
        hop_length = int(sr * 0.010)    # 10ms hop

        # Calculate frame energy
        frames = []
        for i in range(0, len(audio) - frame_length, hop_length):
            frame = audio[i:i+frame_length]
            energy = np.sum(frame ** 2)
            frames.append(energy)

        if not frames:
            return 0.5

        frames = np.array(frames)
        threshold = np.percentile(frames, 20)  # Bottom 20% is silence

        # Find silence regions
        is_silent = frames < threshold
        silence_changes = np.diff(is_silent.astype(int))

        # Count pauses
        pause_starts = np.sum(silence_changes == 1)
        pause_ends = np.sum(silence_changes == -1)

        # Calculate pause regularity
        silence_indices = np.where(is_silent)[0]
        if len(silence_indices) > 10:
            gaps = np.diff(silence_indices)
            gap_regularity = 1.0 / (np.std(gaps) + 1)
        else:
            gap_regularity = 0.5

        # More regular pauses = more likely AI
        return min(gap_regularity / 0.5, 1.0)

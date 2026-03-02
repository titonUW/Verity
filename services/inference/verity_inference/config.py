"""
Configuration settings for the inference service.
"""

from functools import lru_cache
from pathlib import Path
from typing import Literal

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # Application
    environment: Literal["development", "staging", "production"] = "development"
    debug: bool = False
    log_level: str = "INFO"

    # Server
    host: str = "0.0.0.0"
    port: int = 8000
    workers: int = 1

    # Model settings
    model_cache_dir: Path = Path("/app/models")
    enable_gpu: bool = False
    device: str = "cpu"  # "cpu", "cuda", "mps"

    # Feature flags
    enable_image_detection: bool = True
    enable_video_detection: bool = True
    enable_audio_detection: bool = True
    enable_text_detection: bool = True
    enable_nsfw_detection: bool = True
    enable_deepfake_detection: bool = False  # Requires weights
    enable_c2pa: bool = True
    enable_watermark_detection: bool = False

    # File limits
    max_image_size_mb: int = 25
    max_video_size_mb: int = 500
    max_audio_size_mb: int = 100
    max_text_size_kb: int = 100

    # Model IDs (HuggingFace)
    clip_model_id: str = "openai/clip-vit-base-patch32"
    nsfw_model_id: str = "Falconsai/nsfw_image_detection"

    @property
    def max_image_size_bytes(self) -> int:
        return self.max_image_size_mb * 1024 * 1024

    @property
    def max_video_size_bytes(self) -> int:
        return self.max_video_size_mb * 1024 * 1024

    @property
    def max_audio_size_bytes(self) -> int:
        return self.max_audio_size_mb * 1024 * 1024

    @property
    def max_text_size_bytes(self) -> int:
        return self.max_text_size_kb * 1024


@lru_cache
def get_settings() -> Settings:
    """Get cached settings instance."""
    return Settings()

"""
Detection API endpoints.
"""

import hashlib
import time
from typing import Any

from fastapi import APIRouter, File, Form, HTTPException, UploadFile
from pydantic import BaseModel

from ..config import get_settings
from ..detectors import DetectorRegistry
from ..detectors.image import AIGeneratedImageDetector, ImageQualityDetector, DeepfakeDetector, NSFWDetector
from ..detectors.text import AITextDetector
from ..detectors.audio import AIVoiceDetector, AIMusicDetector
from ..detectors.video import AIVideoDetector, DeepfakeVideoDetector
from ..provenance.c2pa import C2PAVerifier
from ..provenance.watermark import WatermarkDetector

router = APIRouter(prefix="/detect", tags=["detection"])

# Initialize detectors
_initialized = False


async def ensure_initialized():
    """Ensure all detectors are loaded."""
    global _initialized
    if _initialized:
        return

    # Register and load image detectors
    ai_image = AIGeneratedImageDetector()
    await ai_image.load()
    DetectorRegistry.register(ai_image)

    quality = ImageQualityDetector()
    await quality.load()
    DetectorRegistry.register(quality)

    deepfake = DeepfakeDetector()
    await deepfake.load()
    DetectorRegistry.register(deepfake)

    nsfw = NSFWDetector()
    await nsfw.load()
    DetectorRegistry.register(nsfw)

    # Register and load text detector
    ai_text = AITextDetector()
    await ai_text.load()
    DetectorRegistry.register(ai_text)

    # Register and load audio detectors
    ai_voice = AIVoiceDetector()
    await ai_voice.load()
    DetectorRegistry.register(ai_voice)

    ai_music = AIMusicDetector()
    await ai_music.load()
    DetectorRegistry.register(ai_music)

    # Register and load video detectors
    ai_video = AIVideoDetector()
    await ai_video.load()
    DetectorRegistry.register(ai_video)

    deepfake_video = DeepfakeVideoDetector()
    await deepfake_video.load()
    DetectorRegistry.register(deepfake_video)

    _initialized = True


class DetectionRequest(BaseModel):
    """Detection request options."""
    only: list[str] | None = None
    excluding: list[str] | None = None
    include_provenance: bool = True


class DetectionResponse(BaseModel):
    """Detection response."""
    media_hash: str
    media_type: str
    signals: list[dict[str, Any]]
    provenance: dict[str, Any] | None = None
    processing_time_ms: int


@router.post("/image", response_model=DetectionResponse)
async def detect_image(
    file: UploadFile = File(...),
    only: str | None = Form(None),
    excluding: str | None = Form(None),
    include_provenance: bool = Form(True),
):
    """
    Detect AI-generated content in an image.

    Runs multiple detection signals:
    - ai_generated: Checks for AI generation indicators
    - deepfake: Checks for face manipulation (requires weights)
    - nsfw: Checks for NSFW content
    - quality: Analyzes image quality

    Optional provenance checks:
    - C2PA manifest verification
    - Watermark detection
    """
    await ensure_initialized()
    settings = get_settings()

    # Read and validate file
    data = await file.read()
    if len(data) > settings.max_image_size_bytes:
        raise HTTPException(413, f"File too large. Maximum size: {settings.max_image_size_mb}MB")

    # Parse options
    only_list = only.split(",") if only else None
    excluding_list = excluding.split(",") if excluding else None

    return await run_detection(
        data=data,
        media_type="image",
        mime_type=file.content_type or "image/unknown",
        only=only_list,
        excluding=excluding_list,
        include_provenance=include_provenance,
    )


@router.post("/video", response_model=DetectionResponse)
async def detect_video(
    file: UploadFile = File(...),
    only: str | None = Form(None),
    excluding: str | None = Form(None),
    include_provenance: bool = Form(True),
):
    """
    Detect AI-generated content in a video.

    Runs detection signals:
    - ai_video: Analyzes frames for AI generation
    - ai_voice: Analyzes audio track for synthetic voice
    - ai_music: Analyzes audio track for AI music
    - deepfake_video: Checks for face manipulation (requires weights)
    """
    await ensure_initialized()
    settings = get_settings()

    data = await file.read()
    if len(data) > settings.max_video_size_bytes:
        raise HTTPException(413, f"File too large. Maximum size: {settings.max_video_size_mb}MB")

    only_list = only.split(",") if only else None
    excluding_list = excluding.split(",") if excluding else None

    return await run_detection(
        data=data,
        media_type="video",
        mime_type=file.content_type or "video/unknown",
        only=only_list,
        excluding=excluding_list,
        include_provenance=include_provenance,
    )


@router.post("/audio", response_model=DetectionResponse)
async def detect_audio(
    file: UploadFile = File(...),
    only: str | None = Form(None),
    excluding: str | None = Form(None),
):
    """
    Detect AI-generated content in audio.

    Runs detection signals:
    - ai_voice: Checks for synthetic voice
    - ai_music: Checks for AI-generated music
    """
    await ensure_initialized()
    settings = get_settings()

    data = await file.read()
    if len(data) > settings.max_audio_size_bytes:
        raise HTTPException(413, f"File too large. Maximum size: {settings.max_audio_size_mb}MB")

    only_list = only.split(",") if only else None
    excluding_list = excluding.split(",") if excluding else None

    return await run_detection(
        data=data,
        media_type="audio",
        mime_type=file.content_type or "audio/unknown",
        only=only_list,
        excluding=excluding_list,
        include_provenance=False,  # No provenance for audio currently
    )


@router.post("/text", response_model=DetectionResponse)
async def detect_text(
    text: str = Form(...),
    include_annotations: bool = Form(False),
):
    """
    Detect AI-generated text.

    Analyzes text for:
    - Perplexity patterns
    - Writing style indicators
    - AI phrase patterns

    Optional: Include per-section annotations.
    """
    await ensure_initialized()
    settings = get_settings()

    data = text.encode("utf-8")
    if len(data) > settings.max_text_size_bytes:
        raise HTTPException(413, f"Text too long. Maximum size: {settings.max_text_size_kb}KB")

    return await run_detection(
        data=data,
        media_type="text",
        mime_type="text/plain",
        only=["ai_text"],
        excluding=None,
        include_provenance=False,
        options={"include_annotations": include_annotations},
    )


async def run_detection(
    data: bytes,
    media_type: str,
    mime_type: str,
    only: list[str] | None = None,
    excluding: list[str] | None = None,
    include_provenance: bool = True,
    options: dict[str, Any] | None = None,
) -> DetectionResponse:
    """Run detection pipeline on content."""
    start_time = time.time()

    # Calculate hash
    media_hash = hashlib.sha256(data).hexdigest()

    # Get applicable detectors
    detectors = DetectorRegistry.get_for_media_type(media_type)

    # Filter by only/excluding
    if only:
        detectors = [d for d in detectors if d.name in only]
    if excluding:
        detectors = [d for d in detectors if d.name not in excluding]

    # Run detectors
    signals = []
    for detector in detectors:
        try:
            result = await detector.detect(data, options)
            signals.append(result.to_dict())
        except Exception as e:
            signals.append({
                "name": detector.name,
                "verdict": "unavailable",
                "confidence": 0.0,
                "model_version": detector.version,
                "error": str(e),
            })

    # Run provenance checks if requested
    provenance = None
    if include_provenance and media_type in ["image", "video"]:
        provenance = {}

        # C2PA
        c2pa_verifier = C2PAVerifier()
        await c2pa_verifier.load()
        c2pa_result = await c2pa_verifier.verify(data, mime_type)
        provenance["c2pa"] = c2pa_result.to_dict()

        # Watermark (for images)
        if media_type == "image":
            watermark_detector = WatermarkDetector()
            await watermark_detector.load()
            watermark_result = await watermark_detector.detect_image_watermark(data)
            provenance["watermark"] = watermark_result.to_dict()

    processing_time = int((time.time() - start_time) * 1000)

    return DetectionResponse(
        media_hash=media_hash,
        media_type=media_type,
        signals=signals,
        provenance=provenance,
        processing_time_ms=processing_time,
    )


@router.get("/detectors")
async def list_detectors():
    """List all available detectors and their status."""
    await ensure_initialized()

    detectors = []
    for name, detector in DetectorRegistry.get_all().items():
        detectors.append({
            "name": name,
            "version": detector.version,
            "media_types": detector.media_types,
            "available": detector.available,
        })

    return {"detectors": detectors}

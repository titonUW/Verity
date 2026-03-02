"""
C2PA (Content Credentials) Verification

Parses and verifies C2PA manifests embedded in media files.
"""

import io
import time
from dataclasses import dataclass, field
from typing import Any

from PIL import Image

from ..config import get_settings


@dataclass
class C2PAManifest:
    """Parsed C2PA manifest data."""
    found: bool = False
    issuer: str | None = None
    claim_generator: str | None = None
    signature_valid: bool | None = None
    title: str | None = None
    format: str | None = None
    actions: list[dict[str, Any]] = field(default_factory=list)
    ingredients: list[dict[str, Any]] = field(default_factory=list)
    assertions: list[dict[str, Any]] = field(default_factory=list)
    error: str | None = None
    processing_time_ms: int = 0

    def to_dict(self) -> dict[str, Any]:
        return {
            "found": self.found,
            "issuer": self.issuer,
            "claim_generator": self.claim_generator,
            "signature_valid": self.signature_valid,
            "title": self.title,
            "format": self.format,
            "actions": self.actions,
            "ingredients": self.ingredients,
            "assertions": self.assertions,
            "error": self.error,
        }


class C2PAVerifier:
    """
    Verify C2PA/Content Credentials in media files.

    This implementation attempts to use the c2pa-python library if available,
    otherwise falls back to basic JUMBF/XMP parsing.

    C2PA (Coalition for Content Provenance and Authenticity) provides:
    - Cryptographic signatures on content
    - Edit history tracking
    - Source/creator attribution
    """

    def __init__(self):
        self._c2pa_available = False
        self._loaded = False

    async def load(self) -> None:
        """Check if C2PA library is available."""
        if self._loaded:
            return

        try:
            import c2pa
            self._c2pa_available = True
        except ImportError:
            self._c2pa_available = False

        self._loaded = True

    async def verify(self, data: bytes, mime_type: str) -> C2PAManifest:
        """
        Verify C2PA manifest in media file.

        Args:
            data: Raw file bytes
            mime_type: MIME type of the file

        Returns:
            C2PAManifest with verification results
        """
        start_time = time.time()

        settings = get_settings()
        if not settings.enable_c2pa:
            return C2PAManifest(
                found=False,
                error="C2PA verification disabled",
                processing_time_ms=int((time.time() - start_time) * 1000),
            )

        if self._c2pa_available:
            return await self._verify_with_library(data, mime_type, start_time)
        else:
            return await self._verify_with_fallback(data, mime_type, start_time)

    async def _verify_with_library(self, data: bytes, mime_type: str, start_time: float) -> C2PAManifest:
        """Verify using the c2pa-python library."""
        try:
            import c2pa

            # Read manifest from bytes
            reader = c2pa.Reader(mime_type, data)

            if not reader.manifest_store:
                return C2PAManifest(
                    found=False,
                    processing_time_ms=int((time.time() - start_time) * 1000),
                )

            manifest = reader.manifest_store.get_active_manifest()
            if not manifest:
                return C2PAManifest(
                    found=False,
                    processing_time_ms=int((time.time() - start_time) * 1000),
                )

            # Extract manifest data
            return C2PAManifest(
                found=True,
                issuer=manifest.issuer if hasattr(manifest, 'issuer') else None,
                claim_generator=manifest.claim_generator if hasattr(manifest, 'claim_generator') else None,
                signature_valid=manifest.validation_status.is_valid if hasattr(manifest, 'validation_status') else None,
                title=manifest.title if hasattr(manifest, 'title') else None,
                format=manifest.format if hasattr(manifest, 'format') else None,
                actions=[],  # Would parse from assertions
                ingredients=[],  # Would parse from manifest
                processing_time_ms=int((time.time() - start_time) * 1000),
            )

        except Exception as e:
            return C2PAManifest(
                found=False,
                error=f"C2PA verification error: {str(e)}",
                processing_time_ms=int((time.time() - start_time) * 1000),
            )

    async def _verify_with_fallback(self, data: bytes, mime_type: str, start_time: float) -> C2PAManifest:
        """
        Fallback verification using basic parsing.
        Checks for presence of C2PA markers but cannot verify signatures.
        """
        try:
            # Check for JUMBF box (C2PA container in JPEG/PNG)
            has_jumbf = self._check_jumbf_marker(data)

            # Check for XMP metadata with C2PA references
            has_xmp_c2pa = self._check_xmp_c2pa(data)

            if has_jumbf or has_xmp_c2pa:
                return C2PAManifest(
                    found=True,
                    signature_valid=None,  # Cannot verify without library
                    error="C2PA manifest found but signature verification requires c2pa-python library",
                    processing_time_ms=int((time.time() - start_time) * 1000),
                )

            return C2PAManifest(
                found=False,
                processing_time_ms=int((time.time() - start_time) * 1000),
            )

        except Exception as e:
            return C2PAManifest(
                found=False,
                error=f"C2PA parsing error: {str(e)}",
                processing_time_ms=int((time.time() - start_time) * 1000),
            )

    def _check_jumbf_marker(self, data: bytes) -> bool:
        """Check for JUMBF (JPEG Universal Metadata Box Format) marker."""
        # JUMBF type codes that might indicate C2PA
        c2pa_markers = [
            b'c2pa',
            b'c2ma',  # C2PA manifest
            b'c2cs',  # C2PA signature
            b'jumb',  # JUMBF box
        ]

        for marker in c2pa_markers:
            if marker in data:
                return True

        return False

    def _check_xmp_c2pa(self, data: bytes) -> bool:
        """Check for C2PA references in XMP metadata."""
        # Look for XMP packet
        xmp_start = data.find(b'<x:xmpmeta')
        if xmp_start == -1:
            return False

        xmp_end = data.find(b'</x:xmpmeta>', xmp_start)
        if xmp_end == -1:
            return False

        xmp_data = data[xmp_start:xmp_end + len(b'</x:xmpmeta>')]

        # Check for C2PA namespace or references
        c2pa_indicators = [
            b'c2pa.org',
            b'contentcredentials',
            b'ContentCredentials',
            b'c2pa:',
        ]

        for indicator in c2pa_indicators:
            if indicator in xmp_data:
                return True

        return False

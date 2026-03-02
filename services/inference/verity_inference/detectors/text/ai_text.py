"""
AI-Generated Text Detector

Uses perplexity and burstiness analysis to detect AI-generated text.
This is a baseline heuristic detector with known limitations.
"""

import math
import re
import time
from collections import Counter
from typing import Any, ClassVar

from ..base import BaseDetector, DetectorResult, Verdict
from ...config import get_settings


class AITextDetector(BaseDetector):
    """
    Detect AI-generated text using linguistic analysis.

    This baseline implementation uses:
    1. Perplexity estimation (AI text tends to be more predictable)
    2. Burstiness analysis (AI text has more uniform sentence lengths)
    3. Vocabulary diversity metrics
    4. Common AI writing patterns

    Limitations:
    - Accuracy varies significantly by AI model and prompt
    - Short texts are harder to classify accurately
    - Edited AI text may evade detection
    - False positives on formal/technical writing
    """

    name: ClassVar[str] = "ai_text"
    version: ClassVar[str] = "1.0.0-baseline"
    media_types: ClassVar[list[str]] = ["text"]

    # Common patterns in AI-generated text
    AI_PHRASES = [
        r"\bin conclusion\b",
        r"\bfurthermore\b",
        r"\bmoreover\b",
        r"\bnevertheless\b",
        r"\bconsequently\b",
        r"\bit is important to note\b",
        r"\bit's worth noting\b",
        r"\bin summary\b",
        r"\boverall\b",
        r"\bultimately\b",
        r"\bfirstly\b.*\bsecondly\b",
        r"\bon the other hand\b",
        r"\bhaving said that\b",
        r"\bthat being said\b",
        r"\bdelve\b",
        r"\btapestry\b",
        r"\blandscape\b",
        r"\brealm\b",
        r"\bfoster\b",
        r"\bnavigate\b",
        r"\bleverage\b",
        r"\bholistic\b",
        r"\bseamless\b",
        r"\bsynergy\b",
        r"\bparadigm\b",
        r"\bpivotal\b",
        r"\bmultifaceted\b",
        r"\bcomprehensive\b",
        r"\bintricate\b",
    ]

    def __init__(self):
        super().__init__()
        self._tokenizer = None

    async def load(self) -> None:
        """Initialize tokenizer for analysis."""
        if self._loaded:
            return

        try:
            import tiktoken
            self._tokenizer = tiktoken.get_encoding("cl100k_base")
        except Exception:
            # Fall back to simple word tokenization
            self._tokenizer = None

        self._loaded = True

    async def detect(self, data: bytes, options: dict[str, Any] | None = None) -> DetectorResult:
        """
        Analyze text for AI generation indicators.
        """
        start_time = time.time()

        try:
            # Decode text
            text = data.decode("utf-8", errors="replace")

            # Skip if text is too short
            words = text.split()
            if len(words) < 50:
                return DetectorResult(
                    name=self.name,
                    verdict=Verdict.UNCERTAIN,
                    confidence=0.5,
                    model_version=self.version,
                    processing_time_ms=int((time.time() - start_time) * 1000),
                    metadata={
                        "word_count": len(words),
                        "reason": "Text too short for reliable analysis (< 50 words)",
                    },
                )

            # Run analysis
            perplexity_score = self._estimate_perplexity(text)
            burstiness_score = self._calculate_burstiness(text)
            pattern_score = self._detect_ai_patterns(text)
            diversity_score = self._calculate_vocabulary_diversity(text)
            repetition_score = self._detect_repetition(text)

            # Combine scores
            # Higher score = more likely AI
            final_score = (
                perplexity_score * 0.25 +
                burstiness_score * 0.20 +
                pattern_score * 0.25 +
                (1.0 - diversity_score) * 0.15 +  # Lower diversity = more likely AI
                repetition_score * 0.15
            )

            # Determine verdict
            if final_score >= 0.65:
                verdict = Verdict.AI
            elif final_score <= 0.35:
                verdict = Verdict.HUMAN
            else:
                verdict = Verdict.UNCERTAIN

            # Generate annotations if requested
            annotations = []
            if options and options.get("include_annotations"):
                annotations = self._generate_annotations(text)

            processing_time = int((time.time() - start_time) * 1000)

            return DetectorResult(
                name=self.name,
                verdict=verdict,
                confidence=final_score,
                model_version=self.version,
                processing_time_ms=processing_time,
                metadata={
                    "scores": {
                        "perplexity": perplexity_score,
                        "burstiness": burstiness_score,
                        "ai_patterns": pattern_score,
                        "vocabulary_diversity": diversity_score,
                        "repetition": repetition_score,
                    },
                    "word_count": len(words),
                    "sentence_count": len(self._split_sentences(text)),
                    "annotations": annotations,
                    "limitation": "Heuristic detector - accuracy varies significantly",
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

    def _split_sentences(self, text: str) -> list[str]:
        """Split text into sentences."""
        # Simple sentence splitting
        sentences = re.split(r'[.!?]+', text)
        return [s.strip() for s in sentences if s.strip()]

    def _estimate_perplexity(self, text: str) -> float:
        """
        Estimate text perplexity using n-gram statistics.
        Lower perplexity often indicates AI-generated text.
        """
        # Tokenize
        if self._tokenizer:
            tokens = self._tokenizer.encode(text)
        else:
            tokens = text.lower().split()

        if len(tokens) < 10:
            return 0.5  # Not enough data

        # Calculate bigram probabilities
        bigrams = list(zip(tokens[:-1], tokens[1:]))
        unigram_counts = Counter(tokens)
        bigram_counts = Counter(bigrams)

        # Calculate log probability
        total_log_prob = 0
        for bigram in bigrams:
            # Simple add-1 smoothing
            p = (bigram_counts[bigram] + 1) / (unigram_counts[bigram[0]] + len(unigram_counts))
            total_log_prob += math.log(p)

        # Average perplexity
        avg_log_prob = total_log_prob / len(bigrams)
        perplexity = math.exp(-avg_log_prob)

        # Normalize: lower perplexity = higher AI score
        # Typical values: human ~100-300, AI ~50-150
        normalized = 1.0 - min(perplexity / 200, 1.0)
        return max(0, min(normalized, 1.0))

    def _calculate_burstiness(self, text: str) -> float:
        """
        Calculate burstiness (variance in sentence length).
        AI text tends to have more uniform sentence lengths.
        """
        sentences = self._split_sentences(text)
        if len(sentences) < 3:
            return 0.5

        lengths = [len(s.split()) for s in sentences]
        mean_length = sum(lengths) / len(lengths)

        if mean_length == 0:
            return 0.5

        # Calculate coefficient of variation
        variance = sum((l - mean_length) ** 2 for l in lengths) / len(lengths)
        std = math.sqrt(variance)
        cv = std / mean_length

        # Lower CV = more uniform = more likely AI
        # Human text typically has CV > 0.5
        ai_score = 1.0 - min(cv / 0.8, 1.0)
        return ai_score

    def _detect_ai_patterns(self, text: str) -> float:
        """
        Detect common AI writing patterns and phrases.
        """
        text_lower = text.lower()
        matches = 0

        for pattern in self.AI_PHRASES:
            if re.search(pattern, text_lower):
                matches += 1

        # Normalize by text length
        words = len(text.split())
        pattern_density = matches / (words / 100)  # matches per 100 words

        # More than 2-3 matches per 100 words is suspicious
        return min(pattern_density / 3, 1.0)

    def _calculate_vocabulary_diversity(self, text: str) -> float:
        """
        Calculate type-token ratio (vocabulary diversity).
        AI text sometimes has lower diversity.
        """
        words = re.findall(r'\b\w+\b', text.lower())
        if len(words) < 10:
            return 0.5

        unique_words = set(words)
        ttr = len(unique_words) / len(words)

        # Normalize: typical range is 0.4-0.8
        # Higher TTR = more diverse = more likely human
        return min(ttr / 0.7, 1.0)

    def _detect_repetition(self, text: str) -> float:
        """
        Detect phrase repetition, common in AI text.
        """
        sentences = self._split_sentences(text)
        if len(sentences) < 3:
            return 0.0

        # Check for similar sentence openings
        openings = [s.split()[:3] if len(s.split()) >= 3 else s.split() for s in sentences]
        opening_tuples = [tuple(o) for o in openings]
        opening_counts = Counter(opening_tuples)

        # Calculate repetition score
        repeated = sum(1 for count in opening_counts.values() if count > 1)
        repetition_ratio = repeated / len(sentences)

        return min(repetition_ratio * 3, 1.0)

    def _generate_annotations(self, text: str) -> list[dict]:
        """
        Generate per-section annotations for the text.
        """
        annotations = []
        sentences = self._split_sentences(text)

        for i, sentence in enumerate(sentences):
            start = text.find(sentence)
            if start == -1:
                continue

            end = start + len(sentence)

            # Quick heuristic for this sentence
            score = 0.0
            for pattern in self.AI_PHRASES:
                if re.search(pattern, sentence.lower()):
                    score += 0.3

            # Burstiness check
            words = len(sentence.split())
            if 15 <= words <= 25:  # Suspiciously uniform
                score += 0.2

            score = min(score, 1.0)

            if score > 0.3:
                annotations.append({
                    "start": start,
                    "end": end,
                    "ai": score >= 0.5,
                    "confidence": score,
                    "reason": "AI writing patterns detected" if score >= 0.5 else "Minor AI indicators",
                })

        return annotations

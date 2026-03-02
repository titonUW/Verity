# Verity

**AI Content Authenticity Platform**

> Detect AI-generated content and verify digital provenance.

Verity is a full-stack platform for detecting AI-generated images, videos, audio, and text, combined with cryptographic provenance verification. It provides:

1. **AI Detection**: Multi-signal detection of AI-generated content across all media types
2. **Provenance Verification**: Cryptographic verification of content authenticity
3. **Public API**: Developer-friendly REST API with AIorNot compatibility
4. **Web Interface**: Consumer and developer portal

## Features

### Detection Capabilities

| Media Type | Detectors | Status |
|------------|-----------|--------|
| **Image** | AI-generated, Deepfake, NSFW, Quality | ✅ Baseline |
| **Video** | AI-video, AI-voice, AI-music, Deepfake | ✅ Baseline |
| **Audio** | AI-voice, AI-music | ✅ Baseline |
| **Text** | AI-text with annotations | ✅ Baseline |

### Provenance Features

- **Verity Containers**: Full event chain with cryptographic signatures
- **C2PA/Content Credentials**: Industry standard verification
- **Transparency Log**: Certificate Transparency-style Merkle proofs
- **Watermark Detection**: SynthID and other AI watermarks

## Quick Start

### Prerequisites

- Docker and Docker Compose
- Node.js 20+ (for local development)
- Python 3.11+ (for inference service development)

### Run with Docker Compose

```bash
# Clone the repository
git clone https://github.com/your-org/verity.git
cd verity

# Copy environment configuration
cp .env.example .env

# Start all services
docker compose up -d

# Services will be available at:
# - Web UI:     http://localhost:3001
# - API:        http://localhost:3000
# - API Docs:   http://localhost:3000/docs
# - Inference:  http://localhost:8000
```

### Local Development

```bash
# Install dependencies
npm install

# Build packages
npm run build:packages

# Start services individually:

# Terminal 1: Database
docker compose up postgres redis -d

# Terminal 2: Inference service
cd services/inference
pip install -r requirements.txt
uvicorn verity_inference.main:app --reload --port 8000

# Terminal 3: API server
npm run dev:api

# Terminal 4: Web app
npm run dev:web
```

## API Reference

### Authentication

All API endpoints require Bearer token authentication:

```bash
curl -X POST https://api.verity.ai/v2/image/sync \
  -H "Authorization: Bearer vty_your_api_key" \
  -F "image=@photo.jpg"
```

### Native API (`/api/v1/`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/v1/detect/image` | Detect AI in image |
| POST | `/api/v1/detect/video` | Detect AI in video |
| POST | `/api/v1/detect/audio` | Detect AI in audio |
| POST | `/api/v1/detect/text` | Detect AI in text |
| POST | `/api/v1/jobs` | Create async job |
| GET | `/api/v1/jobs/:id` | Get job status |
| POST | `/api/v1/keys` | Create API key |
| GET | `/api/v1/keys` | List API keys |
| GET | `/api/v1/usage` | Get usage stats |

### Compatibility API (AIorNot-style)

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/v2/image/sync` | Multi-report image detection |
| POST | `/v2/video/sync` | Video detection |
| POST | `/v2/text/sync` | Text detection |
| POST | `/v1/reports/voice` | Voice detection |
| POST | `/v1/reports/music` | Music detection |
| GET | `/v1/system/live` | Health check |

### Example Response

```json
{
  "request_id": "550e8400-e29b-41d4-a716-446655440000",
  "timestamp": "2024-01-15T12:00:00Z",
  "media_type": "image",
  "media_hash": "sha256:abc123...",
  "verdict": "ai",
  "confidence": 0.92,
  "signals": [
    {
      "name": "ai_generated",
      "verdict": "ai",
      "confidence": 0.92,
      "model_version": "1.0.0-baseline"
    },
    {
      "name": "deepfake",
      "verdict": "unavailable",
      "confidence": 0,
      "model_version": "1.0.0-placeholder"
    }
  ],
  "provenance": {
    "verity_container": false,
    "c2pa": { "found": false },
    "watermark": { "detected": false }
  }
}
```

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                          apps/web                                │
│                    (Next.js Consumer UI)                         │
└─────────────────────────────┬───────────────────────────────────┘
                              │
┌─────────────────────────────▼───────────────────────────────────┐
│                          apps/api                                │
│              (Fastify API Server + OpenAPI)                      │
│  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐            │
│  │  Auth   │  │  Jobs   │  │ Detect  │  │ Compat  │            │
│  └─────────┘  └─────────┘  └─────────┘  └─────────┘            │
└─────────────────────────────┬───────────────────────────────────┘
                              │
┌─────────────────────────────▼───────────────────────────────────┐
│                    services/inference                            │
│              (Python FastAPI + ML Detectors)                     │
│  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐            │
│  │  Image  │  │  Video  │  │  Audio  │  │  Text   │            │
│  └─────────┘  └─────────┘  └─────────┘  └─────────┘            │
└─────────────────────────────────────────────────────────────────┘
                              │
┌─────────────────────────────▼───────────────────────────────────┐
│                        packages/*                                │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐              │
│  │ @verity/file│  │ @verity/log │  │@verity/verify│             │
│  └─────────────┘  └─────────────┘  └─────────────┘              │
└─────────────────────────────────────────────────────────────────┘
```

## Project Structure

```
verity/
├── apps/
│   ├── api/                 # Fastify API server
│   │   ├── src/
│   │   │   ├── routes/      # API routes (v1, v2, compat)
│   │   │   ├── plugins/     # Auth, rate limiting, etc.
│   │   │   └── services/    # Business logic
│   │   └── tests/
│   └── web/                 # Next.js web application
│       └── src/app/         # App router pages
├── services/
│   └── inference/           # Python ML inference service
│       └── verity_inference/
│           ├── detectors/   # Image, video, audio, text
│           ├── provenance/  # C2PA, watermarks
│           └── routes/      # FastAPI routes
├── packages/
│   ├── core/                # Shared types + Zod schemas
│   ├── verity-file/         # Container format library
│   ├── verity-log/          # Transparency log
│   ├── verity-verify/       # Verification engine
│   └── verity-cli/          # CLI tool
├── prisma/
│   └── schema.prisma        # Database schema
├── infra/
│   ├── docker-compose.yml
│   └── Dockerfile.*
├── docs/
│   ├── openapi.yaml         # API specification
│   └── examples/            # SDK examples
└── policies/                # Workflow policies
```

## Configuration

See `.env.example` for all configuration options:

```bash
# Database
DATABASE_URL=postgresql://verity:password@localhost:5432/verity

# Redis
REDIS_URL=redis://localhost:6379

# API Server
JWT_SECRET=your-secret-key
API_KEY_SALT=your-salt

# Inference
INFERENCE_URL=http://localhost:8000
ENABLE_GPU=false
```

## Detection Limitations

**Important**: The baseline detectors are heuristic-based and have limitations:

- **Image AI Detection**: Uses statistical analysis of pixel patterns. Accuracy varies by AI model.
- **Text AI Detection**: Uses perplexity and writing style analysis. May have false positives on formal text.
- **Deepfake Detection**: Placeholder - requires model weights to be downloaded.
- **Audio Detection**: Requires `librosa` for full functionality.

For production use, consider:
1. Training custom models on your target domains
2. Downloading specialized model weights
3. Using ensemble approaches with multiple detectors

## SDK Examples

### JavaScript

```javascript
const response = await fetch('https://api.verity.ai/v2/image/sync', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${API_KEY}`,
  },
  body: formData,
});

const result = await response.json();
console.log(result.report.verdict); // "ai" or "human"
```

### Python

```python
import requests

response = requests.post(
    'https://api.verity.ai/v2/image/sync',
    headers={'Authorization': f'Bearer {API_KEY}'},
    files={'image': open('photo.jpg', 'rb')}
)

result = response.json()
print(f"Verdict: {result['report']['verdict']}")
```

### cURL

```bash
# Image detection
curl -X POST https://api.verity.ai/v2/image/sync \
  -H "Authorization: Bearer vty_your_api_key" \
  -F "image=@photo.jpg"

# Text detection
curl -X POST https://api.verity.ai/v2/text/sync \
  -H "Authorization: Bearer vty_your_api_key" \
  -H "Content-Type: application/json" \
  -d '{"text": "Your text to analyze..."}'

# Create async job for large video
curl -X POST https://api.verity.ai/api/v1/jobs \
  -H "Authorization: Bearer vty_your_api_key" \
  -F "file=@video.mp4"

# Check job status
curl https://api.verity.ai/api/v1/jobs/JOB_ID \
  -H "Authorization: Bearer vty_your_api_key"
```

## Testing

```bash
# Run all tests
npm test

# Run API tests
npm run test:api

# Run inference tests
cd services/inference && pytest

# Run with coverage
npm test -- --coverage
```

## Security

### Privacy

- **Zero Retention**: Files are deleted immediately after processing by default
- **Hash Only**: Only content hashes are stored, not the actual content
- **Encrypted Storage**: Optional S3 storage uses encryption at rest

### API Security

- API keys are hashed with bcrypt before storage
- Rate limiting per API key
- CORS and helmet middleware enabled
- Input validation on all endpoints

## Rate Limits

| Tier | Requests/min | Requests/day | Max File Size |
|------|--------------|--------------|---------------|
| Free | 5 | 50 | 5 MB |
| Basic | 20 | 500 | 25 MB |
| Pro | 60 | 5,000 | 100 MB |
| Enterprise | 200 | 50,000 | 500 MB |

## License

MIT

## Contributing

Contributions welcome! Please:

1. Read the security considerations
2. Run tests before submitting PRs
3. Follow the existing code style
4. Document new features

---

**Verity** - *AI Content Authenticity Platform*

Detect AI. Verify Reality. Trust Content.

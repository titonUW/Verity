# Verity API - Python Examples

## Installation

```bash
pip install requests
```

## Image Detection

```python
import requests

API_KEY = 'vty_your_api_key'
API_URL = 'https://api.verity.ai'

def detect_image(image_path: str) -> dict:
    """Detect AI-generated content in an image."""
    with open(image_path, 'rb') as f:
        response = requests.post(
            f'{API_URL}/api/v1/detect/image',
            headers={'Authorization': f'Bearer {API_KEY}'},
            files={'file': f}
        )

    response.raise_for_status()
    result = response.json()

    print(f"Verdict: {result['verdict']}")
    print(f"Confidence: {result['confidence'] * 100:.1f}%")

    return result

# Usage
result = detect_image('./photo.jpg')
```

## Text Detection

```python
def detect_text(text: str, include_annotations: bool = False) -> dict:
    """Detect AI-generated text."""
    response = requests.post(
        f'{API_URL}/api/v1/detect/text',
        headers={
            'Authorization': f'Bearer {API_KEY}',
            'Content-Type': 'application/json'
        },
        json={
            'text': text,
            'include_annotations': include_annotations
        }
    )

    response.raise_for_status()
    return response.json()

# Usage
text = """
In conclusion, artificial intelligence has become an integral part of our daily lives.
Furthermore, the implications of this technology are far-reaching and multifaceted.
"""

result = detect_text(text, include_annotations=True)
print(f"Verdict: {result['verdict']}")

if result['signals'][0].get('metadata', {}).get('annotations'):
    print("Annotations:", result['signals'][0]['metadata']['annotations'])
```

## Async Job Processing

```python
import time

def process_large_video(video_path: str, webhook_url: str = None) -> dict:
    """Process a large video file asynchronously."""

    # Create job
    with open(video_path, 'rb') as f:
        data = {'webhook_url': webhook_url} if webhook_url else {}
        response = requests.post(
            f'{API_URL}/api/v1/jobs',
            headers={'Authorization': f'Bearer {API_KEY}'},
            files={'file': f},
            data=data
        )

    response.raise_for_status()
    job = response.json()
    job_id = job['job_id']
    print(f"Job created: {job_id}")

    # Poll for completion
    while True:
        time.sleep(5)  # Wait 5 seconds

        status_response = requests.get(
            f'{API_URL}/api/v1/jobs/{job_id}',
            headers={'Authorization': f'Bearer {API_KEY}'}
        )
        status_response.raise_for_status()

        job = status_response.json()
        status = job['status']
        progress = job.get('progress', 0)
        print(f"Status: {status} ({progress}%)")

        if status == 'completed':
            return job['result']
        elif status == 'failed':
            raise Exception(f"Job failed: {job.get('error')}")

# Usage
result = process_large_video('./large_video.mp4')
```

## API Key Management

```python
def create_api_key(name: str, scopes: list = None, expires_in_days: int = 30) -> dict:
    """Create a new API key."""
    response = requests.post(
        f'{API_URL}/api/v1/keys',
        headers={
            'Authorization': f'Bearer {API_KEY}',
            'Content-Type': 'application/json'
        },
        json={
            'name': name,
            'scopes': scopes or ['detect:*'],
            'rate_limit_tier': 'basic',
            'expires_in_days': expires_in_days
        }
    )

    response.raise_for_status()
    result = response.json()

    # IMPORTANT: Save this key! It won't be shown again.
    print(f"New API Key: {result['key']}")

    return result

def list_api_keys() -> dict:
    """List all API keys."""
    response = requests.get(
        f'{API_URL}/api/v1/keys',
        headers={'Authorization': f'Bearer {API_KEY}'}
    )

    response.raise_for_status()
    return response.json()
```

## AIorNot Compatibility

```python
def detect_image_compat(image_path: str) -> dict:
    """AIorNot-compatible image detection."""
    with open(image_path, 'rb') as f:
        response = requests.post(
            f'{API_URL}/v2/image/sync',
            headers={'Authorization': f'Bearer {API_KEY}'},
            files={'image': f}
        )

    response.raise_for_status()
    result = response.json()

    # AIorNot-compatible response format
    print(f"Verdict: {result['report']['verdict']}")
    print(f"AI Detected: {result['report']['ai']['is_detected']}")
    print(f"Confidence: {result['report']['ai']['confidence']}")

    return result
```

## Batch Processing

```python
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

def batch_detect_images(image_dir: str, max_workers: int = 5) -> list:
    """Process multiple images concurrently."""
    image_paths = list(Path(image_dir).glob('*.jpg')) + \
                  list(Path(image_dir).glob('*.png'))

    results = []

    with ThreadPoolExecutor(max_workers=max_workers) as executor:
        futures = {
            executor.submit(detect_image, str(path)): path
            for path in image_paths
        }

        for future in futures:
            path = futures[future]
            try:
                result = future.result()
                results.append({
                    'path': str(path),
                    'verdict': result['verdict'],
                    'confidence': result['confidence']
                })
            except Exception as e:
                results.append({
                    'path': str(path),
                    'error': str(e)
                })

    return results

# Usage
results = batch_detect_images('./images/')
for r in results:
    print(f"{r['path']}: {r.get('verdict', 'ERROR')}")
```

## Error Handling

```python
from requests.exceptions import HTTPError

def safe_detect(image_path: str) -> dict:
    """Detect with proper error handling."""
    try:
        return {'success': True, 'data': detect_image(image_path)}
    except HTTPError as e:
        if e.response.status_code == 401:
            return {'success': False, 'error': 'Invalid API key'}
        elif e.response.status_code == 413:
            return {'success': False, 'error': 'File too large'}
        elif e.response.status_code == 429:
            return {'success': False, 'error': 'Rate limit exceeded'}
        else:
            return {'success': False, 'error': str(e)}
    except Exception as e:
        return {'success': False, 'error': str(e)}
```

## Type Hints (Python 3.10+)

```python
from typing import TypedDict, Literal

class Signal(TypedDict):
    name: str
    verdict: Literal['ai', 'human', 'uncertain', 'unavailable']
    confidence: float
    model_version: str

class DetectionResult(TypedDict):
    request_id: str
    timestamp: str
    media_type: Literal['image', 'video', 'audio', 'text']
    media_hash: str
    verdict: Literal['ai', 'human', 'uncertain', 'unavailable']
    confidence: float
    signals: list[Signal]
    processing_time_ms: int

def detect_with_types(image_path: str) -> DetectionResult:
    """Typed detection function."""
    return detect_image(image_path)
```

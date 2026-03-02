# Verity API - JavaScript Examples

## Installation

```bash
npm install undici
```

## Image Detection

```javascript
import { request, FormData, File } from 'undici';
import { readFile } from 'fs/promises';

const API_KEY = 'vty_your_api_key';
const API_URL = 'https://api.verity.ai';

async function detectImage(imagePath) {
  const imageData = await readFile(imagePath);
  const formData = new FormData();
  formData.append('file', new File([imageData], 'image.jpg', { type: 'image/jpeg' }));

  const response = await request(`${API_URL}/api/v1/detect/image`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${API_KEY}`,
    },
    body: formData,
  });

  const result = await response.body.json();

  console.log(`Verdict: ${result.verdict}`);
  console.log(`Confidence: ${(result.confidence * 100).toFixed(1)}%`);

  return result;
}

// Usage
detectImage('./photo.jpg').then(console.log);
```

## Text Detection

```javascript
async function detectText(text) {
  const response = await request(`${API_URL}/api/v1/detect/text`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      text,
      include_annotations: true,
    }),
  });

  return response.body.json();
}

// Usage
const text = `
  In conclusion, artificial intelligence has become an integral part of our daily lives.
  Furthermore, the implications of this technology are far-reaching and multifaceted.
`;

detectText(text).then(result => {
  console.log(`Verdict: ${result.verdict}`);
  if (result.signals[0]?.metadata?.annotations) {
    console.log('Annotations:', result.signals[0].metadata.annotations);
  }
});
```

## Async Job Processing

```javascript
async function processLargeVideo(videoPath) {
  // Create job
  const videoData = await readFile(videoPath);
  const formData = new FormData();
  formData.append('file', new File([videoData], 'video.mp4', { type: 'video/mp4' }));
  formData.append('webhook_url', 'https://your-server.com/webhook');

  const createResponse = await request(`${API_URL}/api/v1/jobs`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${API_KEY}` },
    body: formData,
  });

  const { job_id } = await createResponse.body.json();
  console.log(`Job created: ${job_id}`);

  // Poll for completion
  let status = 'pending';
  while (status !== 'completed' && status !== 'failed') {
    await new Promise(r => setTimeout(r, 5000)); // Wait 5 seconds

    const statusResponse = await request(`${API_URL}/api/v1/jobs/${job_id}`, {
      headers: { 'Authorization': `Bearer ${API_KEY}` },
    });

    const job = await statusResponse.body.json();
    status = job.status;
    console.log(`Status: ${status} (${job.progress}%)`);

    if (status === 'completed') {
      return job.result;
    }
  }

  throw new Error('Job failed');
}
```

## API Key Management

```javascript
async function createApiKey(name, scopes = ['detect:*']) {
  const response = await request(`${API_URL}/api/v1/keys`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name,
      scopes,
      rate_limit_tier: 'basic',
      expires_in_days: 30,
    }),
  });

  const result = await response.body.json();

  // IMPORTANT: Save this key! It won't be shown again.
  console.log(`New API Key: ${result.key}`);

  return result;
}

async function listApiKeys() {
  const response = await request(`${API_URL}/api/v1/keys`, {
    headers: { 'Authorization': `Bearer ${API_KEY}` },
  });

  return response.body.json();
}
```

## AIorNot Compatibility

```javascript
// If migrating from AIorNot, use the compatibility endpoints:

async function detectImageCompat(imagePath) {
  const imageData = await readFile(imagePath);
  const formData = new FormData();
  formData.append('image', new File([imageData], 'image.jpg', { type: 'image/jpeg' }));

  const response = await request(`${API_URL}/v2/image/sync`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${API_KEY}` },
    body: formData,
  });

  const result = await response.body.json();

  // AIorNot-compatible response format
  console.log(`Verdict: ${result.report.verdict}`);
  console.log(`AI Detected: ${result.report.ai.is_detected}`);
  console.log(`Confidence: ${result.report.ai.confidence}`);

  return result;
}
```

## Error Handling

```javascript
async function safeDetect(imagePath) {
  try {
    const result = await detectImage(imagePath);
    return { success: true, data: result };
  } catch (error) {
    if (error.statusCode === 401) {
      return { success: false, error: 'Invalid API key' };
    }
    if (error.statusCode === 413) {
      return { success: false, error: 'File too large' };
    }
    if (error.statusCode === 429) {
      return { success: false, error: 'Rate limit exceeded' };
    }
    return { success: false, error: error.message };
  }
}
```

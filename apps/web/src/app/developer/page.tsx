'use client';

import { useState } from 'react';

export default function DeveloperPage() {
  const [apiKey, setApiKey] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  const generateKey = async () => {
    setLoading(true);
    // In production, this would call the actual API
    // For now, show a demo key format
    setTimeout(() => {
      setApiKey('vty_demo_' + Math.random().toString(36).slice(2, 34));
      setLoading(false);
    }, 1000);
  };

  const copyKey = () => {
    if (apiKey) {
      navigator.clipboard.writeText(apiKey);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="container mx-auto px-4 py-12">
      <div className="mx-auto max-w-4xl">
        <h1 className="mb-2 text-3xl font-bold">Developer Portal</h1>
        <p className="mb-8 text-muted-foreground">
          Access the Verity API to integrate AI content detection into your applications.
        </p>

        {/* API Key Section */}
        <section className="mb-12 rounded-lg border bg-card p-6">
          <h2 className="mb-4 text-xl font-semibold">API Key</h2>
          {!apiKey ? (
            <div>
              <p className="mb-4 text-muted-foreground">
                Generate an API key to start making requests.
              </p>
              <button
                onClick={generateKey}
                disabled={loading}
                className="rounded-lg bg-primary px-6 py-2 font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              >
                {loading ? 'Generating...' : 'Generate API Key'}
              </button>
            </div>
          ) : (
            <div>
              <div className="mb-4 flex items-center gap-2">
                <code className="flex-1 rounded bg-muted p-3 font-mono text-sm">
                  {apiKey}
                </code>
                <button
                  onClick={copyKey}
                  className="rounded-lg border px-4 py-2 hover:bg-muted"
                >
                  {copied ? '✓ Copied' : 'Copy'}
                </button>
              </div>
              <p className="text-sm text-yellow-600">
                ⚠️ Save this key now! It won't be shown again.
              </p>
            </div>
          )}
        </section>

        {/* Quick Start */}
        <section className="mb-12">
          <h2 className="mb-4 text-xl font-semibold">Quick Start</h2>
          <div className="space-y-6">
            <div>
              <h3 className="mb-2 font-medium">1. Install the SDK (optional)</h3>
              <pre className="overflow-x-auto rounded-lg bg-muted p-4 text-sm">
                npm install @verity/sdk
              </pre>
            </div>

            <div>
              <h3 className="mb-2 font-medium">2. Detect AI in an image</h3>
              <pre className="overflow-x-auto rounded-lg bg-muted p-4 text-sm">
{`curl -X POST https://api.verity.ai/v2/image/sync \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -F "image=@photo.jpg"`}
              </pre>
            </div>

            <div>
              <h3 className="mb-2 font-medium">3. Check the response</h3>
              <pre className="overflow-x-auto rounded-lg bg-muted p-4 text-sm">
{`{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "created_at": "2024-01-15T12:00:00Z",
  "report": {
    "verdict": "ai",
    "ai": { "is_detected": true, "confidence": 0.92 },
    "facet": { "is_detected": false, "confidence": 0.1 },
    "nsfw": { "is_detected": false, "confidence": 0.0 }
  },
  "hash": "sha256:abc123..."
}`}
              </pre>
            </div>
          </div>
        </section>

        {/* Endpoints */}
        <section className="mb-12">
          <h2 className="mb-4 text-xl font-semibold">API Endpoints</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="py-3 text-left">Method</th>
                  <th className="py-3 text-left">Endpoint</th>
                  <th className="py-3 text-left">Description</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b">
                  <td className="py-3 font-mono text-xs">POST</td>
                  <td className="py-3 font-mono text-xs">/v2/image/sync</td>
                  <td className="py-3">Detect AI in images</td>
                </tr>
                <tr className="border-b">
                  <td className="py-3 font-mono text-xs">POST</td>
                  <td className="py-3 font-mono text-xs">/v2/video/sync</td>
                  <td className="py-3">Detect AI in videos</td>
                </tr>
                <tr className="border-b">
                  <td className="py-3 font-mono text-xs">POST</td>
                  <td className="py-3 font-mono text-xs">/v2/text/sync</td>
                  <td className="py-3">Detect AI-generated text</td>
                </tr>
                <tr className="border-b">
                  <td className="py-3 font-mono text-xs">POST</td>
                  <td className="py-3 font-mono text-xs">/v1/reports/voice</td>
                  <td className="py-3">Detect AI voice</td>
                </tr>
                <tr className="border-b">
                  <td className="py-3 font-mono text-xs">POST</td>
                  <td className="py-3 font-mono text-xs">/v1/reports/music</td>
                  <td className="py-3">Detect AI music</td>
                </tr>
                <tr className="border-b">
                  <td className="py-3 font-mono text-xs">POST</td>
                  <td className="py-3 font-mono text-xs">/api/v1/jobs</td>
                  <td className="py-3">Create async detection job</td>
                </tr>
                <tr className="border-b">
                  <td className="py-3 font-mono text-xs">GET</td>
                  <td className="py-3 font-mono text-xs">/api/v1/jobs/:id</td>
                  <td className="py-3">Get job status/results</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        {/* Rate Limits */}
        <section>
          <h2 className="mb-4 text-xl font-semibold">Rate Limits</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="py-3 text-left">Tier</th>
                  <th className="py-3 text-left">Requests/min</th>
                  <th className="py-3 text-left">Requests/day</th>
                  <th className="py-3 text-left">Max file size</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b">
                  <td className="py-3">Free</td>
                  <td className="py-3">5</td>
                  <td className="py-3">50</td>
                  <td className="py-3">5 MB</td>
                </tr>
                <tr className="border-b">
                  <td className="py-3">Basic</td>
                  <td className="py-3">20</td>
                  <td className="py-3">500</td>
                  <td className="py-3">25 MB</td>
                </tr>
                <tr className="border-b">
                  <td className="py-3">Pro</td>
                  <td className="py-3">60</td>
                  <td className="py-3">5,000</td>
                  <td className="py-3">100 MB</td>
                </tr>
                <tr className="border-b">
                  <td className="py-3">Enterprise</td>
                  <td className="py-3">200</td>
                  <td className="py-3">50,000</td>
                  <td className="py-3">500 MB</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
}

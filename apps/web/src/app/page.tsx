'use client';

import Link from 'next/link';

export default function Home() {
  return (
    <div className="flex flex-col">
      {/* Hero Section */}
      <section className="container mx-auto px-4 py-24 text-center">
        <h1 className="mb-6 text-5xl font-bold tracking-tight">
          Verify What's Real
        </h1>
        <p className="mx-auto mb-8 max-w-2xl text-xl text-muted-foreground">
          Detect AI-generated images, videos, audio, and text with our advanced
          detection platform. Verify content authenticity with cryptographic provenance.
        </p>
        <div className="flex justify-center gap-4">
          <Link
            href="/check"
            className="inline-flex h-11 items-center justify-center rounded-md bg-primary px-8 text-sm font-medium text-primary-foreground shadow hover:bg-primary/90"
          >
            Check for AI
          </Link>
          <Link
            href="/developer"
            className="inline-flex h-11 items-center justify-center rounded-md border bg-background px-8 text-sm font-medium shadow-sm hover:bg-accent"
          >
            Get API Access
          </Link>
        </div>
      </section>

      {/* Features */}
      <section className="border-t bg-muted/50 py-24">
        <div className="container mx-auto px-4">
          <h2 className="mb-12 text-center text-3xl font-bold">
            Multi-Signal Detection
          </h2>
          <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-4">
            <FeatureCard
              title="Image Detection"
              description="Detect AI-generated images, deepfakes, and manipulations with high accuracy."
              icon="🖼️"
            />
            <FeatureCard
              title="Video Analysis"
              description="Analyze videos for AI-generated content, synthetic voices, and face swaps."
              icon="🎥"
            />
            <FeatureCard
              title="Audio Detection"
              description="Identify AI-generated voices and music with spectral analysis."
              icon="🎵"
            />
            <FeatureCard
              title="Text Analysis"
              description="Detect AI-written text with perplexity and linguistic analysis."
              icon="📝"
            />
          </div>
        </div>
      </section>

      {/* Provenance */}
      <section className="py-24">
        <div className="container mx-auto px-4">
          <div className="grid gap-12 lg:grid-cols-2">
            <div>
              <h2 className="mb-4 text-3xl font-bold">
                Cryptographic Provenance
              </h2>
              <p className="mb-6 text-muted-foreground">
                Go beyond detection with verifiable content provenance. Our platform
                supports industry standards for content authenticity:
              </p>
              <ul className="space-y-3">
                <li className="flex items-start gap-2">
                  <span className="text-green-500">✓</span>
                  <span>Verity containers with full event chain history</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-500">✓</span>
                  <span>C2PA/Content Credentials verification</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-500">✓</span>
                  <span>Transparency log integration with inclusion proofs</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-500">✓</span>
                  <span>Watermark detection for AI-generated content</span>
                </li>
              </ul>
            </div>
            <div className="rounded-lg border bg-card p-6">
              <pre className="overflow-x-auto text-sm">
{`{
  "verdict": "human",
  "confidence": 0.94,
  "provenance": {
    "verity_container": true,
    "human_origin": "YES",
    "event_chain_valid": true,
    "c2pa_manifest": {
      "issuer": "Adobe Photoshop",
      "signature_valid": true
    }
  }
}`}
              </pre>
            </div>
          </div>
        </div>
      </section>

      {/* API Section */}
      <section className="border-t bg-muted/50 py-24">
        <div className="container mx-auto px-4 text-center">
          <h2 className="mb-4 text-3xl font-bold">Developer API</h2>
          <p className="mx-auto mb-8 max-w-2xl text-muted-foreground">
            Integrate AI detection into your applications with our REST API.
            Compatible with existing AIorNot endpoints for easy migration.
          </p>
          <div className="mx-auto max-w-2xl rounded-lg border bg-card p-6 text-left">
            <pre className="overflow-x-auto text-sm">
{`curl -X POST https://api.verity.ai/v2/image/sync \\
  -H "Authorization: Bearer vty_your_api_key" \\
  -F "image=@photo.jpg"

# Response
{
  "id": "abc123",
  "report": {
    "verdict": "ai",
    "ai": { "is_detected": true, "confidence": 0.92 }
  }
}`}
            </pre>
          </div>
          <Link
            href="/developer"
            className="mt-8 inline-flex h-11 items-center justify-center rounded-md bg-primary px-8 text-sm font-medium text-primary-foreground shadow hover:bg-primary/90"
          >
            Get Your API Key
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t py-8">
        <div className="container mx-auto px-4 text-center text-sm text-muted-foreground">
          <p>&copy; 2024 Verity. Open source AI content authenticity platform.</p>
        </div>
      </footer>
    </div>
  );
}

function FeatureCard({
  title,
  description,
  icon,
}: {
  title: string;
  description: string;
  icon: string;
}) {
  return (
    <div className="rounded-lg border bg-card p-6">
      <div className="mb-4 text-4xl">{icon}</div>
      <h3 className="mb-2 text-lg font-semibold">{title}</h3>
      <p className="text-sm text-muted-foreground">{description}</p>
    </div>
  );
}

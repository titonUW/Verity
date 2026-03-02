'use client';

import { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';

type MediaType = 'image' | 'video' | 'audio' | 'text';
type TabType = MediaType;

interface DetectionResult {
  request_id: string;
  media_type: string;
  verdict: 'ai' | 'human' | 'uncertain' | 'unavailable';
  confidence: number;
  signals: Array<{
    name: string;
    verdict: string;
    confidence: number;
    model_version: string;
  }>;
  provenance?: {
    c2pa?: { found: boolean };
    watermark?: { detected: boolean };
  };
}

export default function CheckPage() {
  const [activeTab, setActiveTab] = useState<TabType>('image');
  const [file, setFile] = useState<File | null>(null);
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<DetectionResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    if (acceptedFiles.length > 0) {
      setFile(acceptedFiles[0]);
      setResult(null);
      setError(null);
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept:
      activeTab === 'image'
        ? { 'image/*': ['.png', '.jpg', '.jpeg', '.gif', '.webp'] }
        : activeTab === 'video'
        ? { 'video/*': ['.mp4', '.webm', '.mov'] }
        : activeTab === 'audio'
        ? { 'audio/*': ['.mp3', '.wav', '.ogg', '.m4a'] }
        : undefined,
    maxFiles: 1,
    disabled: activeTab === 'text',
  });

  const handleSubmit = async () => {
    if (activeTab === 'text' && !text.trim()) {
      setError('Please enter some text to analyze');
      return;
    }
    if (activeTab !== 'text' && !file) {
      setError('Please select a file to analyze');
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

      let response: Response;

      if (activeTab === 'text') {
        response = await fetch(`${apiUrl}/api/v1/detect/text`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ text }),
        });
      } else {
        const formData = new FormData();
        formData.append('file', file!);

        response = await fetch(`${apiUrl}/api/v1/detect/${activeTab}`, {
          method: 'POST',
          body: formData,
        });
      }

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error?.message || 'Detection failed');
      }

      const data = await response.json();
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const tabs: { id: TabType; label: string; icon: string }[] = [
    { id: 'image', label: 'Image', icon: '🖼️' },
    { id: 'video', label: 'Video', icon: '🎥' },
    { id: 'audio', label: 'Audio', icon: '🎵' },
    { id: 'text', label: 'Text', icon: '📝' },
  ];

  return (
    <div className="container mx-auto px-4 py-12">
      <div className="mx-auto max-w-2xl">
        <h1 className="mb-2 text-3xl font-bold">Check for AI</h1>
        <p className="mb-8 text-muted-foreground">
          Upload an image, video, audio file, or paste text to detect AI-generated content.
        </p>

        {/* Tabs */}
        <div className="mb-6 flex gap-2 border-b">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => {
                setActiveTab(tab.id);
                setFile(null);
                setText('');
                setResult(null);
                setError(null);
              }}
              className={`flex items-center gap-2 border-b-2 px-4 py-2 text-sm font-medium transition-colors ${
                activeTab === tab.id
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              <span>{tab.icon}</span>
              {tab.label}
            </button>
          ))}
        </div>

        {/* Upload Area */}
        {activeTab !== 'text' ? (
          <div
            {...getRootProps()}
            className={`mb-6 cursor-pointer rounded-lg border-2 border-dashed p-12 text-center transition-colors ${
              isDragActive ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'
            }`}
          >
            <input {...getInputProps()} />
            {file ? (
              <div>
                <p className="font-medium">{file.name}</p>
                <p className="text-sm text-muted-foreground">
                  {(file.size / 1024 / 1024).toFixed(2)} MB
                </p>
              </div>
            ) : isDragActive ? (
              <p>Drop the file here...</p>
            ) : (
              <div>
                <p className="mb-2 text-lg">
                  Drag and drop your {activeTab} file here
                </p>
                <p className="text-sm text-muted-foreground">
                  or click to select a file
                </p>
              </div>
            )}
          </div>
        ) : (
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Paste your text here to check if it's AI-generated..."
            className="mb-6 h-48 w-full rounded-lg border bg-background p-4 text-sm focus:border-primary focus:outline-none"
          />
        )}

        {/* Submit Button */}
        <button
          onClick={handleSubmit}
          disabled={loading || (activeTab === 'text' ? !text.trim() : !file)}
          className="w-full rounded-lg bg-primary px-6 py-3 font-medium text-primary-foreground shadow hover:bg-primary/90 disabled:opacity-50"
        >
          {loading ? 'Analyzing...' : 'Check for AI'}
        </button>

        {/* Error */}
        {error && (
          <div className="mt-6 rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-destructive">
            {error}
          </div>
        )}

        {/* Results */}
        {result && (
          <div className="mt-8 rounded-lg border bg-card p-6">
            <div className="mb-6 text-center">
              <div
                className={`mb-2 text-6xl ${
                  result.verdict === 'ai'
                    ? 'text-red-500'
                    : result.verdict === 'human'
                    ? 'text-green-500'
                    : 'text-yellow-500'
                }`}
              >
                {result.verdict === 'ai' ? '🤖' : result.verdict === 'human' ? '👤' : '❓'}
              </div>
              <h2 className="text-2xl font-bold capitalize">{result.verdict}</h2>
              <p className="text-muted-foreground">
                Confidence: {(result.confidence * 100).toFixed(1)}%
              </p>
            </div>

            <div className="space-y-4">
              <h3 className="font-semibold">Detection Signals</h3>
              {result.signals.map((signal) => (
                <div
                  key={signal.name}
                  className="flex items-center justify-between rounded-lg bg-muted/50 p-3"
                >
                  <div>
                    <p className="font-medium">{signal.name}</p>
                    <p className="text-xs text-muted-foreground">
                      v{signal.model_version}
                    </p>
                  </div>
                  <div className="text-right">
                    <p
                      className={`font-medium capitalize ${
                        signal.verdict === 'ai'
                          ? 'text-red-500'
                          : signal.verdict === 'human'
                          ? 'text-green-500'
                          : signal.verdict === 'unavailable'
                          ? 'text-gray-400'
                          : 'text-yellow-500'
                      }`}
                    >
                      {signal.verdict}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {(signal.confidence * 100).toFixed(0)}%
                    </p>
                  </div>
                </div>
              ))}
            </div>

            {result.provenance && (
              <div className="mt-6">
                <h3 className="mb-3 font-semibold">Provenance</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span>C2PA Manifest:</span>
                    <span>{result.provenance.c2pa?.found ? 'Found' : 'Not found'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Watermark:</span>
                    <span>
                      {result.provenance.watermark?.detected ? 'Detected' : 'Not detected'}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

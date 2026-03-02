import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the prisma module
vi.mock("@/lib/prisma", () => ({
  default: {
    fileRecord: {
      create: vi.fn(),
    },
    auditLog: {
      create: vi.fn(),
    },
  },
}));

// Import after mocking
import prisma from "@/lib/prisma";

// Helper to create a mock NextRequest
function createMockRequest(body: unknown): Request {
  return new Request("http://localhost:3000/api/intake", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

// Valid test data
const validPayload = {
  filename: "test.pdf",
  mime: "application/pdf",
  size: 1024,
  sha256: "a".repeat(64),
  workflow: "vendor-bank-change",
};

describe("POST /api/intake validation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects missing required fields", async () => {
    const { POST } = await import("@/app/api/intake/route");

    const req = createMockRequest({});
    const res = await POST(req as never);
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.error).toContain("Missing required fields");
  });

  it("rejects invalid sha256 format", async () => {
    const { POST } = await import("@/app/api/intake/route");

    const req = createMockRequest({
      ...validPayload,
      sha256: "invalid-hash",
    });
    const res = await POST(req as never);
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.error).toContain("sha256");
    expect(data.error).toContain("64-character");
  });

  it("rejects sha256 that is too short", async () => {
    const { POST } = await import("@/app/api/intake/route");

    const req = createMockRequest({
      ...validPayload,
      sha256: "a".repeat(32),
    });
    const res = await POST(req as never);
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.error).toContain("sha256");
  });

  it("rejects negative file size", async () => {
    const { POST } = await import("@/app/api/intake/route");

    const req = createMockRequest({
      ...validPayload,
      size: -100,
    });
    const res = await POST(req as never);
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.error).toContain("size");
    expect(data.error).toContain("positive integer");
  });

  it("rejects zero file size", async () => {
    const { POST } = await import("@/app/api/intake/route");

    const req = createMockRequest({
      ...validPayload,
      size: 0,
    });
    const res = await POST(req as never);
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.error).toContain("size");
  });

  it("rejects file size exceeding 100MB", async () => {
    const { POST } = await import("@/app/api/intake/route");

    const req = createMockRequest({
      ...validPayload,
      size: 200 * 1024 * 1024, // 200MB
    });
    const res = await POST(req as never);
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.error).toContain("size");
  });

  it("rejects unknown workflow", async () => {
    const { POST } = await import("@/app/api/intake/route");

    const req = createMockRequest({
      ...validPayload,
      workflow: "unknown-workflow",
    });
    const res = await POST(req as never);
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.error).toContain("workflow");
    expect(data.error).toContain("must be one of");
  });

  it("rejects empty filename", async () => {
    const { POST } = await import("@/app/api/intake/route");

    const req = createMockRequest({
      ...validPayload,
      filename: "",
    });
    const res = await POST(req as never);
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.error).toContain("filename");
  });

  it("rejects empty mime type", async () => {
    const { POST } = await import("@/app/api/intake/route");

    const req = createMockRequest({
      ...validPayload,
      mime: "",
    });
    const res = await POST(req as never);
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.error).toContain("mime");
  });

  it("accepts valid payload and creates file record", async () => {
    const { POST } = await import("@/app/api/intake/route");

    const mockFile = { id: "test-file-id", status: "QUEUED" };
    (prisma.fileRecord.create as ReturnType<typeof vi.fn>).mockResolvedValue(mockFile);
    (prisma.auditLog.create as ReturnType<typeof vi.fn>).mockResolvedValue({});

    const req = createMockRequest(validPayload);
    const res = await POST(req as never);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.id).toBe("test-file-id");
    expect(data.status).toBe("QUEUED");
    expect(data.message).toBe("File queued for verification");
  });

  it("accepts valid sha256 with uppercase letters", async () => {
    const { POST } = await import("@/app/api/intake/route");

    const mockFile = { id: "test-file-id", status: "QUEUED" };
    (prisma.fileRecord.create as ReturnType<typeof vi.fn>).mockResolvedValue(mockFile);
    (prisma.auditLog.create as ReturnType<typeof vi.fn>).mockResolvedValue({});

    const req = createMockRequest({
      ...validPayload,
      sha256: "A".repeat(64),
    });
    const res = await POST(req as never);

    expect(res.status).toBe(200);
  });

  it("accepts all valid workflows", async () => {
    const { POST } = await import("@/app/api/intake/route");

    const mockFile = { id: "test-file-id", status: "QUEUED" };
    (prisma.fileRecord.create as ReturnType<typeof vi.fn>).mockResolvedValue(mockFile);
    (prisma.auditLog.create as ReturnType<typeof vi.fn>).mockResolvedValue({});

    const workflows = [
      "vendor-bank-change",
      "wire-transfer",
      "hr-offer-letter",
      "insurance-claim",
      "content-publishing",
    ];

    for (const workflow of workflows) {
      const req = createMockRequest({ ...validPayload, workflow });
      const res = await POST(req as never);
      expect(res.status).toBe(200);
    }
  });

  it("rejects invalid JSON body", async () => {
    const { POST } = await import("@/app/api/intake/route");

    const req = new Request("http://localhost:3000/api/intake", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "not valid json",
    });
    const res = await POST(req as never);
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.error).toContain("Invalid JSON");
  });
});

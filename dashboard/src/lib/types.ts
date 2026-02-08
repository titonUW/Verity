// Verity Dashboard Type Definitions

export type Decision = "ALLOW" | "WARN" | "REQUIRE_EXTRA_VERIFICATION" | "BLOCK";
export type HumanOrigin = "YES" | "NO" | "UNAVAILABLE";
export type Grade = "A" | "B" | "C" | "D" | "F";
export type FileStatus = "QUEUED" | "PROCESSING" | "VERIFIED" | "FAILED";
export type Severity = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
export type EventType = "CAPTURE" | "EDIT" | "AI_EDIT" | "TRANSFER" | "SIGN" | "PUBLISH";

export interface TrustReport {
  human_origin_proof: {
    value: HumanOrigin;
    reason: string;
    evidence: Record<string, unknown>;
  };
  reality_confidence: {
    score: number;
    grade: Grade;
    reasons: SignalResult[];
    limitations: string;
  };
  context_decision: {
    workflow: string;
    decision: Decision;
    policy_version: string;
    rationale: string;
    matched_rules: string[];
  };
  integrity: {
    payload_hash_ok: boolean;
    manifest_signature_ok: boolean;
    event_chain_ok: boolean;
    transparency_log_ok: boolean;
  };
  timestamps: {
    ingested_at: string;
    verified_at: string;
  };
  ids: {
    file_id: string;
    run_id: string;
  };
}

export interface SignalResult {
  name: string;
  delta: number;
  severity: Severity;
  explanation: string;
  evidence: Record<string, unknown>;
}

export interface ProvenanceEvent {
  idx: number;
  eventType: EventType;
  eventTime: string;
  actorKeyId: string;
  eventHash: string;
  prevEventHash: string | null;
  signature: string;
  valid: boolean;
  metadata: Record<string, unknown>;
}

export interface TransparencyProof {
  leafIndex: number;
  leafHash: string;
  rootHash: string;
  treeSize: number;
  checkpointSig: string;
  proof: string[];
}

export interface FileWithReport {
  id: string;
  filename: string;
  mime: string;
  size: number;
  sha256: string;
  uploadedAt: Date;
  workflow: string;
  tags: string[];
  status: FileStatus;
  submitter: string | null;
  trustReport?: TrustReport;
  provenanceEvents?: ProvenanceEvent[];
  transparencyProof?: TransparencyProof;
}

export interface PolicyWorkflow {
  id: string;
  name: string;
  description: string;
  versions: PolicyVersion[];
}

export interface PolicyVersion {
  id: string;
  version: string;
  publishedAt: Date;
  isActive: boolean;
  policy: PolicyConfig;
}

export interface PolicyConfig {
  workflow_name: string;
  description: string;
  version: string;
  min_confidence: number;
  require_human_origin: boolean;
  require_transparency_log: boolean;
  decision_rules: DecisionRule[];
}

export interface DecisionRule {
  id: string;
  condition: string;
  decision: Decision;
  rationale: string;
}

export interface AuditEntry {
  id: string;
  action: string;
  entityType: string;
  entityId: string | null;
  actor: string;
  details: Record<string, unknown>;
  createdAt: Date;
}

export interface DashboardStats {
  totalFiles: number;
  verified: number;
  warnings: number;
  blocks: number;
  avgConfidence: number;
  humanOriginYes: number;
  humanOriginTotal: number;
}

export interface VerificationBundle {
  version: string;
  file: {
    sha256: string;
    filename: string;
    size: number;
  };
  trust_report: TrustReport;
  transparency_proof?: TransparencyProof;
  public_keys: {
    log_public_key?: string;
    capture_device_keys?: string[];
  };
  verification_instructions: string;
}

export const WORKFLOWS = [
  { id: "vendor-bank-change", name: "Vendor Bank Change", description: "Verification for vendor banking information updates" },
  { id: "wire-transfer", name: "Wire Transfer", description: "High-security verification for wire transfer authorizations" },
  { id: "hr-offer-letter", name: "HR Offer Letter", description: "Verification for employment offer letters" },
  { id: "insurance-claim", name: "Insurance Claim Intake", description: "Evidence verification for insurance claims" },
  { id: "content-publishing", name: "Content Publishing", description: "Verification for media content publishing" },
] as const;

export type WorkflowId = typeof WORKFLOWS[number]["id"];

export type ScanSummary = {
  totalFindings: number;
  totalAttacks?: number;
  critical: number;
  high: number;
  medium: number;
  low: number;
  info: number;
};

export type ScanRecord = {
  id: string;
  target: string;
  depth: string;
  runtime: string;
  mode: string;
  status: string;
  startedAt: string;
  completedAt: string | null;
  durationMs: number | null;
  summary: ScanSummary;
};

export type FindingRecord = {
  id: string;
  scanId: string;
  title: string;
  description: string;
  severity: string;
  category: string;
  status: string;
  fingerprint?: string | null;
  triageStatus: "new" | "accepted" | "suppressed";
  triageNote?: string | null;
  timestamp: number;
  score?: number | null;
  confidence?: number | null;
  evidenceRequest: string;
  evidenceResponse: string;
  evidenceAnalysis?: string | null;
};

export type FindingGroup = {
  fingerprint: string;
  latest: FindingRecord;
  count: number;
  scanCount: number;
};

export type DashboardResponse = {
  scans: ScanRecord[];
  groups: FindingGroup[];
};

export type FindingFamilyResponse = {
  fingerprint: string;
  latest: FindingRecord;
  rows: FindingRecord[];
};

export type ScanEventsResponse = {
  scan: ScanRecord;
  events: Array<{
    id: string;
    scanId: string;
    stage: string;
    eventType: string;
    findingId?: string | null;
    agentRole?: string | null;
    payload: Record<string, unknown> | null;
    timestamp: number;
  }>;
};

export type ScanFindingsResponse = {
  scan: ScanRecord;
  findings: FindingRecord[];
  groups: FindingGroup[];
};


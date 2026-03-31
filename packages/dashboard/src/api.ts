import type {
  DashboardResponse,
  FindingFamilyResponse,
  ScanEventsResponse,
  ScanFindingsResponse,
  ScanRecord,
} from "./types";

async function fetchJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });

  if (!response.ok) {
    let message = `${response.status} ${response.statusText}`;
    try {
      const data = await response.json() as { error?: string };
      if (data.error) message = data.error;
    } catch {
      // Ignore JSON parse failures for non-JSON error bodies.
    }
    throw new Error(message);
  }

  return response.json() as Promise<T>;
}

export function getDashboard(): Promise<DashboardResponse> {
  return fetchJson("/api/dashboard");
}

export async function getScans(): Promise<ScanRecord[]> {
  const data = await fetchJson<{ scans: ScanRecord[] }>("/api/scans");
  return data.scans;
}

export async function getScan(scanId: string): Promise<ScanRecord> {
  const data = await fetchJson<{ scan: ScanRecord }>(`/api/scans/${encodeURIComponent(scanId)}`);
  return data.scan;
}

export function getScanEvents(scanId: string): Promise<ScanEventsResponse> {
  return fetchJson(`/api/scans/${encodeURIComponent(scanId)}/events`);
}

export function getScanFindings(scanId: string): Promise<ScanFindingsResponse> {
  return fetchJson(`/api/scans/${encodeURIComponent(scanId)}/findings`);
}

export function getFindingFamily(fingerprint: string): Promise<FindingFamilyResponse> {
  return fetchJson(`/api/finding-family/${encodeURIComponent(fingerprint)}`);
}

export function updateFindingFamilyTriage(
  fingerprint: string,
  triageStatus: "new" | "accepted" | "suppressed",
  triageNote: string,
): Promise<{ ok: true }> {
  return fetchJson(`/api/finding-family/${encodeURIComponent(fingerprint)}/triage`, {
    method: "POST",
    body: JSON.stringify({ triageStatus, triageNote }),
  });
}


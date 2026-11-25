export interface OfficialResult {
  bib: string;
  timeSeconds: number | null;
  source: string;
  athleteName?: string;
}

export interface OfficialResultsProvider {
  id: string;
  lookup(raceName: string, bib: string): Promise<OfficialResult | null>;
}

/** Stub: returns null unless bib starts with DEMO and encodes mmss. */
export const stubOfficialResults: OfficialResultsProvider = {
  id: "stub",
  async lookup(_raceName, bib) {
    const m = /^DEMO[-_]?(\d{3,5})$/i.exec(bib.trim());
    if (!m) return null;
    const n = Number(m[1]);
    // Interpret as mmss or hmmss
    const secs = n >= 10000 ? Math.floor(n / 10000) * 3600 + Math.floor((n % 10000) / 100) * 60 + (n % 100)
      : Math.floor(n / 100) * 60 + (n % 100);
    return { bib, timeSeconds: secs, source: "stub-endu", athleteName: "Demo Runner" };
  },
};

export function getOfficialResultsProvider(): OfficialResultsProvider {
  return stubOfficialResults;
}

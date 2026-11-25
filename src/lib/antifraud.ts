/** Light GPX/FIT heuristics for virtual-credit uploads. */

export interface TrackPoint {
  lat: number;
  lon: number;
  time?: string;
  ele?: number;
  hr?: number;
  cad?: number;
}

export interface FraudCheckResult {
  ok: boolean;
  risk: "low" | "medium" | "high";
  reasons: string[];
}

const MAX_RUNNING_SPEED_MPS = 8.5; // ~3:00/km elite sprint burst
const CAR_SPEED_MPS = 12; // ~43 km/h

function haversineM(a: TrackPoint, b: TrackPoint): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export function checkTrack(points: TrackPoint[]): FraudCheckResult {
  const reasons: string[] = [];
  if (points.length < 5) {
    return { ok: false, risk: "high", reasons: ["Traccia troppo corta o metadati assenti"] };
  }

  let carSpikes = 0;
  let fastSpikes = 0;
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1];
    const b = points[i];
    if (!a.time || !b.time) continue;
    const dt = (new Date(b.time).getTime() - new Date(a.time).getTime()) / 1000;
    if (!(dt > 0)) continue;
    const dist = haversineM(a, b);
    const speed = dist / dt;
    if (speed > CAR_SPEED_MPS) carSpikes++;
    else if (speed > MAX_RUNNING_SPEED_MPS) fastSpikes++;
  }

  if (carSpikes > 2) reasons.push("Picchi di velocità tipici di auto/bici");
  if (fastSpikes > 8) reasons.push("Troppi spezzoni oltre passo di corsa plausibile");

  const risk = carSpikes > 2 ? "high" : fastSpikes > 8 ? "medium" : "low";
  return { ok: risk !== "high", risk, reasons };
}

/** Very small GPX parser for lat/lon/time. */
export function parseGpxPoints(xml: string): TrackPoint[] {
  const points: TrackPoint[] = [];
  const re = /<trkpt[^>]*lat="([^"]+)"[^>]*lon="([^"]+)"[^>]*>([\s\S]*?)<\/trkpt>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml))) {
    const block = m[3];
    const time = /<time>([^<]+)<\/time>/i.exec(block)?.[1];
    points.push({ lat: Number(m[1]), lon: Number(m[2]), time });
  }
  return points;
}

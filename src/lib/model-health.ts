export type TrafficState = 'normal' | 'busy' | 'high_traffic';

interface HealthEntry {
  state: TrafficState;
  reason?: string;
  updatedAt: number;
}

const TTL_MS = 10 * 60 * 1000; // keep high-traffic flag for 10 minutes
const health = new Map<string, HealthEntry>();

/** Baseline hints for free-tier models that commonly experience queue/demand spikes. */
const BASELINE: Record<string, { state: TrafficState; reason: string }> = {
  'gemini-3.8-flash': { state: 'high_traffic', reason: 'Sering high demand di free tier' },
  'google/gemma-4-31b-it:free': { state: 'busy', reason: 'Antrean provider gratis' },
};

export function markModelHighTraffic(modelId: string, reason = 'High traffic / rate limit'): void {
  health.set(modelId, { state: 'high_traffic', reason, updatedAt: Date.now() });
}

export function markModelHealthy(modelId: string): void {
  health.set(modelId, { state: 'normal', updatedAt: Date.now() });
}

export function getModelHealthSnapshot(): Record<string, { state: TrafficState; reason?: string }> {
  const now = Date.now();
  const out: Record<string, { state: TrafficState; reason?: string }> = {};

  for (const [id, base] of Object.entries(BASELINE)) {
    out[id] = { state: base.state, reason: base.reason };
  }
  for (const [id, entry] of health.entries()) {
    if (now - entry.updatedAt <= TTL_MS) {
      out[id] = { state: entry.state, reason: entry.reason };
    } else {
      health.delete(id);
    }
  }
  return out;
}

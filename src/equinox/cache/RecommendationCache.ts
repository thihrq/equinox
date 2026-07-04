import { createHash } from 'crypto';

export interface RecommendationCacheKeyInput {
  currentMembers: string[];
  format: string;
  allowLegendaries: boolean;
  teamIdentity: string;
}

interface CacheEntry<T> {
  value: T;
  createdAt: number;
  expiresAt: number;
  hits: number;
}

export interface RecommendationCacheStats {
  size: number;
  maxEntries: number;
  ttlMs: number;
  hits: number;
  misses: number;
  evictions: number;
}

const DEFAULT_TTL_MS = 15 * 60 * 1000;
const DEFAULT_MAX_ENTRIES = 100;
const CACHE_VERSION = 'equinox-recommendation-v1.0-sprint16';

function parsePositiveInteger(value: string | undefined, fallback: number): number {
  if (!value) return fallback;

  const parsed = Number(value);

  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }

  return Math.floor(parsed);
}

function normalizePokemonName(name: string): string {
  return String(name)
    .trim()
    .toLowerCase()
    .replace(/[\s_]+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-');
}

function normalizeFormat(format: string): string {
  return String(format || 'vanilla').trim().toLowerCase();
}

function normalizeIdentity(identity: string): string {
  return String(identity || 'balanced').trim().toLowerCase();
}

function cloneValue<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

export class RecommendationCache {
  private static readonly ttlMs = parsePositiveInteger(
    process.env.EQUINOX_RECOMMENDATION_CACHE_TTL_MS,
    DEFAULT_TTL_MS,
  );

  private static readonly maxEntries = parsePositiveInteger(
    process.env.EQUINOX_RECOMMENDATION_CACHE_MAX_ENTRIES,
    DEFAULT_MAX_ENTRIES,
  );

  private static readonly entries = new Map<string, CacheEntry<unknown>>();

  private static hits = 0;
  private static misses = 0;
  private static evictions = 0;

  public static buildKey(input: RecommendationCacheKeyInput): string {
    const members = input.currentMembers
      .map(normalizePokemonName)
      .filter(Boolean)
      .sort();

    const payload = {
      version: CACHE_VERSION,
      members,
      format: normalizeFormat(input.format),
      allowLegendaries: Boolean(input.allowLegendaries),
      teamIdentity: normalizeIdentity(input.teamIdentity),
    };

    return createHash('sha256')
      .update(JSON.stringify(payload))
      .digest('hex')
      .slice(0, 24);
  }

  public static get<T>(key: string): T | null {
    const entry = this.entries.get(key) as CacheEntry<T> | undefined;
    const now = Date.now();

    if (!entry) {
      this.misses++;
      return null;
    }

    if (entry.expiresAt <= now) {
      this.entries.delete(key);
      this.misses++;
      return null;
    }

    entry.hits++;
    this.hits++;

    // Refresh insertion order so the Map also behaves as a small LRU cache.
    this.entries.delete(key);
    this.entries.set(key, entry as CacheEntry<unknown>);

    return cloneValue(entry.value as T);
  }

  public static set<T>(key: string, value: T): void {
    const now = Date.now();

    if (this.entries.has(key)) {
      this.entries.delete(key);
    }

    this.entries.set(key, {
      value: cloneValue(value),
      createdAt: now,
      expiresAt: now + this.ttlMs,
      hits: 0,
    });

    this.enforceLimit();
  }

  public static clear(): void {
    this.entries.clear();
    this.hits = 0;
    this.misses = 0;
    this.evictions = 0;
  }

  public static stats(): RecommendationCacheStats {
    this.removeExpiredEntries();

    return {
      size: this.entries.size,
      maxEntries: this.maxEntries,
      ttlMs: this.ttlMs,
      hits: this.hits,
      misses: this.misses,
      evictions: this.evictions,
    };
  }

  private static enforceLimit(): void {
    this.removeExpiredEntries();

    while (this.entries.size > this.maxEntries) {
      const oldestKey = this.entries.keys().next().value as string | undefined;

      if (!oldestKey) return;

      this.entries.delete(oldestKey);
      this.evictions++;
    }
  }

  private static removeExpiredEntries(): void {
    const now = Date.now();

    for (const [key, entry] of this.entries.entries()) {
      if (entry.expiresAt <= now) {
        this.entries.delete(key);
      }
    }
  }
}

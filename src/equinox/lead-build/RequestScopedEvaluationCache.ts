export interface EvaluationCacheMetrics {
  hits: number;
  misses: number;
  writes: number;
  uniqueKeys: number;
  duplicateEvaluationsAvoided: number;
  capacityReached: boolean;
}

export class RequestScopedEvaluationCache<T> {
  private readonly map = new Map<string, T>();
  private readonly maxEntries: number;

  private hits = 0;
  private misses = 0;
  private writes = 0;
  private capacityReached = false;

  constructor(maxEntries = 500) {
    this.maxEntries = maxEntries;
  }

  get(key: string): T | undefined {
    const val = this.map.get(key);
    if (val !== undefined) {
      this.hits++;
      return val;
    }
    this.misses++;
    return undefined;
  }

  has(key: string): boolean {
    return this.map.has(key);
  }

  set(key: string, value: T): void {
    if (this.map.has(key)) {
      this.map.set(key, value);
      return;
    }

    if (this.map.size >= this.maxEntries) {
      this.capacityReached = true;
      return;
    }

    this.map.set(key, value);
    this.writes++;
  }

  getMetrics(): EvaluationCacheMetrics {
    return {
      hits: this.hits,
      misses: this.misses,
      writes: this.writes,
      uniqueKeys: this.map.size,
      duplicateEvaluationsAvoided: this.hits,
      capacityReached: this.capacityReached,
    };
  }

  clear(): void {
    this.map.clear();
    this.hits = 0;
    this.misses = 0;
    this.writes = 0;
    this.capacityReached = false;
  }
}

export type CacheSource = "generated" | "cache" | "coalesced";

export type CacheOutcome<T> = {
  value: T;
  source: CacheSource;
};

type Entry<T> = {
  value: T;
  expiresAt: number;
};

/**
 * Small in-memory LRU with a TTL, plus in-flight request coalescing.
 *
 * The coalescing half matters more than the caching half here: IDM-VTON runs on
 * a shared ZeroGPU pool with a hard per-day quota, so two identical requests
 * arriving while the first is still running must share one generation rather
 * than spend two slots.
 */
export class ResultCache<T> {
  private readonly entries = new Map<string, Entry<T>>();
  private readonly inFlight = new Map<string, Promise<T>>();

  constructor(
    private readonly maxEntries: number,
    private readonly ttlMs: number,
    private readonly now: () => number = Date.now,
  ) {}

  get size(): number {
    return this.entries.size;
  }

  get(key: string): T | undefined {
    if (this.maxEntries <= 0) return undefined;

    const entry = this.entries.get(key);
    if (!entry) return undefined;

    if (entry.expiresAt <= this.now()) {
      this.entries.delete(key);
      return undefined;
    }

    // Refresh recency: re-inserting moves the key to the end of the Map order.
    this.entries.delete(key);
    this.entries.set(key, entry);
    return entry.value;
  }

  set(key: string, value: T): void {
    if (this.maxEntries <= 0) return;

    this.entries.delete(key);
    this.entries.set(key, { value, expiresAt: this.now() + this.ttlMs });

    while (this.entries.size > this.maxEntries) {
      const oldest = this.entries.keys().next();
      if (oldest.done) break;
      this.entries.delete(oldest.value);
    }
  }

  clear(): void {
    this.entries.clear();
  }

  async resolve(key: string, produce: () => Promise<T>): Promise<CacheOutcome<T>> {
    const cached = this.get(key);
    if (cached !== undefined) {
      return { value: cached, source: "cache" };
    }

    const pending = this.inFlight.get(key);
    if (pending) {
      return { value: await pending, source: "coalesced" };
    }

    const task = produce();
    this.inFlight.set(key, task);

    try {
      const value = await task;
      this.set(key, value);
      return { value, source: "generated" };
    } finally {
      this.inFlight.delete(key);
    }
  }
}

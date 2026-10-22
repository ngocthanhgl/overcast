export interface TimedJsonOptions {
  timeout?: number;
  headers?: Record<string, string>;
}

/** Minimal fetch helper for provider adapters: JSON only, abort on timeout, null on any failure. */
export async function fetchJsonWithTimeout(url: string, opts: TimedJsonOptions = {}): Promise<any | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), opts.timeout ?? 7000);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      cache: 'no-cache',
      headers: opts.headers,
    });
    if (!response.ok) return null;
    return await response.json();
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

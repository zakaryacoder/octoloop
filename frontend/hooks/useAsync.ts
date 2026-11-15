"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export interface AsyncState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  refetch: () => void;
  setData: (d: T | null) => void;
}

/**
 * Generic client-side data fetcher. `fetcher` may be null to skip (e.g. while
 * deps are unresolved). Re-runs when `deps` change.
 */
export function useAsync<T>(
  fetcher: (() => Promise<T>) | null,
  deps: unknown[] = []
): AsyncState<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState<boolean>(!!fetcher);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  const mounted = useRef(true);

  const refetch = useCallback(() => setTick((t) => t + 1), []);

  useEffect(() => {
    mounted.current = true;
    if (!fetcher) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetcher()
      .then((d) => {
        if (cancelled || !mounted.current) return;
        setData(d);
        setLoading(false);
      })
      .catch((e: unknown) => {
        if (cancelled || !mounted.current) return;
        setError(e instanceof Error ? e.message : "Request failed");
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, tick]);

  useEffect(() => {
    return () => {
      mounted.current = false;
    };
  }, []);

  return { data, loading, error, refetch, setData };
}

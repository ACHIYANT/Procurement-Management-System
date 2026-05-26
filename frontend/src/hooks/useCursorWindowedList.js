import { startTransition, useCallback, useEffect, useRef, useState } from "react";

const MIN_PRIMARY_LOADER_MS = 180;

const dedupeRowsByKey = (rows = [], rowKey = "id") => {
  const seen = new Set();
  const deduped = [];

  for (const row of rows) {
    const key = row?.[rowKey];
    if (key == null) {
      deduped.push(row);
      continue;
    }
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(row);
  }

  return deduped;
};

export default function useCursorWindowedList({
  fetchPage,
  deps = [],
  pageSize = 100,
  maxBufferRows = 1200,
  trimBatch = 400,
  enabled = true,
  rowKey = "id",
}) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(Boolean(enabled));
  const [isFetchingMore, setIsFetchingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [nextCursor, setNextCursor] = useState(null);
  const [virtualStartIndex, setVirtualStartIndex] = useState(0);
  const [error, setError] = useState(null);

  const rowsRef = useRef([]);
  const fetchingRef = useRef(false);
  const requestIdRef = useRef(0);
  const virtualStartRef = useRef(0);
  const primaryLoadStartedAtRef = useRef(0);

  useEffect(() => {
    rowsRef.current = rows;
  }, [rows]);

  useEffect(() => {
    virtualStartRef.current = virtualStartIndex;
  }, [virtualStartIndex]);

  const fetchRows = useCallback(
    async ({ cursorValue = null, append = false } = {}) => {
      if (!enabled || (append && fetchingRef.current)) return;

      const requestId = ++requestIdRef.current;
      if (append) {
        fetchingRef.current = true;
        setIsFetchingMore(true);
      } else {
        primaryLoadStartedAtRef.current = Date.now();
        setLoading(true);
        setError(null);
      }

      try {
        const response = await fetchPage({
          cursor: cursorValue,
          limit: pageSize,
          append,
        });

        if (requestId !== requestIdRef.current) return;

        const nextRows = Array.isArray(response?.rows) ? response.rows : [];
        const meta = response?.meta || {};
        const fetchedNextCursor =
          typeof meta.nextCursor === "string" && meta.nextCursor.trim()
            ? meta.nextCursor
            : null;

        if (append) {
          const merged = dedupeRowsByKey([...rowsRef.current, ...nextRows], rowKey);
          let nextData = merged;
          let nextVirtualStart = virtualStartRef.current;

          if (merged.length > maxBufferRows) {
            const trimBy = Math.min(trimBatch, merged.length - maxBufferRows);
            nextData = merged.slice(trimBy);
            nextVirtualStart += trimBy;
          }

          rowsRef.current = nextData;
          virtualStartRef.current = nextVirtualStart;
          startTransition(() => {
            setRows(nextData);
            setVirtualStartIndex(nextVirtualStart);
          });
        } else {
          const dedupedInitialRows = dedupeRowsByKey(nextRows, rowKey);
          rowsRef.current = dedupedInitialRows;
          virtualStartRef.current = 0;
          startTransition(() => {
            setRows(dedupedInitialRows);
            setVirtualStartIndex(0);
          });
        }

        startTransition(() => {
          setHasMore(Boolean(meta.hasMore));
          setNextCursor(fetchedNextCursor);
        });
      } catch (caughtError) {
        if (requestId !== requestIdRef.current) return;
        setError(caughtError);
        if (!append) {
          rowsRef.current = [];
          virtualStartRef.current = 0;
          startTransition(() => {
            setRows([]);
            setVirtualStartIndex(0);
            setHasMore(false);
            setNextCursor(null);
          });
        }
      } finally {
        if (append) {
          fetchingRef.current = false;
          setIsFetchingMore(false);
        } else if (requestId === requestIdRef.current) {
          const elapsed = Date.now() - primaryLoadStartedAtRef.current;
          const waitFor = Math.max(0, MIN_PRIMARY_LOADER_MS - elapsed);
          window.setTimeout(() => {
            if (requestId === requestIdRef.current) setLoading(false);
          }, waitFor);
        }
      }
    },
    [enabled, fetchPage, maxBufferRows, pageSize, rowKey, trimBatch],
  );

  useEffect(() => {
    if (!enabled) return undefined;

    const timeoutId = window.setTimeout(() => {
      fetchRows({ cursorValue: null, append: false });
    }, 0);

    return () => window.clearTimeout(timeoutId);
    // `deps` intentionally controls cursor reset from the caller.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, fetchRows, pageSize, ...deps]);

  const loadMore = useCallback(() => {
    if (!enabled || loading || isFetchingMore || !hasMore || !nextCursor) return;
    fetchRows({ cursorValue: nextCursor, append: true });
  }, [enabled, fetchRows, hasMore, isFetchingMore, loading, nextCursor]);

  const refresh = useCallback(() => {
    if (!enabled) return;
    fetchRows({ cursorValue: null, append: false });
  }, [enabled, fetchRows]);

  return {
    rows,
    setRows,
    loading,
    isFetchingMore,
    hasMore,
    nextCursor,
    virtualStartIndex,
    error,
    loadMore,
    refresh,
  };
}

import {
  memo,
  useCallback,
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { ChevronDown, ChevronUp } from "lucide-react";

const chipColorMap = {
  blue: "bg-[#f0f7ff] text-[#0066cc]",
  cyan: "bg-[#f0f7ff] text-[#0066cc]",
  green: "bg-[#f4fbf6] text-[#1d6f42]",
  yellow: "bg-[#fff8ec] text-[#8a5a00]",
  red: "bg-[#fff4f4] text-[#b42318]",
  gray: "bg-[#f5f5f7] text-[#4b5563]",
  slate: "bg-[#1d1d1f] text-white",
};

const getNestedValue = (row, key) =>
  String(key || "")
    .split(".")
    .reduce((value, path) => (value == null ? undefined : value[path]), row);

const isRowSelected = (selectedRows, rowId) =>
  Array.isArray(selectedRows)
    ? selectedRows.includes(rowId)
    : selectedRows === rowId;

const Chip = memo(function Chip({ label, color = "gray" }) {
  return (
    <span
      className={`inline-flex whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold ${
        chipColorMap[color] || chipColorMap.gray
      }`}
    >
      {label || "NA"}
    </span>
  );
});

export default function ListTable({
  columns = [],
  data = [],
  idCol = "id",
  selectedRows = null,
  onRowSelect,
  onRowClick,
  onLoadMore,
  hasMore = false,
  loading = false,
  virtualStartIndex = 0,
  getRowClassName,
  sortConfig: controlledSortConfig,
  onSortChange,
}) {
  const parentRef = useRef(null);
  const rafRef = useRef(0);
  const lastVirtualStartRef = useRef(virtualStartIndex);
  const pointerStateRef = useRef({
    startX: 0,
    startY: 0,
    moved: false,
  });
  const dragPanRef = useRef({
    active: false,
    moved: false,
    startX: 0,
    startY: 0,
    pointerX: 0,
    pointerY: 0,
    moveHandler: null,
    upHandler: null,
    rafId: null,
  });
  const [sortConfig, setSortConfig] = useState(null);
  const effectiveSortConfig = controlledSortConfig ?? sortConfig;
  const [scrollTop, setScrollTop] = useState(0);
  const [containerHeight, setContainerHeight] = useState(560);
  const [focusedRowId, setFocusedRowId] = useState(null);

  const ROW_HEIGHT = 56;
  const OVERSCAN = 8;
  const DRAG_THRESHOLD_PX = 8;
  const AUTO_PAN_MAX_SPEED = 18;
  const AUTO_PAN_DIVISOR = 16;
  const LOAD_MORE_THRESHOLD_PX = 960;
  const deferredData = useDeferredValue(data);
  const selectedRowSet = useMemo(
    () => (Array.isArray(selectedRows) ? new Set(selectedRows) : null),
    [selectedRows],
  );

  const sortedData = useMemo(() => {
    if (onSortChange) return deferredData;
    if (!effectiveSortConfig) return deferredData;
    const { key, direction } = effectiveSortConfig;
    const multiplier = direction === "asc" ? 1 : -1;

    return [...deferredData].sort((first, second) => {
      const firstValue = getNestedValue(first, key);
      const secondValue = getNestedValue(second, key);

      if (firstValue == null && secondValue == null) return 0;
      if (firstValue == null) return 1;
      if (secondValue == null) return -1;

      if (!Number.isNaN(Number(firstValue)) && !Number.isNaN(Number(secondValue))) {
        return (Number(firstValue) - Number(secondValue)) * multiplier;
      }

      return (
        String(firstValue).localeCompare(String(secondValue), undefined, {
          numeric: true,
          sensitivity: "base",
        }) * multiplier
      );
    });
  }, [deferredData, effectiveSortConfig, onSortChange]);

  const toggleSort = (key) => {
    if (onSortChange) {
      const current = effectiveSortConfig;
      if (!current || current.key !== key) {
        onSortChange({ key, direction: "asc" });
        return;
      }
      if (current.direction === "asc") {
        onSortChange({ key, direction: "desc" });
        return;
      }
      onSortChange(null);
      return;
    }

    setSortConfig((current) => {
      if (!current || current.key !== key) return { key, direction: "asc" };
      if (current.direction === "asc") return { key, direction: "desc" };
      return null;
    });
  };

  useEffect(() => {
    const element = parentRef.current;
    if (!element || typeof ResizeObserver === "undefined") return undefined;

    const observer = new ResizeObserver((entries) => {
      const height = entries[0]?.contentRect?.height;
      if (height) setContainerHeight(height);
    });

    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const delta = Number(virtualStartIndex || 0) - Number(lastVirtualStartRef.current || 0);
    lastVirtualStartRef.current = virtualStartIndex;

    if (delta > 0 && parentRef.current) {
      parentRef.current.scrollTop = Math.max(0, parentRef.current.scrollTop - delta * ROW_HEIGHT);
      setScrollTop(parentRef.current.scrollTop);
    }
  }, [virtualStartIndex]);

  const handleScroll = useCallback(() => {
    const element = parentRef.current;
    if (!element) return;

    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(() => {
      const nextScrollTop = element.scrollTop;
      setScrollTop(nextScrollTop);

      const distanceFromBottom = element.scrollHeight - nextScrollTop - element.clientHeight;
      if (distanceFromBottom < LOAD_MORE_THRESHOLD_PX && hasMore && !loading) {
        onLoadMore?.();
      }
    });
  }, [hasMore, loading, onLoadMore]);

  useEffect(() => {
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  const beginPointerTrack = (event) => {
    pointerStateRef.current = {
      startX: event.clientX ?? 0,
      startY: event.clientY ?? 0,
      moved: false,
    };
  };

  const updatePointerTrack = (event) => {
    const dx = Math.abs((event.clientX ?? 0) - pointerStateRef.current.startX);
    const dy = Math.abs((event.clientY ?? 0) - pointerStateRef.current.startY);
    if (dx > DRAG_THRESHOLD_PX || dy > DRAG_THRESHOLD_PX) {
      pointerStateRef.current.moved = true;
    }
  };

  const handleRowSingleClick = (rowId, row) => {
    if (pointerStateRef.current.moved) return;
    setFocusedRowId(rowId);
    onRowSelect?.(rowId, row);
  };

  const handleRowDoubleClick = (rowId, row) => {
    if (pointerStateRef.current.moved) return;
    onRowClick?.(rowId, row);
  };

  const isInteractiveTarget = (target) => {
    if (!(target instanceof Element)) return false;
    return Boolean(
      target.closest(
        "input, button, a, textarea, select, label, [role='button'], [data-no-drag-pan='true']",
      ),
    );
  };

  const detachDragPanListeners = () => {
    const { moveHandler, upHandler, rafId } = dragPanRef.current;
    if (moveHandler) window.removeEventListener("mousemove", moveHandler);
    if (upHandler) window.removeEventListener("mouseup", upHandler);
    if (rafId) cancelAnimationFrame(rafId);
    dragPanRef.current.moveHandler = null;
    dragPanRef.current.upHandler = null;
    dragPanRef.current.rafId = null;
    dragPanRef.current.active = false;
  };

  useEffect(() => {
    return () => detachDragPanListeners();
  }, []);

  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

  const startAutoPanLoop = () => {
    const tick = () => {
      const state = dragPanRef.current;
      if (!state.active) return;

      const host = parentRef.current;
      if (!host) return;

      const dx = state.pointerX - state.startX;
      const dy = state.pointerY - state.startY;
      const absDx = Math.abs(dx);
      const absDy = Math.abs(dy);

      if (absDx > DRAG_THRESHOLD_PX || absDy > DRAG_THRESHOLD_PX) {
        state.moved = true;
        pointerStateRef.current.moved = true;

        const vx = clamp(
          dx / AUTO_PAN_DIVISOR,
          -AUTO_PAN_MAX_SPEED,
          AUTO_PAN_MAX_SPEED,
        );
        const vy = clamp(
          dy / AUTO_PAN_DIVISOR,
          -AUTO_PAN_MAX_SPEED,
          AUTO_PAN_MAX_SPEED,
        );

        host.scrollLeft += vx;
        host.scrollTop += vy;
      }

      dragPanRef.current.rafId = requestAnimationFrame(tick);
    };

    dragPanRef.current.rafId = requestAnimationFrame(tick);
  };

  const handleDragPanStart = (event) => {
    if (event.button !== 0 || isInteractiveTarget(event.target)) return;

    const host = parentRef.current;
    if (!host) return;

    dragPanRef.current = {
      active: true,
      moved: false,
      startX: event.clientX ?? 0,
      startY: event.clientY ?? 0,
      pointerX: event.clientX ?? 0,
      pointerY: event.clientY ?? 0,
      moveHandler: null,
      upHandler: null,
      rafId: null,
    };

    pointerStateRef.current = {
      startX: event.clientX ?? 0,
      startY: event.clientY ?? 0,
      moved: false,
    };

    const handleMove = (moveEvent) => {
      const state = dragPanRef.current;
      if (!state.active) return;

      state.pointerX = moveEvent.clientX ?? state.pointerX;
      state.pointerY = moveEvent.clientY ?? state.pointerY;

      if (state.moved) moveEvent.preventDefault();
    };

    const handleUp = () => {
      detachDragPanListeners();
    };

    dragPanRef.current.moveHandler = handleMove;
    dragPanRef.current.upHandler = handleUp;
    window.addEventListener("mousemove", handleMove, { passive: false });
    window.addEventListener("mouseup", handleUp);
    startAutoPanLoop();
  };

  const virtualWindow = useMemo(() => {
    const startIndex = Math.max(0, Math.floor(scrollTop / ROW_HEIGHT) - OVERSCAN);
    const visibleCount = Math.ceil(containerHeight / ROW_HEIGHT) + OVERSCAN * 2;
    const endIndex = Math.min(sortedData.length, startIndex + visibleCount);
    const visibleRows = sortedData.slice(startIndex, endIndex);

    return {
      startIndex,
      visibleRows,
      paddingTop: startIndex * ROW_HEIGHT,
      paddingBottom: Math.max(0, (sortedData.length - endIndex) * ROW_HEIGHT),
    };
  }, [containerHeight, scrollTop, sortedData]);

  const colSpan = columns.length + (onRowSelect ? 1 : 0);

  return (
    <div className="overflow-hidden rounded-[24px] bg-white shadow-[0_20px_50px_-40px_rgba(0,0,0,0.45)] ring-1 ring-black/8">
      <div
        ref={parentRef}
        className="h-[calc(100vh-18rem)] min-h-[28rem] overflow-auto [scrollbar-gutter:stable] select-none"
        onScroll={handleScroll}
        onMouseDown={handleDragPanStart}
      >
        <table className="min-w-[1100px] w-full border-collapse text-left text-sm">
          <thead className="sticky top-0 z-10 bg-[#f5f5f7] text-[11px] uppercase tracking-[0.22em] text-black/42">
            <tr>
              {onRowSelect ? <th className="w-12 px-4 py-3">Select</th> : null}
              {columns.map((column) => {
                const sortKey = column.sortKey || column.key;
                const isSorted = effectiveSortConfig?.key === sortKey;
                return (
                  <th key={column.key} className="whitespace-nowrap px-4 py-3 font-semibold">
                    <button
                      type="button"
                      className={`inline-flex items-center gap-1 ${
                        column.sortable ? "cursor-pointer hover:text-[#1d1d1f]" : "cursor-default"
                      }`}
                      onClick={() => column.sortable && toggleSort(sortKey)}
                    >
                      {column.label}
                      {column.sortable && isSorted && effectiveSortConfig.direction === "asc" ? (
                        <ChevronUp className="h-3.5 w-3.5" />
                      ) : null}
                      {column.sortable && isSorted && effectiveSortConfig.direction === "desc" ? (
                        <ChevronDown className="h-3.5 w-3.5" />
                      ) : null}
                    </button>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody className="divide-y divide-black/6">
            {virtualWindow.paddingTop > 0 ? (
              <tr aria-hidden="true">
                <td colSpan={colSpan} style={{ height: virtualWindow.paddingTop, padding: 0 }} />
              </tr>
            ) : null}

            {virtualWindow.visibleRows.map((row) => {
              const rowId = getNestedValue(row, idCol);
              const selected = selectedRowSet
                ? selectedRowSet.has(rowId)
                : isRowSelected(selectedRows, rowId);
              const focused = focusedRowId === rowId;
              const rowClassName = getRowClassName?.(row) || "bg-white border-l-4 border-slate-300";

              return (
                <tr
                  key={rowId}
                  style={{ height: ROW_HEIGHT }}
                  className={`transition ${rowClassName} ${
                    selected
                      ? "ring-2 ring-inset ring-[#0071e3]/25"
                      : focused
                        ? "ring-2 ring-inset ring-sky-300/45"
                        : "hover:bg-[#fafafc]"
                  } ${onRowClick || onRowSelect ? "cursor-pointer" : ""}`}
                  onPointerDown={beginPointerTrack}
                  onPointerMove={updatePointerTrack}
                  onClick={() => handleRowSingleClick(rowId, row)}
                  onDoubleClick={() => handleRowDoubleClick(rowId, row)}
                >
                  {onRowSelect ? (
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        checked={selected}
                        onClick={(event) => event.stopPropagation()}
                        onChange={(event) => {
                          event.stopPropagation();
                          onRowSelect(rowId, row);
                        }}
                        className="h-4 w-4 rounded border-black/20 text-[#0071e3]"
                      />
                    </td>
                  ) : null}
                  {columns.map((column) => {
                    const value = getNestedValue(row, column.key);
                    const chip = column.chipMap?.[value] || column.chip;
                    return (
                      <td key={column.key} className="whitespace-nowrap px-4 py-3 text-black/68">
                        {column.render ? (
                          column.render(value, row)
                        ) : chip ? (
                          <Chip label={column.format ? column.format(value, row) : value} color={chip.color} />
                        ) : (
                          column.format ? column.format(value, row) : (value ?? "NA")
                        )}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
            {virtualWindow.paddingBottom > 0 ? (
              <tr aria-hidden="true">
                <td colSpan={colSpan} style={{ height: virtualWindow.paddingBottom, padding: 0 }} />
              </tr>
            ) : null}
            {loading ? (
              <tr>
                <td colSpan={colSpan} className="px-4 py-4 text-center text-sm text-slate-500">
                  Loading more records...
                </td>
              </tr>
            ) : null}
            {!loading && hasMore ? (
              <tr>
                <td colSpan={colSpan} className="px-4 py-4 text-center text-xs text-slate-400">
                  Scroll down to load the next cursor page.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}

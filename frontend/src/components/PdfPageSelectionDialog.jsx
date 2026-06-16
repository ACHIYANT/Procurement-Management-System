import { useEffect, useMemo, useRef, useState } from "react";
import { Check, FileText, Loader2, RotateCcw } from "lucide-react";
import * as pdfjs from "pdfjs-dist";
import PdfWorker from "pdfjs-dist/build/pdf.worker.min.mjs?worker&inline";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

const THUMBNAIL_ROW_HEIGHT = 176;
const THUMBNAIL_MIN_COLUMN_WIDTH = 150;
const PREVIEW_ROW_HEIGHT = 1320;
const THUMBNAIL_OVERSCAN_ROWS = 2;
const PREVIEW_OVERSCAN_ROWS = 0;
const PREVIEW_MAX_CSS_WIDTH = 1120;
const PREVIEW_MAX_CSS_HEIGHT = 1160;
const PREVIEW_MAX_PIXEL_RATIO = 2;
const PREVIEW_MIN_PIXEL_RATIO = 1.5;
const PREVIEW_MAX_CANVAS_PIXELS = 8_000_000;
const LARGE_PDF_PAGE_THRESHOLD = 100;
const SELECTION_SUMMARY_LIMIT = 80;
const PDF_EXTRACTION_CHUNK_SIZE = 50;
const PAGE_IMAGE_CACHE_LIMIT = 80;

const pageImageCache = new Map();

const rememberPageImage = (key, src) => {
  if (!key || !src) return;
  if (pageImageCache.has(key)) pageImageCache.delete(key);
  pageImageCache.set(key, src);
  while (pageImageCache.size > PAGE_IMAGE_CACHE_LIMIT) {
    const oldestKey = pageImageCache.keys().next().value;
    pageImageCache.delete(oldestKey);
  }
};

const isPdfJsCancellation = (error) => {
  const message = String(error?.message || "");
  return (
    error?.name === "RenderingCancelledException" ||
    error?.name === "AbortException" ||
    message.includes("Worker was destroyed") ||
    message.includes("Worker task was terminated")
  );
};

const createInlinePdfWorker = () =>
  new pdfjs.PDFWorker({ port: new PdfWorker() });

const destroyPdfResources = async ({ loadingTask, pdfDocument, pdfWorker, sourceUrl }) => {
  try {
    if (pdfDocument?.destroy) {
      await pdfDocument.destroy();
    } else if (loadingTask?.destroy) {
      await loadingTask.destroy();
    }
  } catch (destroyError) {
    if (!isPdfJsCancellation(destroyError)) {
      // Swallow cleanup errors; the next file load should not be blocked by teardown.
    }
  } finally {
    pdfWorker?.destroy?.();
    if (sourceUrl) URL.revokeObjectURL(sourceUrl);
  }
};

const clampNumber = (value, min, max) => Math.min(Math.max(value, min), max);

const getPreviewPixelRatio = () =>
  clampNumber(
    typeof window === "undefined" ? 1.5 : window.devicePixelRatio || 1,
    PREVIEW_MIN_PIXEL_RATIO,
    PREVIEW_MAX_PIXEL_RATIO,
  );

const formatRanges = (pages = []) => {
  if (!pages.length) return "";
  const ranges = [];
  let start = pages[0];
  let previous = pages[0];

  for (let index = 1; index < pages.length; index += 1) {
    const page = pages[index];
    if (page === previous + 1) {
      previous = page;
      continue;
    }
    ranges.push(start === previous ? String(start) : `${start}-${previous}`);
    start = page;
    previous = page;
  }

  ranges.push(start === previous ? String(start) : `${start}-${previous}`);
  return ranges.join(", ");
};

const isAscendingOrder = (pages = []) =>
  pages.every((page, index) => index === 0 || page > pages[index - 1]);

const sortedPages = (pages = []) => [...pages].sort((left, right) => left - right);

const formatPageSelection = (pages = []) =>
  isAscendingOrder(pages) ? formatRanges(pages) : pages.join(", ");

const formatPageSelectionSummary = (pages = []) => {
  const formatted = formatPageSelection(pages);
  if (pages.length <= SELECTION_SUMMARY_LIMIT || formatted.length <= 600) {
    return formatted;
  }

  return `${pages.slice(0, SELECTION_SUMMARY_LIMIT).join(", ")} ... (${pages.length} pages selected)`;
};

const yieldToBrowser = () =>
  new Promise((resolve) => {
    if (typeof window !== "undefined" && typeof window.requestIdleCallback === "function") {
      window.requestIdleCallback(resolve, { timeout: 120 });
      return;
    }
    window.setTimeout(resolve, 0);
  });

const parsePageRange = (value, pageCount) => {
  const pages = [];
  const seenPages = new Set();
  const parts = String(value || "")
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);

  for (const part of parts) {
    const rangeMatch = part.match(/^(\d+)\s*-\s*(\d+)$/);
    if (rangeMatch) {
      const start = Number(rangeMatch[1]);
      const end = Number(rangeMatch[2]);
      if (!start || !end || start > end || end > pageCount) {
        throw new Error(`Invalid page range: ${part}. This PDF has ${pageCount} pages.`);
      }
      for (let page = start; page <= end; page += 1) {
        if (seenPages.has(page)) {
          throw new Error(`Page ${page} is repeated.`);
        }
        seenPages.add(page);
        pages.push(page);
      }
      continue;
    }

    const page = Number(part);
    if (!Number.isInteger(page) || page < 1 || page > pageCount) {
      throw new Error(`Invalid page number: ${part}. This PDF has ${pageCount} pages.`);
    }
    if (seenPages.has(page)) {
      throw new Error(`Page ${page} is repeated.`);
    }
    seenPages.add(page);
    pages.push(page);
  }

  return pages;
};

const renderPageToDataUrl = async (pdf, pageNumber, scale, onRenderTask) => {
  const page = await pdf.getPage(pageNumber);
  const viewport = page.getViewport({ scale });
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");
  canvas.width = Math.ceil(viewport.width);
  canvas.height = Math.ceil(viewport.height);
  const renderTask = page.render({ canvasContext: context, viewport });
  onRenderTask?.(renderTask);
  await renderTask.promise;
  return canvas.toDataURL("image/png");
};

const renderPageToCanvas = async (
  pdf,
  pageNumber,
  {
    maxCssHeight,
    maxCssWidth,
    pixelRatio,
  },
  canvas,
  onRenderTask,
) => {
  const page = await pdf.getPage(pageNumber);
  const baseViewport = page.getViewport({ scale: 1 });
  const cssScale = Math.min(
    maxCssWidth / baseViewport.width,
    maxCssHeight / baseViewport.height,
  );
  const cssWidth = Math.max(Math.floor(baseViewport.width * cssScale), 1);
  const cssHeight = Math.max(Math.floor(baseViewport.height * cssScale), 1);
  let renderScale = cssScale * pixelRatio;
  const estimatedPixels = baseViewport.width * renderScale * baseViewport.height * renderScale;

  if (estimatedPixels > PREVIEW_MAX_CANVAS_PIXELS) {
    renderScale *= Math.sqrt(PREVIEW_MAX_CANVAS_PIXELS / estimatedPixels);
  }

  const viewport = page.getViewport({ scale: renderScale });
  const context = canvas.getContext("2d", { alpha: false });
  canvas.width = Math.ceil(viewport.width);
  canvas.height = Math.ceil(viewport.height);
  canvas.style.width = `${cssWidth}px`;
  canvas.style.height = `${cssHeight}px`;
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, canvas.width, canvas.height);
  const renderTask = page.render({ canvasContext: context, viewport });
  onRenderTask?.(renderTask);
  await renderTask.promise;
};

function useVirtualCursor({
  itemCount,
  rowHeight,
  fixedColumnCount = null,
  minColumnWidth = 0,
  overscanRows = 1,
}) {
  const viewportRef = useRef(null);
  const frameRef = useRef(0);
  const [viewport, setViewport] = useState({
    height: 0,
    scrollTop: 0,
    width: 0,
  });

  useEffect(() => {
    const element = viewportRef.current;
    if (!element) return undefined;

    const updateViewport = () => {
      setViewport((current) => ({
        ...current,
        height: element.clientHeight,
        width: element.clientWidth,
      }));
    };

    updateViewport();

    if (typeof ResizeObserver !== "undefined") {
      const observer = new ResizeObserver(updateViewport);
      observer.observe(element);
      return () => observer.disconnect();
    }

    window.addEventListener("resize", updateViewport);
    return () => window.removeEventListener("resize", updateViewport);
  }, []);

  useEffect(
    () => () => {
      if (frameRef.current) window.cancelAnimationFrame(frameRef.current);
    },
    [],
  );

  const columnCount = fixedColumnCount
    ? Math.max(1, fixedColumnCount)
    : Math.max(1, Math.floor((viewport.width || minColumnWidth) / minColumnWidth));
  const rowCount = Math.ceil(itemCount / columnCount);
  const startRow = Math.max(
    0,
    Math.floor(viewport.scrollTop / rowHeight) - overscanRows,
  );
  const endRow = Math.min(
    Math.max(rowCount - 1, 0),
    Math.floor(Math.max(viewport.scrollTop + viewport.height - 1, 0) / rowHeight) +
      overscanRows,
  );
  const startIndex = rowCount ? startRow * columnCount : 0;
  const endIndex = rowCount ? Math.min(itemCount, (endRow + 1) * columnCount) : 0;
  const totalHeight = rowCount * rowHeight;

  const virtualItems = useMemo(
    () =>
      Array.from({ length: Math.max(endIndex - startIndex, 0) }, (_, offset) => {
        const index = startIndex + offset;
        const row = Math.floor(index / columnCount);
        const column = index % columnCount;
        return {
          column,
          index,
          key: index,
          left: `${(column / columnCount) * 100}%`,
          top: row * rowHeight,
          width: `${100 / columnCount}%`,
        };
      }),
    [columnCount, endIndex, rowHeight, startIndex],
  );

  const handleScroll = (event) => {
    const element = event.currentTarget;
    const nextViewport = {
      height: element.clientHeight,
      scrollTop: element.scrollTop,
      width: element.clientWidth,
    };

    if (frameRef.current) window.cancelAnimationFrame(frameRef.current);
    frameRef.current = window.requestAnimationFrame(() => {
      setViewport(nextViewport);
      frameRef.current = 0;
    });
  };

  const scrollToIndex = (index) => {
    const safeIndex = Math.min(Math.max(Number(index) || 0, 0), Math.max(itemCount - 1, 0));
    const row = Math.floor(safeIndex / columnCount);
    const top = row * rowHeight;

    if (viewportRef.current) {
      viewportRef.current.scrollTo({ top, behavior: "auto" });
    }

    setViewport((current) => ({ ...current, scrollTop: top }));
  };

  return {
    columnCount,
    endIndex,
    handleScroll,
    scrollToIndex,
    startIndex,
    totalHeight,
    virtualItems,
    viewportRef,
  };
}

const createSelectedPdfFile = async (file, selectedPages) => {
  const { PDFDocument } = await import("pdf-lib");
  const sourceBytes = await file.arrayBuffer();
  const sourcePdf = await PDFDocument.load(sourceBytes);
  const outputPdf = await PDFDocument.create();

  for (let index = 0; index < selectedPages.length; index += PDF_EXTRACTION_CHUNK_SIZE) {
    const pageIndexes = selectedPages
      .slice(index, index + PDF_EXTRACTION_CHUNK_SIZE)
      .map((page) => page - 1);
    const copiedPages = await outputPdf.copyPages(sourcePdf, pageIndexes);
    copiedPages.forEach((page) => outputPdf.addPage(page));
    await yieldToBrowser();
  }

  const outputBytes = await outputPdf.save();
  const originalName = String(file.name || "document.pdf").replace(/\.pdf$/i, "");
  return new File([outputBytes], `${originalName}_selected_pages.pdf`, {
    type: "application/pdf",
  });
};

function PdfPageImage({
  cacheKey,
  pdf,
  pageNumber,
  scale,
  className,
  placeholderClassName,
  rootMargin = "300px 0px",
  renderDelayMs = 0,
}) {
  const containerRef = useRef(null);
  const [visible, setVisible] = useState(false);
  const [src, setSrc] = useState(() => pageImageCache.get(cacheKey) || "");
  const [rendering, setRendering] = useState(false);

  useEffect(() => {
    setSrc(pageImageCache.get(cacheKey) || "");
  }, [cacheKey]);

  useEffect(() => {
    const element = containerRef.current;
    if (!element) return undefined;

    if (!window.IntersectionObserver) {
      setVisible(true);
      return undefined;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin },
    );

    observer.observe(element);
    return () => observer.disconnect();
  }, [rootMargin]);

  useEffect(() => {
    if (!visible || !pdf || src) return undefined;

    let cancelled = false;
    let renderTask = null;
    let timeoutId = null;
    let idleId = null;
    const render = async () => {
      try {
        setRendering(true);
        const nextSrc = await renderPageToDataUrl(
          pdf,
          pageNumber,
          scale,
          (task) => {
            renderTask = task;
          },
        );
        rememberPageImage(cacheKey, nextSrc);
        if (!cancelled) setSrc(nextSrc);
      } catch (renderError) {
        if (!cancelled && !isPdfJsCancellation(renderError)) {
          setSrc("");
        }
      } finally {
        if (!cancelled) setRendering(false);
      }
    };

    const scheduleRender = () => {
      if (renderDelayMs > 0) {
        timeoutId = window.setTimeout(render, renderDelayMs);
        return;
      }
      if (typeof window.requestIdleCallback === "function") {
        idleId = window.requestIdleCallback(render, { timeout: 180 });
        return;
      }
      timeoutId = window.setTimeout(render, 0);
    };

    scheduleRender();
    return () => {
      cancelled = true;
      if (timeoutId) window.clearTimeout(timeoutId);
      if (idleId) window.cancelIdleCallback?.(idleId);
      renderTask?.cancel?.();
    };
  }, [cacheKey, pageNumber, pdf, renderDelayMs, scale, src, visible]);

  return (
    <div
      ref={containerRef}
      className={placeholderClassName}
    >
      {src ? (
        <img
          src={src}
          alt={`Page ${pageNumber}`}
          className={className}
        />
      ) : (
        <div className="flex h-full min-h-24 items-center justify-center text-xs text-slate-500">
          {rendering ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Rendering
            </>
          ) : (
            `Page ${pageNumber}`
          )}
        </div>
      )}
    </div>
  );
}

function PdfPageCanvas({
  pdf,
  pageNumber,
  fastPixelRatio = null,
  pixelRatio,
  className,
  placeholderClassName,
  rootMargin = "120px 0px",
  renderDelayMs = 40,
}) {
  const containerRef = useRef(null);
  const canvasRef = useRef(null);
  const [visible, setVisible] = useState(false);
  const [rendering, setRendering] = useState(false);
  const [failed, setFailed] = useState(false);
  const [hasPaint, setHasPaint] = useState(false);

  useEffect(() => {
    setFailed(false);
    setHasPaint(false);
  }, [pageNumber, pdf]);

  useEffect(() => {
    const element = containerRef.current;
    if (!element) return undefined;

    if (!window.IntersectionObserver) {
      setVisible(true);
      return undefined;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        setVisible(entry.isIntersecting);
      },
      { rootMargin },
    );

    observer.observe(element);
    return () => observer.disconnect();
  }, [rootMargin]);

  useEffect(() => {
    if (!visible || !pdf || !canvasRef.current) return undefined;

    let cancelled = false;
    let renderTask = null;
    let timeoutId = null;
    let idleId = null;

    const renderCanvasPass = async (nextPixelRatio) => {
      const maxCssWidth = Math.min(
        Math.max((containerRef.current?.clientWidth || PREVIEW_MAX_CSS_WIDTH) - 32, 280),
        PREVIEW_MAX_CSS_WIDTH,
      );
      await renderPageToCanvas(
        pdf,
        pageNumber,
        {
          maxCssHeight: PREVIEW_MAX_CSS_HEIGHT,
          maxCssWidth,
          pixelRatio: nextPixelRatio,
        },
        canvasRef.current,
        (task) => {
          renderTask = task;
        },
      );
      if (!cancelled) setHasPaint(true);
    };

    const render = async () => {
      try {
        setRendering(true);
        setFailed(false);
        if (fastPixelRatio && fastPixelRatio < pixelRatio) {
          await renderCanvasPass(fastPixelRatio);
          await yieldToBrowser();
          if (cancelled) return;
        }
        await renderCanvasPass(pixelRatio);
      } catch (renderError) {
        if (!cancelled && !isPdfJsCancellation(renderError)) {
          setFailed(true);
        }
      } finally {
        if (!cancelled) setRendering(false);
      }
    };

    if (renderDelayMs > 0) {
      timeoutId = window.setTimeout(render, renderDelayMs);
    } else if (typeof window.requestIdleCallback === "function") {
      idleId = window.requestIdleCallback(render, { timeout: 160 });
    } else {
      timeoutId = window.setTimeout(render, 0);
    }

    return () => {
      cancelled = true;
      if (timeoutId) window.clearTimeout(timeoutId);
      if (idleId) window.cancelIdleCallback?.(idleId);
      renderTask?.cancel?.();
    };
  }, [fastPixelRatio, pageNumber, pdf, pixelRatio, renderDelayMs, visible]);

  return (
    <div ref={containerRef} className={placeholderClassName}>
      {!hasPaint && !failed ? (
        <div className="absolute inset-0 flex items-center justify-center rounded-sm bg-gradient-to-br from-slate-50 via-white to-slate-100">
          <div className="h-[82%] w-[72%] rounded-sm border border-slate-200 bg-white shadow-inner" />
        </div>
      ) : null}
      {rendering ? (
        <div className="absolute left-3 top-3 z-10 inline-flex items-center rounded-full bg-white/90 px-3 py-1 text-xs font-medium text-slate-600 shadow-sm">
          <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
          Rendering page
        </div>
      ) : null}
      {failed ? (
        <div className="flex min-h-[18rem] items-center justify-center text-sm text-rose-600">
          Unable to render page {pageNumber}
        </div>
      ) : null}
      <canvas
        ref={canvasRef}
        className={hasPaint ? className : "absolute h-0 w-0 opacity-0"}
      />
    </div>
  );
}

export default function PdfPageSelectionDialog({
  file,
  open,
  onCancel,
  onConfirm,
  confirmLabel = "Upload selected pages",
}) {
  const [loading, setLoading] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [pageCount, setPageCount] = useState(0);
  const [selectedPages, setSelectedPages] = useState([]);
  const [orderConfirmation, setOrderConfirmation] = useState(null);
  const [rangeInput, setRangeInput] = useState("");
  const [showThumbnails, setShowThumbnails] = useState(true);
  const [previewEnabled, setPreviewEnabled] = useState(true);
  const [thumbnailJumpInput, setThumbnailJumpInput] = useState("1");
  const [error, setError] = useState("");
  const [pdfDocument, setPdfDocument] = useState(null);

  const selectedSet = useMemo(() => new Set(selectedPages), [selectedPages]);
  const pdfCacheKey = useMemo(
    () =>
      file
        ? `${file.name || "pdf"}:${file.size || 0}:${file.lastModified || 0}`
        : "pdf",
    [file],
  );
  const {
    columnCount: thumbnailColumnCount,
    endIndex: thumbnailEndIndex,
    handleScroll: handleThumbnailScroll,
    scrollToIndex: scrollToThumbnailIndex,
    startIndex: thumbnailStartIndex,
    totalHeight: thumbnailTotalHeight,
    virtualItems: virtualThumbnailItems,
    viewportRef: thumbnailViewportRef,
  } = useVirtualCursor({
    itemCount: pageCount,
    minColumnWidth: THUMBNAIL_MIN_COLUMN_WIDTH,
    overscanRows: THUMBNAIL_OVERSCAN_ROWS,
    rowHeight: showThumbnails ? THUMBNAIL_ROW_HEIGHT : 118,
  });
  const {
    endIndex: previewEndIndex,
    handleScroll: handlePreviewScroll,
    scrollToIndex: scrollToPreviewIndex,
    startIndex: previewStartIndex,
    totalHeight: previewTotalHeight,
    virtualItems: virtualPreviewItems,
    viewportRef: previewViewportRef,
  } = useVirtualCursor({
    fixedColumnCount: 1,
    itemCount: previewEnabled ? selectedPages.length : 0,
    overscanRows: PREVIEW_OVERSCAN_ROWS,
    rowHeight: PREVIEW_ROW_HEIGHT,
  });
  const selectedPagesAreOriginalDocument =
    pageCount > 0 &&
    selectedPages.length === pageCount &&
    selectedPages.every((page, index) => page === index + 1);
  const allPagesSelected = selectedPagesAreOriginalDocument;
  const selectionSummary = useMemo(
    () => formatPageSelectionSummary(selectedPages),
    [selectedPages],
  );
  const hasLargeSelection = selectedPages.length > LARGE_PDF_PAGE_THRESHOLD;

  const focusSelection = (pages) => {
    const firstPage = pages[0] || 1;
    setPreviewEnabled(Boolean(pages.length));
    setShowThumbnails(Boolean(pages.length));
    scrollToPreviewIndex(0);
    setThumbnailJumpInput(String(firstPage));
    scrollToThumbnailIndex(firstPage - 1);
  };

  const applyThumbnailJump = () => {
    const pageNumber = Math.min(
      Math.max(Number(thumbnailJumpInput) || 1, 1),
      Math.max(pageCount, 1),
    );
    setThumbnailJumpInput(String(pageNumber));
    scrollToThumbnailIndex(pageNumber - 1);
  };

  const thumbnailCursorSize = Math.max(
    thumbnailEndIndex - thumbnailStartIndex,
    thumbnailColumnCount,
    1,
  );
  const previewCursorSize = Math.max(previewEndIndex - previewStartIndex, 1);
  const thumbnailWindowLabel = pageCount
    ? `${Math.min(thumbnailStartIndex + 1, pageCount)}-${thumbnailEndIndex}`
    : "0";
  const previewWindowLabel = selectedPages.length
    ? `${Math.min(previewStartIndex + 1, selectedPages.length)}-${previewEndIndex}`
    : "0";
  const isLargePdf = pageCount > LARGE_PDF_PAGE_THRESHOLD;

  useEffect(() => {
    if (!open || !file) return undefined;

    let cancelled = false;
    let sourceUrl = "";
    let loadingTask = null;
    let loadedPdf = null;
    let pdfWorker = null;
    const loadPdf = async () => {
      try {
        setLoading(true);
        setError("");
        setPdfDocument(null);

        sourceUrl = URL.createObjectURL(file);
        pdfWorker = createInlinePdfWorker();
        loadingTask = pdfjs.getDocument({ url: sourceUrl, worker: pdfWorker });
        const pdf = await loadingTask.promise;
        loadedPdf = pdf;
        if (cancelled) {
          await destroyPdfResources({
            loadingTask,
            pdfDocument: pdf,
            pdfWorker,
            sourceUrl,
          });
          sourceUrl = "";
          return;
        }

        setPdfDocument(pdf);
        setPageCount(pdf.numPages);
        const isLargeDocument = pdf.numPages > LARGE_PDF_PAGE_THRESHOLD;
        const pages =
          !isLargeDocument
            ? Array.from({ length: pdf.numPages }, (_, index) => index + 1)
            : [];
        setSelectedPages(pages);
        setShowThumbnails(!isLargeDocument);
        setPreviewEnabled(Boolean(pages.length));
        setOrderConfirmation(null);
        setRangeInput(formatPageSelection(pages));
        setThumbnailJumpInput("1");
      } catch (loadError) {
        if (cancelled || isPdfJsCancellation(loadError)) return;
        setError(loadError?.message || "Unable to preview this PDF.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    loadPdf();

    return () => {
      cancelled = true;
      setPdfDocument(null);
      void destroyPdfResources({
        loadingTask,
        pdfDocument: loadedPdf,
        pdfWorker,
        sourceUrl,
      });
    };
  }, [file, open]);

  const applyRange = () => {
    try {
      if (!pageCount) {
        setError("PDF page count is still loading. Please try again in a moment.");
        return;
      }
      const pages = parsePageRange(rangeInput, pageCount);
      if (!pages.length) {
        setError("Select at least one page.");
        return;
      }
      if (!isAscendingOrder(pages)) {
        setOrderConfirmation({
          enteredPages: pages,
          sortedPages: sortedPages(pages),
        });
        setError("");
        return;
      }
      setOrderConfirmation(null);
      setSelectedPages(pages);
      setRangeInput(formatPageSelection(pages));
      focusSelection(pages);
      setError("");
    } catch (rangeError) {
      setError(rangeError.message || "Invalid page selection.");
    }
  };

  const togglePage = (pageNumber) => {
    setSelectedPages((current) => {
      const exists = current.includes(pageNumber);
      const pages = exists
        ? current.filter((page) => page !== pageNumber)
        : [...current, pageNumber];
      setRangeInput(formatPageSelection(pages));
      focusSelection(pages);
      return pages;
    });
    setOrderConfirmation(null);
    setError("");
  };

  const selectAll = () => {
    const pages = Array.from({ length: pageCount }, (_, index) => index + 1);
    setSelectedPages(pages);
    setOrderConfirmation(null);
    setRangeInput(formatPageSelection(pages));
    focusSelection(pages);
    setError("");
  };

  const clearSelection = () => {
    setSelectedPages([]);
    setOrderConfirmation(null);
    setRangeInput("");
    focusSelection([]);
    setError("");
  };

  const acceptEnteredOrder = () => {
    if (!orderConfirmation) return;
    setSelectedPages(orderConfirmation.enteredPages);
    setRangeInput(formatPageSelection(orderConfirmation.enteredPages));
    setOrderConfirmation(null);
    focusSelection(orderConfirmation.enteredPages);
    setError("");
  };

  const sortEnteredOrder = () => {
    if (!orderConfirmation) return;
    setSelectedPages(orderConfirmation.sortedPages);
    setRangeInput(formatPageSelection(orderConfirmation.sortedPages));
    setOrderConfirmation(null);
    focusSelection(orderConfirmation.sortedPages);
    setError("");
  };

  const confirmSelection = async () => {
    if (!selectedPages.length) {
      setError("Select at least one page.");
      return;
    }

    try {
      setProcessing(true);
      setError("");
      const uploadFile = allPagesSelected
        ? file
        : await createSelectedPdfFile(file, selectedPages);
      await onConfirm(uploadFile, {
        allPagesSelected,
        pageCount,
        selectedPages,
      });
    } catch (processError) {
      setError(processError?.message || "Unable to create selected-pages PDF.");
    } finally {
      setProcessing(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !nextOpen && onCancel()}>
      <DialogContent className="flex h-[96vh] w-[98vw] max-w-[98vw] grid-rows-[auto_minmax(0,1fr)_auto] flex-col overflow-hidden bg-white p-0 sm:max-w-[98vw] xl:w-[96vw] xl:max-w-[118rem]">
        <DialogHeader className="shrink-0 border-b border-slate-200 px-5 py-4 text-left md:px-6">
          <DialogTitle className="flex items-center gap-2 text-base">
            <FileText className="h-5 w-5 text-blue-600" />
            Select PDF pages
          </DialogTitle>
          <DialogDescription>
            Choose the pages to keep before the file is uploaded.
          </DialogDescription>
        </DialogHeader>

        <div className="grid min-h-0 flex-1 grid-rows-[minmax(15rem,35vh)_minmax(0,1fr)] gap-0 lg:grid-cols-[20rem_minmax(0,1fr)] lg:grid-rows-1 xl:grid-cols-[22rem_minmax(0,1fr)]">
          <div className="min-h-0 border-b border-slate-200 bg-slate-50 lg:border-r lg:border-b-0">
            <div className="space-y-3 border-b border-slate-200 p-4 md:p-5">
              <div className="flex flex-col gap-2 sm:flex-row">
                <Input
                  value={rangeInput}
                  onChange={(event) => setRangeInput(event.target.value)}
                  placeholder="1, 3, 5-8"
                  disabled={loading || processing}
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={applyRange}
                  disabled={loading || processing}
                >
                  Apply
                </Button>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={selectAll}
                  disabled={loading || processing || !pageCount}
                >
                  All pages
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={clearSelection}
                  disabled={loading || processing}
                >
                  <RotateCcw className="h-4 w-4" />
                  Clear
                </Button>
              </div>
              <p className="text-xs text-slate-500">
                Selected {selectedPages.length || 0} of {pageCount || 0} pages
              </p>
              {isLargePdf && !selectedPages.length ? (
                <p className="rounded-md border border-blue-100 bg-blue-50 px-3 py-2 text-xs text-blue-800">
                  Large PDF loaded. Enter page ranges or select pages from the window below.
                </p>
              ) : null}
              {hasLargeSelection ? (
                <p className="rounded-md border border-emerald-100 bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
                  Large selection ready. Preview and thumbnails are virtualized, so ranges like 1-5000 will not render thousands of pages together.
                </p>
              ) : null}
              {orderConfirmation ? (
                <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
                  <p className="font-semibold">
                    Use entered order {formatPageSelectionSummary(orderConfirmation.enteredPages)}?
                  </p>
                  <p className="mt-1">
                    Normal order would be {formatPageSelectionSummary(orderConfirmation.sortedPages)}.
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button
                      type="button"
                      size="sm"
                      className="bg-amber-600 text-white hover:bg-amber-700"
                      onClick={acceptEnteredOrder}
                    >
                      Keep entered order
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={sortEnteredOrder}
                    >
                      Sort ascending
                    </Button>
                  </div>
                </div>
              ) : null}
              {error ? <p className="text-xs font-medium text-rose-600">{error}</p> : null}
            </div>

            <div className="h-[calc(35vh-9.5rem)] min-h-36 overflow-hidden p-4 md:p-5 lg:h-[calc(96vh-14.5rem)]">
              {loading ? (
                <div className="flex min-h-48 items-center justify-center text-sm text-slate-500">
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Loading PDF...
                </div>
              ) : (
                <div className="flex h-full min-h-0 flex-col gap-3">
                  <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-slate-200 bg-white p-2">
                    <span className="text-xs font-medium text-slate-600">
                      Showing pages {thumbnailWindowLabel} of {pageCount || 0}
                    </span>
                    <div className="flex flex-wrap items-center gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setShowThumbnails((current) => !current)}
                      >
                        {showThumbnails ? "Numbers only" : "Show thumbnails"}
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => scrollToThumbnailIndex(thumbnailStartIndex - thumbnailCursorSize)}
                        disabled={thumbnailStartIndex <= 0}
                      >
                        Previous
                      </Button>
                      <Input
                        type="number"
                        min="1"
                        max={pageCount || 1}
                        value={thumbnailJumpInput}
                        onChange={(event) => setThumbnailJumpInput(event.target.value)}
                        className="h-8 w-24"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={applyThumbnailJump}
                      >
                        Go
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => scrollToThumbnailIndex(thumbnailStartIndex + thumbnailCursorSize)}
                        disabled={thumbnailEndIndex >= pageCount}
                      >
                        Next
                      </Button>
                    </div>
                  </div>
                  <div
                    ref={thumbnailViewportRef}
                    className="min-h-0 flex-1 overflow-y-auto pr-1"
                    onScroll={handleThumbnailScroll}
                  >
                    <div
                      className="relative"
                      style={{ height: `${thumbnailTotalHeight}px` }}
                    >
                      {virtualThumbnailItems.map((item) => {
                        const pageNumber = item.index + 1;
                        const selected = selectedSet.has(pageNumber);
                        return (
                          <div
                            key={pageNumber}
                            className="absolute px-1.5 pb-3"
                            style={{
                              height: showThumbnails ? `${THUMBNAIL_ROW_HEIGHT}px` : "118px",
                              left: item.left,
                              top: `${item.top}px`,
                              width: item.width,
                            }}
                          >
                            <button
                              type="button"
                              onClick={() => togglePage(pageNumber)}
                              className={`relative h-full w-full overflow-hidden rounded-md border bg-white text-left shadow-sm transition ${
                                selected
                                  ? "border-blue-600 ring-2 ring-blue-100"
                                  : "border-slate-200 hover:border-slate-400"
                              }`}
                            >
                              {showThumbnails ? (
                                <PdfPageImage
                                  cacheKey={`${pdfCacheKey}:thumb:${pageNumber}`}
                                  pdf={pdfDocument}
                                pageNumber={pageNumber}
                                scale={0.22}
                                rootMargin="160px 0px"
                                renderDelayMs={60}
                                placeholderClassName="h-28 w-full bg-white lg:h-32"
                                className="h-28 w-full bg-white object-contain lg:h-32"
                              />
                              ) : (
                                <div className="flex h-20 w-full items-center justify-center bg-white text-2xl font-semibold text-slate-700">
                                  {pageNumber}
                                </div>
                              )}
                              <span className="flex items-center justify-between border-t border-slate-100 px-2 py-1 text-xs font-medium text-slate-700">
                                Page {pageNumber}
                                {selected ? <Check className="h-3.5 w-3.5 text-blue-600" /> : null}
                              </span>
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="flex min-h-0 flex-col gap-3 bg-white p-3 md:p-5">
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
              <span className="text-xs font-medium text-slate-600">
                Previewing selected {previewWindowLabel} of {selectedPages.length || 0}
              </span>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => scrollToPreviewIndex(previewStartIndex - previewCursorSize)}
                  disabled={previewStartIndex <= 0}
                >
                  Previous
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => scrollToPreviewIndex(previewStartIndex + previewCursorSize)}
                  disabled={previewEndIndex >= selectedPages.length}
                >
                  Next
                </Button>
              </div>
            </div>
            <div
              ref={previewViewportRef}
              className="min-h-[18rem] flex-1 overflow-auto rounded-md border border-slate-200 bg-slate-100 p-4"
              onScroll={handlePreviewScroll}
            >
              {selectedPages.length && previewEnabled ? (
                <div
                  className="relative mx-auto max-w-[78rem]"
                  style={{ height: `${previewTotalHeight}px` }}
                >
                  {virtualPreviewItems.map((item) => {
                    const pageNumber = selectedPages[item.index];
                    return (
                      <div
                        key={`${pageNumber}-${item.index}`}
                        className="absolute inset-x-0 px-1 pb-5"
                        style={{
                          height: `${PREVIEW_ROW_HEIGHT}px`,
                          top: `${item.top}px`,
                        }}
                      >
                        <div className="space-y-2">
                          <div className="sticky top-0 z-10 inline-flex rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-600 shadow-sm">
                            Page {pageNumber}
                          </div>
                          <PdfPageCanvas
                            pdf={pdfDocument}
                            pageNumber={pageNumber}
                            pixelRatio={getPreviewPixelRatio()}
                            renderDelayMs={30}
                            placeholderClassName="relative mx-auto flex min-h-[72rem] w-full items-center justify-center bg-white shadow"
                            className="relative z-0 mx-auto block rounded-sm bg-white shadow"
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : selectedPages.length ? (
                <div className="mx-auto max-w-3xl rounded-md bg-white p-4 shadow-sm">
                  <p className="text-sm font-semibold text-slate-700">
                    {selectedPages.length} pages selected
                  </p>
                  <p className="mt-2 break-words text-sm leading-6 text-slate-600">
                    {selectionSummary}
                  </p>
                </div>
              ) : loading ? (
                <div className="flex h-full min-h-[18rem] items-center justify-center text-sm text-slate-500">
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Loading PDF...
                </div>
              ) : (
                <div className="flex h-full min-h-[18rem] items-center justify-center text-sm text-slate-500">
                  Select pages to preview
                </div>
              )}
            </div>
          </div>
        </div>

        <DialogFooter className="shrink-0 border-t border-slate-200 px-5 py-4 md:px-6">
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
            disabled={processing}
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={confirmSelection}
            disabled={loading || processing || !selectedPages.length}
            className="bg-blue-700 text-white hover:bg-blue-800"
          >
            {processing ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

let pdfjsPromise = null;

const loadPdfJs = async () => {
  if (!pdfjsPromise) {
    pdfjsPromise = Promise.all([
      import("pdfjs-dist"),
      import("pdfjs-dist/build/pdf.worker.min.mjs?worker&inline"),
    ]).then(([pdfjs, workerModule]) => {
      const PdfWorker = workerModule.default;
      return { pdfjs, PdfWorker };
    });
  }

  return pdfjsPromise;
};

export const extractTextFromPdfFile = async (file, { maxPages = 30 } = {}) => {
  if (!file) return "";

  const { pdfjs, PdfWorker } = await loadPdfJs();
  let sourceUrl = "";
  let loadingTask = null;
  let pdf = null;
  let pdfWorker = null;

  try {
    sourceUrl = URL.createObjectURL(file);
    pdfWorker = new pdfjs.PDFWorker({ port: new PdfWorker() });
    loadingTask = pdfjs.getDocument({ url: sourceUrl, worker: pdfWorker });
    pdf = await loadingTask.promise;
    const pageLimit = Math.min(pdf.numPages || 0, maxPages);
    const pages = [];

    for (let pageNumber = 1; pageNumber <= pageLimit; pageNumber += 1) {
      const page = await pdf.getPage(pageNumber);
      const content = await page.getTextContent();
      const text = (content.items || [])
        .map((item) => String(item?.str || "").trim())
        .filter(Boolean)
        .join(" ");
      if (text) pages.push(text);
    }

    return pages.join("\n");
  } finally {
    try {
      if (pdf?.destroy) {
        await pdf.destroy();
      } else {
        await loadingTask?.destroy?.();
      }
    } finally {
      pdfWorker?.destroy?.();
      if (sourceUrl) URL.revokeObjectURL(sourceUrl);
    }
  }
};

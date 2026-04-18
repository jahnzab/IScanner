import { useEffect, useMemo, useRef, useState } from "react";
import { Route, Routes, useNavigate } from "react-router-dom";
import { jsPDF } from "jspdf";
import { AccessGuard } from "./components/AccessGuard";
import { AdminPanel } from "./components/AdminPanel";
import { AnnotationCanvas } from "./components/AnnotationCanvas";
import { CropTool } from "./components/CropTool";
import { EdgeDetector } from "./components/EdgeDetector";
import { FilterPanel } from "./components/FilterPanel";
import { ImageUpload } from "./components/ImageUpload";
import { OCRPanel } from "./components/OCRPanel";
import { PDFExport } from "./components/PDFExport";
import { PaymentModal } from "./components/PaymentModal";
import { PaywallModal } from "./components/PaywallModal";
import { PlanBadge } from "./components/PlanBadge";
import { RecoverAccess } from "./components/RecoverAccess";
import { SignatureTool } from "./components/SignatureTool";
import { TextTool } from "./components/TextTool";
import { api } from "./lib/api";
import { clearStoredToken, decodeJwtPayload, getStoredToken, isTokenExpired, setStoredToken } from "./lib/auth";
import { getDeviceFingerprint } from "./lib/fingerprint";
import { buildCanvasFromImage, detectDocumentCorners, FILTERS } from "./lib/image";
import { STORAGE_KEYS } from "./lib/storage";

const DEFAULT_CORNERS = [
  { x: 0.06, y: 0.04 },
  { x: 0.94, y: 0.04 },
  { x: 0.94, y: 0.96 },
  { x: 0.06, y: 0.96 }
];

const CONVERSION_MODES = [
  { id: "imageToPdf", label: "Images to PDF" },
  { id: "pdfToPdf", label: "Combine PDFs" },
  { id: "pdfToImage", label: "PDF to Images" }
];

const TOOL_HIGHLIGHTS = [
  {
    title: "Original first",
    text: "Uploads stay uncropped until you choose to scan or crop them."
  },
  {
    title: "A4 export",
    text: "PDF output uses A4 pages with breathing room around each result."
  },
  {
    title: "Selected page tools",
    text: "Text and signature changes apply only to the page you are editing."
  },
  {
    title: "Manual approval",
    text: "Payment stays pending until the admin approves the UTR."
  }
];

function createPageEntry(src) {
  return {
    id: crypto.randomUUID(),
    src,
    corners: null
  };
}

function formatAccessExpiry(value) {
  return new Date(value).toLocaleString([], {
    dateStyle: "medium",
    timeStyle: "short"
  });
}

function formatPlanName(planId) {
  return String(planId || "")
    .replace(/([A-Z])/g, " $1")
    .replace(/^./, (value) => value.toUpperCase())
    .trim();
}

function ScannerPage() {
  const [deviceId, setDeviceId] = useState("");
  const [config, setConfig] = useState({ upiId: "", upiName: "" });
  const [freeUsed, setFreeUsed] = useState(localStorage.getItem(STORAGE_KEYS.freeUsed) === "true");
  const [access, setAccess] = useState(null);
  const [pages, setPages] = useState([]);
  const [corners, setCorners] = useState(null);
  const [annotations, setAnnotations] = useState([]);
  const [ocrText, setOcrText] = useState("");
  const [ocrLoading, setOcrLoading] = useState(false);
  const [edgeLoading, setEdgeLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [filter, setFilter] = useState(FILTERS[0]);
  const [paywallOpen, setPaywallOpen] = useState(false);
  const [paywallReason, setPaywallReason] = useState("");
  const [paymentPlan, setPaymentPlan] = useState(null);
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [paymentLoading, setPaymentLoading] = useState(false);
  const [paymentStatus, setPaymentStatus] = useState("");
  const [uploading, setUploading] = useState(false);
  const [selectedPageIndex, setSelectedPageIndex] = useState(0);
  const [scannedPreview, setScannedPreview] = useState("");
  const [renderingPreview, setRenderingPreview] = useState(false);
  const [accessReady, setAccessReady] = useState(false);
  const [exportTarget, setExportTarget] = useState("current");
  const [exportLayout, setExportLayout] = useState("vertical");
  const [conversionMode, setConversionMode] = useState("imageToPdf");
  const imageRef = useRef(null);
  const navigate = useNavigate();
  const preview = pages[selectedPageIndex]?.src || "";
  const selectPage = (index) => {
    const page = pages[index];
    if (!page) {
      return;
    }

    setSelectedPageIndex(index);
    setCorners(page.corners || null);
    setAnnotations([]);
    setOcrText("");
  };

  const features = access?.features || {
    unlimitedScans: false,
    ocr: false,
    multiPagePdf: true,
    cleanExport: false
  };

  const canUseFree = !freeUsed && !access;

  useEffect(() => {
    api.getPublicConfig().then(setConfig).catch(() => {});
  }, []);

  useEffect(() => {
    (async () => {
      const fingerprint = await getDeviceFingerprint();
      setDeviceId(fingerprint);

      try {
        const usage = await api.checkFreeUsage(fingerprint);
        if (usage.used) {
          localStorage.setItem(STORAGE_KEYS.freeUsed, "true");
          setFreeUsed(true);
        }
      } catch (error) {
        setMessage(error.message);
      }

      const token = getStoredToken();
      if (!token) {
        setAccessReady(true);
        return;
      }

      const payload = decodeJwtPayload(token);
      if (!payload || isTokenExpired(payload)) {
        clearStoredToken();
        setAccessReady(true);
        return;
      }

      try {
        const response = await api.validateAccess(token);
        setAccess(response.payload);
      } catch {
        clearStoredToken();
      } finally {
        setAccessReady(true);
      }
    })();
  }, []);

  useEffect(() => {
    if (!accessReady || !freeUsed || access) {
      return;
    }

    setPaywallReason("Unlock a paid version for watermark removal, OCR, and extra scanner features.");
    setPaywallOpen(true);
  }, [freeUsed, access, accessReady]);

  useEffect(() => {
    if (access) {
      setPaywallOpen(false);
    }
  }, [access]);

  const exportLabel = useMemo(() => {
    if (pages.length > 1 && exportTarget === "combined") {
      return "Download PDF";
    }
    return "Export as PDF";
  }, [pages.length, exportTarget]);

  const updateCurrentPageCorners = (nextCorners) => {
    setCorners(nextCorners);
    setPages((current) =>
      current.map((page, index) => (index === selectedPageIndex ? { ...page, corners: nextCorners } : page))
    );
  };

  const addAnnotationText = (value) => {
    setAnnotations((current) => [
      ...current,
      {
        id: crypto.randomUUID(),
        type: "text",
        value,
        x: 0.5,
        y: 0.5,
        color: "#ffffff",
        fontSize: 28,
        fontFamily: "Sora"
      }
    ]);
  };

  const addSignature = (image) => {
    setAnnotations((current) => [
      ...current,
      {
        id: crypto.randomUUID(),
        type: "signature",
        image,
        x: 0.62,
        y: 0.75,
        width: 0.24,
        height: 0.1
      }
    ]);
  };

  const addTimestamp = () => {
    addAnnotationText(new Date().toLocaleString());
  };

  const readImageFile = (file) =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(new Error(`Failed to read ${file.name}`));
      reader.readAsDataURL(file);
    });

  const readPdfFile = async (file) => {
    const { getDocument, GlobalWorkerOptions } = await import("pdfjs-dist/build/pdf");
    GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/build/pdf.worker.mjs", import.meta.url).toString();
    const bytes = new Uint8Array(await file.arrayBuffer());
    const pdf = await getDocument({ data: bytes }).promise;
    const renderedPages = [];

    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
      const page = await pdf.getPage(pageNumber);
      const viewport = page.getViewport({ scale: 1.6 });
      const canvas = document.createElement("canvas");
      const context = canvas.getContext("2d");
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      await page.render({ canvasContext: context, viewport }).promise;
      renderedPages.push(canvas.toDataURL("image/png"));
    }

    return renderedPages;
  };

  const pushPages = (newPages) => {
    if (!newPages.length) {
      return;
    }

    setPages((current) => {
      const nextPages = [...current, ...newPages.map(createPageEntry)];
      const nextIndex = Math.max(0, nextPages.length - newPages.length);

      setSelectedPageIndex(nextIndex);
      setCorners(null);
      return nextPages;
    });

    setCorners(null);
    setAnnotations([]);
    setOcrText("");
    setMessage("");
  };

  const handleSelectFiles = async (files) => {
    setUploading(true);
    setMessage("");
    try {
      const incomingFiles = Array.from(files || []);
      const invalidFile = incomingFiles.find((file) => {
        const isPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
        if (conversionMode === "imageToPdf") {
          return isPdf;
        }
        return !isPdf;
      });

      if (invalidFile) {
        setMessage(
          conversionMode === "imageToPdf"
            ? "Image To PDF mode only accepts image files."
            : "This mode only accepts PDF files."
        );
        return;
      }

      const nextPages = [];

      for (const file of incomingFiles) {
        if (file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")) {
          const pdfPages = await readPdfFile(file);
          nextPages.push(...pdfPages);
        } else {
          const imageData = await readImageFile(file);
          nextPages.push(imageData);
        }
      }

      pushPages(nextPages);
    } catch (error) {
      setMessage(error.message);
    } finally {
      setUploading(false);
    }
  };

  const handleDetectEdges = async () => {
    if (!imageRef.current) {
      return;
    }

    setEdgeLoading(true);
    const detected = await detectDocumentCorners(imageRef.current);
    updateCurrentPageCorners(detected);
    setEdgeLoading(false);
  };

  const requirePaid = (reason) => {
    setPaywallReason(reason);
    setPaywallOpen(true);
  };

  const canUseEditingTools = Boolean(access?.features?.cleanExport);

  const handleRunOcr = async () => {
    if (!preview) {
      return;
    }

    setOcrLoading(true);
    try {
      const Tesseract = (await import("tesseract.js")).default;
      const result = await Tesseract.recognize(preview, "eng");
      setOcrText(result.data.text);
    } catch (error) {
      setMessage(error.message);
    } finally {
      setOcrLoading(false);
    }
  };

  const markFreeScanUsed = async () => {
    if (!canUseFree || !deviceId) {
      return;
    }

    await api.claimFreeUsage(deviceId);
    localStorage.setItem(STORAGE_KEYS.freeUsed, "true");
    setFreeUsed(true);
  };

  const renderPageCanvas = async (page) => {
    const image = new Image();
    image.src = page.src;
    await new Promise((resolve, reject) => {
      image.onload = resolve;
      image.onerror = reject;
    });

    const pageCorners =
      page.id === pages[selectedPageIndex]?.id
        ? corners
        : page.corners || null;

    return buildCanvasFromImage({
      image,
      corners: pageCorners,
      filterStyle: filter.style,
      watermark: !features.cleanExport,
      annotations: page.id === pages[selectedPageIndex]?.id ? annotations : []
    });
  };

  const refreshScannedPreview = async () => {
    if (!preview) {
      setScannedPreview("");
      return;
    }

    setRenderingPreview(true);
    try {
      const canvas = await renderPageCanvas(pages[selectedPageIndex]);
      setScannedPreview(canvas.toDataURL("image/png"));
    } catch (error) {
      setMessage(error.message);
    } finally {
      setRenderingPreview(false);
    }
  };

  useEffect(() => {
    refreshScannedPreview();
  }, [preview, corners, filter, annotations, access]);

  const downloadImage = async () => {
    if (!preview) {
      return;
    }

    try {
      const sourcePages =
        exportTarget === "combined" && pages.length > 1
          ? pages
          : [pages[selectedPageIndex]];
      const canvases = await Promise.all(sourcePages.map((page) => renderPageCanvas(page)));
      const outputCanvas =
        canvases.length === 1
          ? canvases[0]
          : (() => {
              const gap = 8;
              const combined = document.createElement("canvas");
              const ctx = combined.getContext("2d");

              if (exportLayout === "horizontal") {
                combined.width = canvases.reduce((total, canvas) => total + canvas.width, 0) + gap * (canvases.length - 1);
                combined.height = Math.max(...canvases.map((canvas) => canvas.height));
                let currentX = 0;
                canvases.forEach((canvas) => {
                  const y = (combined.height - canvas.height) / 2;
                  ctx.drawImage(canvas, currentX, y);
                  currentX += canvas.width + gap;
                });
              } else {
                combined.width = Math.max(...canvases.map((canvas) => canvas.width));
                combined.height = canvases.reduce((total, canvas) => total + canvas.height, 0) + gap * (canvases.length - 1);
                let currentY = 0;
                canvases.forEach((canvas) => {
                  const x = (combined.width - canvas.width) / 2;
                  ctx.drawImage(canvas, x, currentY);
                  currentY += canvas.height + gap;
                });
              }

              return combined;
            })();
      const dataUrl =
        sourcePages.length === 1 && exportTarget === "current" && scannedPreview
          ? scannedPreview
          : outputCanvas.toDataURL("image/png");
      const link = document.createElement("a");
      link.href = dataUrl;
      link.download =
        sourcePages.length > 1 ? `iscanner-combined-${exportLayout}.png` : "iscanner-scanned-image.png";
      link.click();
      await markFreeScanUsed();
    } catch (error) {
      setMessage(error.message);
    }
  };

  const handleExport = async () => {
    if (!preview) {
      return;
    }

    const doc = new jsPDF({
      orientation: "portrait",
      unit: "px",
      format: "a4"
    });

    const sourcePages =
      exportTarget === "combined" && pages.length > 1
        ? pages
        : [pages[selectedPageIndex]];
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 32;
    const gap = 12;
    const canvases = await Promise.all(sourcePages.map((page) => renderPageCanvas(page)));

    if (canvases.length === 1) {
      const canvas = canvases[0];
      const scale = Math.min((pageWidth - margin * 2) / canvas.width, (pageHeight - margin * 2) / canvas.height);
      const renderWidth = canvas.width * scale;
      const renderHeight = canvas.height * scale;
      const offsetX = (pageWidth - renderWidth) / 2;
      const offsetY = (pageHeight - renderHeight) / 2;
      doc.addImage(canvas.toDataURL("image/png"), "PNG", offsetX, offsetY, renderWidth, renderHeight, undefined, "FAST");
    } else if (exportLayout === "horizontal") {
      const columns = 2;
      const cellWidth = (pageWidth - margin * 2 - gap) / columns;
      let rowY = margin;
      let rowHeight = 0;

      for (let index = 0; index < canvases.length; index += 1) {
        const canvas = canvases[index];
        const columnIndex = index % columns;
        if (index > 0 && columnIndex === 0) {
          rowY += rowHeight + gap;
          rowHeight = 0;
        }

        const scale = Math.min(cellWidth / canvas.width, (pageHeight - margin - rowY) / canvas.height);
        const renderWidth = canvas.width * scale;
        const renderHeight = canvas.height * scale;

        if (rowY + renderHeight > pageHeight - margin) {
          doc.addPage();
          rowY = margin;
          rowHeight = 0;
        }

        const x = margin + columnIndex * (cellWidth + gap) + (cellWidth - renderWidth) / 2;
        doc.addImage(canvas.toDataURL("image/png"), "PNG", x, rowY, renderWidth, renderHeight, undefined, "FAST");
        rowHeight = Math.max(rowHeight, renderHeight);
      }
    } else {
      let currentY = margin;

      for (let index = 0; index < canvases.length; index += 1) {
        const canvas = canvases[index];
        const scale = Math.min((pageWidth - margin * 2) / canvas.width, (pageHeight - margin * 2) / canvas.height);
        const renderWidth = canvas.width * scale;
        const renderHeight = canvas.height * scale;

        if (index > 0 && currentY + renderHeight > pageHeight - margin) {
          doc.addPage();
          currentY = margin;
        }

        const x = (pageWidth - renderWidth) / 2;
        doc.addImage(canvas.toDataURL("image/png"), "PNG", x, currentY, renderWidth, renderHeight, undefined, "FAST");
        currentY += renderHeight + gap;
      }
    }

    doc.save(
      sourcePages.length > 1
        ? `iscanner-document-${exportLayout}.pdf`
        : "iscanner-document.pdf"
    );

    try {
      await markFreeScanUsed();
    } catch (error) {
      setMessage(error.message);
    }
  };

  const handleChoosePlan = (plan) => {
    setPaymentPlan(plan);
    setPaymentStatus("");
    setPaymentOpen(true);
  };

  const handlePaymentSubmit = async ({ email, utr }) => {
    if (!email || !utr || !paymentPlan) {
      setPaymentStatus("Email and UTR are required.");
      return;
    }

    setPaymentLoading(true);
    setPaymentStatus("");
    try {
      const response = await api.initiatePayment({
        email,
        utr,
        plan: paymentPlan.id
      });
      setPaymentStatus(response.message || "Payment saved. Waiting for admin approval.");
      setPaymentOpen(false);
      setPaywallOpen(false);
      setMessage(response.message || "Payment saved. Admin approval is required before access is unlocked.");
    } catch (error) {
      setPaymentStatus(error.message);
      setMessage(error.message);
    } finally {
      setPaymentLoading(false);
    }
  };

  const movePage = (fromIndex, direction) => {
    const toIndex = fromIndex + direction;
    if (toIndex < 0 || toIndex >= pages.length) {
      return;
    }

    let nextCorners = null;
    setPages((current) => {
      const nextPages = [...current];
      const [page] = nextPages.splice(fromIndex, 1);
      nextCorners = page?.corners || null;
      nextPages.splice(toIndex, 0, page);
      return nextPages;
    });

    setSelectedPageIndex(toIndex);
    setCorners(nextCorners);
    setAnnotations([]);
    setOcrText("");
  };

  const movePageToPosition = (fromIndex, toIndex) => {
    if (fromIndex === toIndex || toIndex < 0 || toIndex >= pages.length) {
      return;
    }

    let nextCorners = null;
    setPages((current) => {
      const nextPages = [...current];
      const [page] = nextPages.splice(fromIndex, 1);
      nextCorners = page?.corners || null;
      nextPages.splice(toIndex, 0, page);
      return nextPages;
    });

    setSelectedPageIndex(toIndex);
    setCorners(nextCorners);
    setAnnotations([]);
    setOcrText("");
  };

  const removePage = (indexToRemove) => {
    setPages((current) => {
      const nextPages = current.filter((_, index) => index !== indexToRemove);
      const nextIndex = nextPages.length ? Math.max(0, Math.min(selectedPageIndex, nextPages.length - 1)) : 0;
      setSelectedPageIndex(nextIndex);
      setCorners(nextPages[nextIndex]?.corners || null);
      return nextPages;
    });
    setAnnotations([]);
    setOcrText("");
  };

  return (
    <div className="min-h-screen px-4 py-8 text-white sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <header className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="text-xs uppercase tracking-[0.35em] text-accent">Document Scanner</div>
            <h1 className="mt-3 max-w-3xl font-display text-5xl text-white sm:text-6xl">
              Everything you need to turn documents into clean, shareable files.
            </h1>
            <p className="mt-4 max-w-3xl text-sm leading-7 text-slate-300 sm:text-base">
              Mobile-friendly document workspace for image uploads, PDF conversion, manual crop control, signatures, OCR, and A4 PDF export.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              {CONVERSION_MODES.map((mode) => (
                <button
                  key={mode.id}
                  type="button"
                  onClick={() => {
                    setConversionMode(mode.id);
                    setMessage("");
                  }}
                  className={`rounded-full border border-white/15 px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-white ${
                    conversionMode === mode.id ? "bg-accent/20" : "bg-white/10"
                  }`}
                >
                  {mode.label}
                </button>
              ))}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <PlanBadge access={access} />
            {!access ? (
              <button
                type="button"
                onClick={() => {
                  setPaywallReason("Unlock subscription for text, signature, combine files, and clean export.");
                  setPaywallOpen(true);
                }}
                className="rounded-full border border-white/15 bg-white/10 px-4 py-2 text-sm font-semibold text-white"
              >
                Unlock Subscription
              </button>
            ) : null}
            <button
              type="button"
              onClick={() => navigate("/recover")}
              className="rounded-full border border-white/15 bg-white/10 px-4 py-2 text-sm font-semibold text-white"
            >
              Check Paid Status
            </button>
            <button
              type="button"
              onClick={() => navigate("/admin")}
              className="rounded-full border border-white/15 bg-white/10 px-4 py-2 text-sm font-semibold text-white"
            >
              Admin
            </button>
          </div>
        </header>

        <section className="mb-6 rounded-[2rem] border border-white/10 bg-gradient-to-br from-white/8 via-white/5 to-transparent p-5 shadow-glow">
          <div className="grid gap-5 lg:grid-cols-[1.15fr,0.85fr] lg:items-start">
            <div>
              <div className="text-xs uppercase tracking-[0.3em] text-accent">Tool hub</div>
              <h2 className="mt-2 text-3xl font-semibold text-white">Start with the right workflow</h2>
              <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-300">
                Pick a conversion mode, upload the right file type, and keep control over crop, signature, and page layout.
                Nothing is auto-cropped unless you choose it.
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                {CONVERSION_MODES.map((mode) => (
                  <span
                    key={mode.id}
                    className="rounded-full border border-white/10 bg-black/20 px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-200"
                  >
                    {mode.label}
                  </span>
                ))}
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {TOOL_HIGHLIGHTS.map((item) => (
                <div key={item.title} className="rounded-2xl border border-white/10 bg-black/20 p-4">
                  <div className="text-sm font-semibold text-white">{item.title}</div>
                  <div className="mt-2 text-xs leading-6 text-slate-300">{item.text}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {message ? (
          <div className="mb-6 rounded-2xl border border-amber-400/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
            {message}
          </div>
        ) : null}

        <section className="mb-6 rounded-[2rem] border border-white/10 bg-white/5 p-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="text-xs uppercase tracking-[0.3em] text-accent">Quick Actions</div>
              <h2 className="mt-2 text-2xl font-semibold text-white">Edit and download from one place</h2>
              <p className="mt-2 text-sm text-slate-300">
                Upload an image or PDF, then choose whether to keep it original, crop it manually, add text, place a signature, or stamp current time.
              </p>
              {!features.cleanExport ? (
                <p className="mt-2 text-xs text-amber-200">
                  Unlock the paid version for text editing, signature placement, combining files, and clean export without watermark.
                </p>
              ) : null}
              {access ? (
                <div className="mt-3 inline-flex items-center rounded-full border border-emerald-300/30 bg-emerald-400/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-emerald-200">
                  Unlocked Paid Version
                </div>
              ) : null}
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
              <button
                type="button"
                onClick={() => {
                  if (!canUseEditingTools) {
                    requirePaid("Unlock paid subscription to add and edit text inside the image or PDF.");
                    return;
                  }

                  document.getElementById("text-tool-panel")?.scrollIntoView({ behavior: "smooth", block: "start" });
                }}
                className="rounded-2xl bg-white/10 px-4 py-3 text-sm font-semibold text-white"
              >
                Add Text
              </button>
              <button type="button" onClick={addTimestamp} className="rounded-2xl bg-white/10 px-4 py-3 text-sm font-semibold text-white">
                Add Current Time
              </button>
              <button type="button" onClick={handleDetectEdges} disabled={!preview || edgeLoading} className="rounded-2xl bg-white/10 px-4 py-3 text-sm font-semibold text-white disabled:opacity-60">
                {edgeLoading ? "Scanning..." : "Auto Crop"}
              </button>
              <button
                type="button"
                onClick={() => {
                  if (!canUseEditingTools) {
                    requirePaid("Unlock paid subscription to add and edit signatures inside the image or PDF.");
                    return;
                  }

                  document.getElementById("signature-panel")?.scrollIntoView({ behavior: "smooth", block: "start" });
                }}
                className="rounded-2xl bg-white/10 px-4 py-3 text-sm font-semibold text-white"
              >
                Add Signature
              </button>
              <div className="sm:col-span-2 lg:col-span-1">
                <PDFExport onExport={handleExport} disabled={!preview} label={exportLabel} />
              </div>
            </div>
          </div>
        </section>

        <div className="grid gap-6 xl:grid-cols-[1.2fr,0.8fr]">
          <div className="space-y-6">
            <ImageUpload
              onSelectFiles={handleSelectFiles}
              loading={uploading}
              hasPages={pages.length > 0}
              mode={conversionMode}
            />
            {preview ? (
              <div className="rounded-[2rem] border border-white/10 bg-white/5 p-4">
                <img
                  ref={imageRef}
                  src={preview}
                  alt="Hidden detection source"
                  className="hidden"
                  crossOrigin="anonymous"
                />
                <div className="mb-4 rounded-3xl border border-emerald-300/20 bg-emerald-500/10 p-4">
                  <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-semibold text-white">Ready to export</div>
                      <div className="text-xs text-emerald-100/80">
                        Keep the original image, or crop only the pages you want. Signature and text tools stay on the selected page.
                      </div>

                      {pages.length > 1 ? (
                        <div className="mt-4">
                          <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-300">
                            Scan page
                          </div>
                          <div className="flex flex-wrap gap-3">
                            {pages.map((page, index) => (
                              <button
                                key={page.id}
                                type="button"
                                onClick={() => selectPage(index)}
                                className={`min-w-[10rem] rounded-2xl border px-4 py-3 text-left transition ${
                                  selectedPageIndex === index
                                    ? "border-accent bg-accent/20 text-white"
                                    : "border-white/10 bg-black/20 text-slate-200 hover:bg-white/10"
                                }`}
                              >
                                <div className="text-xs uppercase tracking-[0.18em] text-slate-300">
                                  Scan {index + 1}
                                </div>
                                <div className="mt-1 text-sm font-semibold">Page {index + 1}</div>
                              </button>
                            ))}
                          </div>
                        </div>
                      ) : null}

                      <div className="mt-4 grid gap-3 sm:grid-cols-2">
                        {pages.length > 1 ? (
                          <div className="rounded-2xl border border-white/10 bg-black/20 p-3">
                            <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-300">
                              Export
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                              <button
                                type="button"
                                onClick={() => setExportTarget("current")}
                                className={`min-h-[3rem] rounded-2xl px-4 py-3 text-sm font-semibold ${
                                  exportTarget === "current" ? "bg-accent text-white" : "bg-white/10 text-slate-200"
                                }`}
                              >
                                Current
                              </button>
                              <button
                                type="button"
                                onClick={() => setExportTarget("combined")}
                                className={`min-h-[3rem] rounded-2xl px-4 py-3 text-sm font-semibold ${
                                  exportTarget === "combined" ? "bg-accent text-white" : "bg-white/10 text-slate-200"
                                }`}
                              >
                                Combined
                              </button>
                            </div>
                          </div>
                        ) : null}
                        {pages.length > 1 ? (
                          <div className="rounded-2xl border border-white/10 bg-black/20 p-3">
                            <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-300">
                              Layout
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                              <button
                                type="button"
                                onClick={() => setExportLayout("vertical")}
                                className={`min-h-[3rem] rounded-2xl px-4 py-3 text-sm font-semibold ${
                                  exportLayout === "vertical" ? "bg-accent text-white" : "bg-white/10 text-slate-200"
                                }`}
                              >
                                Vertical
                              </button>
                              <button
                                type="button"
                                onClick={() => setExportLayout("horizontal")}
                                className={`min-h-[3rem] rounded-2xl px-4 py-3 text-sm font-semibold ${
                                  exportLayout === "horizontal" ? "bg-accent text-white" : "bg-white/10 text-slate-200"
                                }`}
                              >
                                Horizontal
                              </button>
                            </div>
                          </div>
                        ) : null}
                        <div className="grid gap-3 sm:col-span-2 sm:grid-cols-2">
                          <PDFExport onExport={handleExport} disabled={!preview} label={exportLabel} />
                          <button
                            type="button"
                            onClick={downloadImage}
                            disabled={!preview}
                            className="min-h-[3.75rem] w-full rounded-[1.5rem] border border-white/15 bg-white/10 px-6 py-4 text-base font-semibold text-white transition hover:bg-white/15 disabled:opacity-60"
                          >
                            Export Scanned Image
                          </button>
                        </div>
                      </div>
                    </div>

                    <div className="w-full xl:max-w-[20rem]">
                      <div className="rounded-3xl border border-white/10 bg-black/20 p-3">
                        <div className="mb-2 flex items-center justify-between gap-3">
                          <div>
                            <div className="text-sm font-semibold text-white">Live preview</div>
                            <div className="text-xs text-slate-300">
                              Tap a page above to scan or crop it.
                            </div>
                          </div>
                          <div className="text-xs text-slate-300">
                            {selectedPageIndex + 1}/{pages.length}
                          </div>
                        </div>
                        <img
                          src={scannedPreview || preview}
                          alt="Selected page preview"
                          className="max-h-[16rem] w-full rounded-[1.25rem] object-contain bg-black/30"
                        />
                      </div>
                    </div>
                  </div>
                </div>
                <CropTool
                  preview={preview}
                  corners={corners}
                  onChange={updateCurrentPageCorners}
                  onInitialize={() => {
                    setCorners(DEFAULT_CORNERS);
                    setPages((current) =>
                      current.map((page, index) => (index === selectedPageIndex ? { ...page, corners: DEFAULT_CORNERS } : page))
                    );
                  }}
                />
                <div className="mt-4 rounded-[1.5rem] border border-white/10 bg-black/20 p-4">
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <div>
                      <div className="text-sm font-semibold text-white">Scanned output preview</div>
                      <div className="text-xs text-slate-300">
                        This shows the final page that will be downloaded, with A4 padding on PDF export.
                      </div>
                    </div>
                    {renderingPreview ? <div className="text-xs text-slate-300">Refreshing preview...</div> : null}
                  </div>
                  {scannedPreview ? (
                    <img
                      src={scannedPreview}
                      alt="Scanned output preview"
                      className="max-h-[28rem] w-full rounded-[1.25rem] object-contain bg-black/30"
                    />
                  ) : (
                    <div className="rounded-[1.25rem] border border-dashed border-white/10 px-4 py-10 text-center text-sm text-slate-400">
                      Upload a file to see the scanned output preview.
                    </div>
                  )}
                </div>
                <div className="mt-4">
                  <AnnotationCanvas
                    preview={preview}
                    filterStyle={filter.style}
                    annotations={annotations}
                    setAnnotations={setAnnotations}
                  />
                </div>
              </div>
            ) : null}
          </div>

          <div className="space-y-4">
            <div className="rounded-3xl border border-white/10 bg-white/5 p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold text-white">Pages in current document</div>
                  <div className="text-xs text-slate-300">Switch pages here before editing or downloading.</div>
                </div>
                <div className="text-xs text-slate-300">{pages.length || (preview ? 1 : 0)} page(s)</div>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {pages.map((page, index) => (
                  <button
                    key={page.id}
                    type="button"
                    onClick={() => selectPage(index)}
                    className={`rounded-full px-4 py-2 text-sm font-semibold ${
                      selectedPageIndex === index ? "bg-accent text-white" : "bg-white/10 text-slate-200"
                    }`}
                  >
                    Page {index + 1}
                  </button>
                ))}
              </div>
            </div>
            <EdgeDetector corners={corners} onDetect={handleDetectEdges} loading={edgeLoading} />

            {pages.length > 0 ? (
              <div className="rounded-3xl border border-white/10 bg-white/5 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold text-white">Page order</div>
                    <div className="text-xs text-slate-300">Reorder pages here. The page numbers update automatically with the list.</div>
                  </div>
                  <div className="text-xs text-slate-300">{selectedPageIndex + 1} / {pages.length}</div>
                </div>
                <div className="mt-4 grid gap-3">
                  {pages.map((page, index) => (
                    <div
                      key={page.id}
                      className={`rounded-2xl border p-3 transition ${
                        selectedPageIndex === index ? "border-accent/50 bg-accent/10" : "border-white/10 bg-black/20"
                      }`}
                    >
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                        <button
                          type="button"
                          onClick={() => selectPage(index)}
                          className="flex items-center gap-3 text-left"
                        >
                          <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-white/10 bg-black/30">
                            <img
                              src={page.src}
                              alt={`Page ${index + 1} preview`}
                              className="h-full w-full object-cover"
                            />
                          </div>
                          <div>
                            <div className="text-xs uppercase tracking-[0.2em] text-slate-400">Position {index + 1}</div>
                            <div className="text-sm font-semibold text-white">
                              Page {index + 1}
                              {selectedPageIndex === index ? " (selected)" : ""}
                            </div>
                            <div className="text-xs text-slate-300">Tap to edit this page</div>
                          </div>
                        </button>
                        <div className="flex flex-wrap gap-2 sm:ml-auto">
                          <button
                            type="button"
                            disabled={index === 0}
                            onClick={() => movePageToPosition(index, index - 1)}
                            className="rounded-full border border-white/10 bg-white/10 px-3 py-2 text-xs font-semibold text-white disabled:opacity-40"
                          >
                            Move Up
                          </button>
                          <button
                            type="button"
                            disabled={index === pages.length - 1}
                            onClick={() => movePageToPosition(index, index + 1)}
                            className="rounded-full border border-white/10 bg-white/10 px-3 py-2 text-xs font-semibold text-white disabled:opacity-40"
                          >
                            Move Down
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            <FilterPanel activeFilter={filter} onChange={setFilter} />
            <AccessGuard
              allowed={canUseEditingTools}
              onLocked={() => requirePaid("Unlock paid subscription to add and edit text inside the image or PDF.")}
              note="Paid version unlocks text editing, signature placement, combine files, and clean export."
            >
              <div id="text-tool-panel">
                <TextTool onAdd={addAnnotationText} />
              </div>
            </AccessGuard>
            <AccessGuard
              allowed={canUseEditingTools}
              onLocked={() => requirePaid("Unlock paid subscription to add and edit signatures inside the image or PDF.")}
              note="Paid version unlocks text editing, signature placement, combine files, and clean export."
            >
              <div id="signature-panel">
                <SignatureTool onAdd={addSignature} />
              </div>
            </AccessGuard>

            <AccessGuard
              allowed={Boolean(access?.features?.ocr)}
              onLocked={() => requirePaid("OCR is available on paid versions.")}
              note="Paid version also includes text tools, signature tools, combine files, and clean export."
            >
              <OCRPanel
                text={ocrText}
                loading={ocrLoading}
                onRun={handleRunOcr}
                disabled={!preview}
              />
            </AccessGuard>
            {pages.length > 0 ? (
              <div className="rounded-3xl border border-white/10 bg-white/5 p-4">
                <div className="text-sm font-semibold text-white">Manage current page</div>
                <div className="mt-2 text-xs text-slate-300">
                  Current page: {selectedPageIndex + 1}. Move it by position or remove it here.
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <label className="text-sm text-slate-200">Move current page to</label>
                  <select
                    value={selectedPageIndex}
                    onChange={(event) => movePageToPosition(selectedPageIndex, Number(event.target.value))}
                    className="rounded-full border border-white/10 bg-black/20 px-4 py-2 text-sm text-white outline-none"
                  >
                    {pages.map((_, index) => (
                      <option key={index} value={index}>
                        Position {index + 1}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => removePage(selectedPageIndex)}
                    className="rounded-full bg-rose-500/10 px-4 py-2 text-sm font-semibold text-rose-100"
                  >
                    Remove Current Page
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </div>

      <PaywallModal
        open={paywallOpen}
        onClose={() => setPaywallOpen(false)}
        onChoosePlan={handleChoosePlan}
        reason={paywallReason}
      />
      <PaymentModal
        open={paymentOpen}
        plan={paymentPlan}
        config={config}
        onClose={() => setPaymentOpen(false)}
        onSubmit={handlePaymentSubmit}
        loading={paymentLoading}
        status={paymentStatus}
      />
    </div>
  );
}

function RecoverPage() {
  const [status, setStatus] = useState("");
  const navigate = useNavigate();

  const handleRecover = async (email) => {
    try {
      const response = await api.recoverAccess(email);
      setStoredToken(response.token);
      setStatus(`Paid subscription is active. Your ${formatPlanName(response.access.plan)} pass is available until ${formatAccessExpiry(response.access.expiry)}. Redirecting...`);
      setTimeout(() => navigate("/"), 900);
    } catch (error) {
      setStatus(error.message);
    }
  };

  return (
    <div className="min-h-screen px-4 py-8">
      <RecoverAccess onRecover={handleRecover} status={status} onBack={() => navigate("/")} />
    </div>
  );
}

function AdminPage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen px-4 py-8">
      <AdminPanel onBack={() => navigate("/")} />
    </div>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<ScannerPage />} />
      <Route path="/recover" element={<RecoverPage />} />
      <Route path="/admin" element={<AdminPage />} />
    </Routes>
  );
}

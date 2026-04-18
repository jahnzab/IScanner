import { useEffect, useMemo, useRef, useState } from "react";
import { Route, Routes, useLocation, useNavigate, useParams } from "react-router-dom";
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

const TOOL_CARDS = [
  {
    id: "editPdf",
    title: "Edit PDF",
    subtitle: "Add text, signatures, and page cleanup inside PDF files.",
    mode: "pdfToPdf",
    accent: "from-rose-500/45 to-orange-400/20",
    cta: "Open PDF editor"
  },
  {
    id: "editImage",
    title: "Edit Image",
    subtitle: "Mark up images with text, signatures, and crop control.",
    mode: "imageToPdf",
    accent: "from-amber-400/45 to-pink-500/20",
    cta: "Open image editor"
  },
  {
    id: "textPdf",
    title: "Add Text PDF",
    subtitle: "Place labels, notes, or timestamps on a PDF page.",
    mode: "pdfToPdf",
    accent: "from-violet-500/45 to-fuchsia-400/20",
    cta: "Text on PDF"
  },
  {
    id: "signaturePdf",
    title: "Add Signature PDF",
    subtitle: "Draw or upload a signature and place it on a PDF.",
    mode: "pdfToPdf",
    accent: "from-emerald-400/45 to-teal-400/20",
    cta: "Sign PDF"
  },
  {
    id: "textImage",
    title: "Add Text Image",
    subtitle: "Place text on an image before exporting or saving.",
    mode: "imageToPdf",
    accent: "from-fuchsia-500/45 to-rose-400/20",
    cta: "Text on image"
  },
  {
    id: "signatureImage",
    title: "Add Signature Image",
    subtitle: "Draw or upload a signature and place it on an image.",
    mode: "imageToPdf",
    accent: "from-cyan-400/45 to-sky-400/20",
    cta: "Sign image"
  },
  {
    id: "imageToPdf",
    title: "Image to PDF",
    subtitle: "Turn photos and screenshots into a clean PDF.",
    mode: "imageToPdf",
    accent: "from-rose-400/45 to-orange-300/20",
    cta: "Convert image"
  },
  {
    id: "pdfToImage",
    title: "PDF to Image",
    subtitle: "Export PDF pages as image files with the same layout.",
    mode: "pdfToImage",
    accent: "from-sky-400/45 to-cyan-400/20",
    cta: "Export images"
  },
  {
    id: "combinePdf",
    title: "Combine PDFs",
    subtitle: "Merge multiple PDFs into one document.",
    mode: "pdfToPdf",
    accent: "from-green-400/45 to-emerald-400/20",
    cta: "Merge PDFs"
  },
  {
    id: "pdfToWord",
    title: "PDF to Word",
    subtitle: "Extract text from PDFs with OCR for copy and editing.",
    mode: "pdfToPdf",
    accent: "from-indigo-400/45 to-violet-400/20",
    cta: "Extract text"
  }
];

const EDIT_TOOL_IDS = new Set(["editPdf", "editImage"]);
const TEXT_TOOL_IDS = new Set(["textPdf", "textImage"]);
const SIGNATURE_TOOL_IDS = new Set(["signaturePdf", "signatureImage"]);

function getToolAnchor(toolId) {
  if (TEXT_TOOL_IDS.has(toolId)) {
    return "text-tool-panel";
  }

  if (SIGNATURE_TOOL_IDS.has(toolId)) {
    return "signature-panel";
  }

  return "upload-section";
}

function getHomeExportProfile(toolId) {
  const pdfAllowed = !new Set(["pdfToImage", "pdfToWord"]).has(toolId);

  return {
    imageLabel: "Download Image",
    pdfLabel: pdfAllowed ? "Download PDF" : "",
    showPdf: pdfAllowed
  };
}

function getToolCopy(toolId) {
  switch (toolId) {
    case "editPdf":
      return {
        title: "Edit PDF",
        subtitle: "Add text, signatures, and page cleanup inside PDF files.",
        uploadTitle: "Edit PDF",
        uploadDescription: "Upload a PDF, then place text or signatures on the selected page.",
        primaryLabel: "Open PDF"
      };
    case "editImage":
      return {
        title: "Edit Image",
        subtitle: "Mark up images with text, signatures, and crop control.",
        uploadTitle: "Edit Image",
        uploadDescription: "Upload an image, then crop, annotate, and export it.",
        primaryLabel: "Open image"
      };
    case "textPdf":
      return {
        title: "Add Text PDF",
        subtitle: "Place labels, notes, or timestamps on a PDF page.",
        uploadTitle: "Add Text to PDF",
        uploadDescription: "Upload a PDF and place notes, dates, or labels on the selected page.",
        primaryLabel: "Open PDF"
      };
    case "signaturePdf":
      return {
        title: "Add Signature PDF",
        subtitle: "Draw or upload a signature and place it on a PDF.",
        uploadTitle: "Add Signature to PDF",
        uploadDescription: "Upload a PDF and place your signature on the selected page.",
        primaryLabel: "Open PDF"
      };
    case "textImage":
      return {
        title: "Add Text Image",
        subtitle: "Place text on an image before exporting or saving.",
        uploadTitle: "Add Text to Image",
        uploadDescription: "Upload an image and place text on top of it.",
        primaryLabel: "Open image"
      };
    case "signatureImage":
      return {
        title: "Add Signature Image",
        subtitle: "Draw or upload a signature and place it on an image.",
        uploadTitle: "Add Signature to Image",
        uploadDescription: "Upload an image and place your signature on top of it.",
        primaryLabel: "Open image"
      };
    case "pdfToImage":
      return {
        title: "PDF to Image",
        subtitle: "Export PDF pages as image files with the same layout.",
        uploadTitle: "Convert PDF to Image",
        uploadDescription: "Upload a PDF and convert each page into images.",
        primaryLabel: "Open PDF"
      };
    case "combinePdf":
      return {
        title: "Combine PDFs",
        subtitle: "Merge multiple PDFs into one document.",
        uploadTitle: "Combine PDFs",
        uploadDescription: "Upload multiple PDFs and merge them into one document.",
        primaryLabel: "Open PDFs"
      };
    case "pdfToWord":
      return {
        title: "PDF to Word",
        subtitle: "Extract text from PDFs with OCR for copy and editing.",
        uploadTitle: "Convert PDF to Word",
        uploadDescription: "Upload a PDF and extract editable text with OCR.",
        primaryLabel: "Open PDF"
      };
    case "imageToPdf":
    default:
      return {
        title: "Image to PDF",
        subtitle: "Turn photos and screenshots into a clean PDF.",
        uploadTitle: "Convert Image to PDF",
        uploadDescription: "Upload an image and convert it into a clean PDF.",
        primaryLabel: "Open image"
      };
  }
}

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

function HomePage() {
  const navigate = useNavigate();
  const uploadSectionRef = useRef(null);
  const [selectedTool, setSelectedTool] = useState(TOOL_CARDS.find((tool) => tool.id === "imageToPdf") || TOOL_CARDS[0]);
  const selectedCopy = useMemo(() => getToolCopy(selectedTool.id), [selectedTool.id]);
  const [homeFiles, setHomeFiles] = useState([]);
  const [homePreview, setHomePreview] = useState("");
  const [homeAnnotations, setHomeAnnotations] = useState([]);
  const [config, setConfig] = useState({ upiId: "", upiName: "" });
  const [paywallOpen, setPaywallOpen] = useState(false);
  const [paymentPlan, setPaymentPlan] = useState(null);
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [paymentLoading, setPaymentLoading] = useState(false);
  const [paymentStatus, setPaymentStatus] = useState("");
  const exportProfile = useMemo(() => getHomeExportProfile(selectedTool.id), [selectedTool.id]);

  useEffect(() => {
    api.getPublicConfig().then(setConfig).catch(() => {});
  }, []);

  const handleHomeFiles = async (files) => {
    const list = Array.from(files || []);
    if (!list.length) {
      return;
    }

    setHomeFiles(list);
    setPaymentStatus("");
    setHomeAnnotations([]);

    const firstFile = list[0];
    const isPdf = firstFile.type === "application/pdf" || firstFile.name.toLowerCase().endsWith(".pdf");

    if (isPdf) {
      try {
        const { getDocument, GlobalWorkerOptions } = await import("pdfjs-dist/build/pdf");
        GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/build/pdf.worker.mjs", import.meta.url).toString();
        const bytes = new Uint8Array(await firstFile.arrayBuffer());
        const pdf = await getDocument({ data: bytes }).promise;
        const page = await pdf.getPage(1);
        const viewport = page.getViewport({ scale: 1.6 });
        const canvas = document.createElement("canvas");
        const context = canvas.getContext("2d");
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        await page.render({ canvasContext: context, viewport }).promise;
        setHomePreview(canvas.toDataURL("image/png"));
      } catch (error) {
        setHomePreview("");
        setPaymentStatus(error.message);
      }
      return;
    }

    const preview = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ""));
      reader.onerror = () => reject(new Error(`Failed to read ${firstFile.name}`));
      reader.readAsDataURL(firstFile);
    });
    setHomePreview(preview);
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
      navigate("/recover", { state: { email: String(email).trim() } });
    } catch (error) {
      setPaymentStatus(error.message);
    } finally {
      setPaymentLoading(false);
    }
  };

  const buildHomeExportCanvas = async () => {
    if (!homePreview) {
      return null;
    }

    const image = new Image();
    image.src = homePreview;
    await new Promise((resolve, reject) => {
      image.onload = resolve;
      image.onerror = reject;
    });

    return buildCanvasFromImage({
      image,
      corners: null,
      filterStyle: "none",
      watermark: false,
      annotations: homeAnnotations
    });
  };

  const downloadHomeImage = async () => {
    const canvas = await buildHomeExportCanvas();
    if (!canvas) {
      return;
    }

    const link = document.createElement("a");
    link.href = canvas.toDataURL("image/png");
    link.download = `${selectedTool.id || "iscanner"}-preview.png`;
    link.click();
  };

  const downloadHomePdf = async () => {
    const canvas = await buildHomeExportCanvas();
    if (!canvas) {
      return;
    }

    const doc = new jsPDF({ orientation: "portrait", unit: "px", format: "a4" });
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 24;
    const scale = Math.min((pageWidth - margin * 2) / canvas.width, (pageHeight - margin * 2) / canvas.height);
    const renderWidth = canvas.width * scale;
    const renderHeight = canvas.height * scale;
    const offsetX = (pageWidth - renderWidth) / 2;
    const offsetY = (pageHeight - renderHeight) / 2;
    doc.addImage(canvas.toDataURL("image/png"), "PNG", offsetX, offsetY, renderWidth, renderHeight, undefined, "FAST");
    doc.save(`${selectedTool.id || "iscanner"}-preview.pdf`);
  };

  return (
    <div className="min-h-screen px-4 py-8 text-white sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <header className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="text-xs uppercase tracking-[0.35em] text-accent">Document Suite</div>
            <h1 className="mt-3 max-w-3xl font-display text-5xl text-white sm:text-6xl">
              All your PDF and document tools in one clean place.
            </h1>
            <p className="mt-4 max-w-3xl text-sm leading-7 text-slate-300 sm:text-base">
              Image to PDF, PDF to image, crop, sign, annotate, OCR, and A4 export with a lighter iLovePDF-style layout.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => setPaywallOpen(true)}
              className="rounded-full border border-emerald-400/20 bg-emerald-500/10 px-4 py-2 text-sm font-semibold text-emerald-100"
            >
              Subscription Plans
            </button>
            <button
              type="button"
              onClick={() => {
                uploadSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
              }}
              className="rounded-full border border-white/15 bg-white/10 px-4 py-2 text-sm font-semibold text-white"
            >
              Free plan included
            </button>
            <button
              type="button"
              onClick={() => navigate("/recover")}
              className="rounded-full border border-white/15 bg-white/10 px-4 py-2 text-sm font-semibold text-white"
            >
              Check Payment Status
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
          <div className="grid gap-5 lg:grid-cols-[1fr,0.9fr] lg:items-center">
            <div>
              <div className="text-xs uppercase tracking-[0.3em] text-accent">Tools</div>
              <h2 className="mt-2 text-3xl font-semibold text-white">Choose a box to open that workflow</h2>
              <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-300">
                Tap a tool card to swap the upload section below. The full editor is still available if you want
                the complete scanner experience.
              </p>
            </div>
          </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {TOOL_CARDS.map((tool) => (
                <button
                  key={tool.id}
                  type="button"
                  onClick={() => {
                  setSelectedTool(tool);
                  window.setTimeout(() => {
                    uploadSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
                  }, 30);
                }}
                  className="group relative overflow-hidden rounded-[1.6rem] border border-white/10 bg-black/20 p-5 text-left transition hover:-translate-y-0.5 hover:border-white/20"
                >
                  <div className={`absolute inset-0 bg-gradient-to-br ${tool.accent} opacity-25 transition group-hover:opacity-35`} />
                  <div className="absolute inset-x-0 top-0 h-px bg-white/15" />
                  <div className="absolute -right-10 -top-10 h-32 w-32 rounded-full bg-white/10 blur-3xl" />
                  <div className="relative">
                    <div className={`inline-flex rounded-2xl bg-gradient-to-br ${tool.accent} px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-white shadow-lg`}>
                      {tool.cta}
                    </div>
                    <div className="mt-4 text-xl font-semibold text-white">{tool.title}</div>
                    <div className="mt-2 text-sm leading-6 text-slate-200/90">{tool.subtitle}</div>
                  </div>
              </button>
              ))}
            </div>

          <div ref={uploadSectionRef} id="home-upload-section" className="mt-6 rounded-[2rem] border border-white/10 bg-white/6 p-6 shadow-glow scroll-mt-24">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <div className="text-xs uppercase tracking-[0.3em] text-accent">Upload section</div>
                <h3 className="mt-2 text-3xl font-semibold text-white">{selectedCopy.uploadTitle}</h3>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300">{selectedCopy.uploadDescription}</p>
                <div className="mt-4 flex flex-wrap gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-200">
                  <span className="rounded-full border border-white/10 bg-black/20 px-3 py-2">Free plan: 1 scan per device</span>
                  <span className="rounded-full border border-white/10 bg-black/20 px-3 py-2">Paid plans: OCR + clean export</span>
                </div>
              </div>
              <div className="rounded-3xl border border-white/10 bg-black/20 px-4 py-4 text-xs font-semibold uppercase tracking-[0.18em] text-slate-200">
                <div className="text-slate-400">Selected tool</div>
                <div className="mt-1 text-sm text-white">{selectedTool.title}</div>
                <div className="mt-2 normal-case tracking-normal text-slate-400">
                  Click below to switch upload types without leaving this page.
                </div>
              </div>
            </div>

            <div className="mt-6">
              <ImageUpload
                onSelectFiles={handleHomeFiles}
                loading={false}
                hasPages={homeFiles.length > 0}
                mode={selectedTool.mode}
                titleOverride={selectedCopy.uploadTitle}
                descriptionOverride={selectedCopy.uploadDescription}
                primaryLabelOverride={selectedCopy.primaryLabel}
                multiLabelOverride={selectedTool.id === "pdfToWord" ? "Convert PDF pages" : ""}
                showCameraOverride={selectedTool.mode === "imageToPdf"}
              />
            </div>

            <div className="mt-5 grid gap-4 lg:grid-cols-[0.9fr,1.1fr]">
              <div className="rounded-[1.5rem] border border-white/10 bg-black/20 p-4">
                <div className="text-sm font-semibold text-white">Selected files</div>
                <div className="mt-2 text-xs text-slate-300">
                  Upload images or PDFs here and the section below will update to match the chosen tool.
                </div>
                <div className="mt-4 space-y-3">
                  {homeFiles.length ? homeFiles.map((file) => (
                    <div key={`${file.name}-${file.size}`} className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-200">
                      {file.name}
                    </div>
                  )) : (
                    <div className="rounded-2xl border border-dashed border-white/10 px-4 py-8 text-center text-sm text-slate-400">
                      No files selected yet. Click the upload button above.
                    </div>
                  )}
                </div>
              </div>
              <div className="rounded-[1.5rem] border border-white/10 bg-black/20 p-4">
                <div className="text-sm font-semibold text-white">Preview</div>
                <div className="mt-2 text-xs text-slate-300">
                  This is the quick home preview. Add text or signature below, then download directly from here.
                </div>
                <div className="mt-4 overflow-hidden rounded-[1.25rem] border border-white/10 bg-black/30 shadow-2xl">
                  {homePreview ? (
                    <div className="max-h-[44rem] overflow-auto p-2">
                      <AnnotationCanvas
                        preview={homePreview}
                        filterStyle="none"
                        annotations={homeAnnotations}
                        setAnnotations={setHomeAnnotations}
                      />
                    </div>
                  ) : (
                    <div className="grid h-72 place-items-center px-4 text-center text-sm text-slate-400">
                      Image preview appears here when you upload a photo.
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="mt-6 grid gap-4 xl:grid-cols-[0.85fr,1.15fr]">
              <div className="rounded-[1.5rem] border border-white/10 bg-black/20 p-4">
                <div className="text-sm font-semibold text-white">Add text / signature</div>
                <div className="mt-2 text-xs text-slate-300">
                  Draw or upload a signature, or place text directly on the preview before you download.
                </div>
                <div className="mt-4 space-y-4">
                  {TEXT_TOOL_IDS.has(selectedTool.id) || EDIT_TOOL_IDS.has(selectedTool.id) ? (
                    <TextTool onAdd={(value) => setHomeAnnotations((current) => [...current, {
                      id: crypto.randomUUID(),
                      type: "text",
                      value,
                      x: 0.5,
                      y: 0.5,
                      color: "#ffffff",
                      fontSize: 28,
                      fontFamily: "Sora"
                    }])} />
                  ) : null}
                  {SIGNATURE_TOOL_IDS.has(selectedTool.id) || EDIT_TOOL_IDS.has(selectedTool.id) ? (
                    <SignatureTool onAdd={(image) => setHomeAnnotations((current) => [...current, {
                      id: crypto.randomUUID(),
                      type: "signature",
                      image,
                      x: 0.62,
                      y: 0.75,
                      width: 0.24,
                      height: 0.1
                    }])} />
                  ) : null}
                </div>
              </div>
              <div className="rounded-[1.5rem] border border-white/10 bg-black/20 p-4">
                <div className="text-sm font-semibold text-white">Download</div>
                <div className="mt-2 text-xs text-slate-300">
                  Export the selected preview as an image or PDF after adding your changes.
                </div>
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <button
                    type="button"
                    onClick={downloadHomeImage}
                    disabled={!homePreview}
                    className="rounded-2xl bg-white px-5 py-3 text-sm font-semibold text-slate-950 disabled:opacity-60"
                  >
                    {exportProfile.imageLabel}
                  </button>
                  {exportProfile.showPdf ? (
                    <button
                      type="button"
                      onClick={downloadHomePdf}
                      disabled={!homePreview}
                      className="rounded-2xl border border-white/15 bg-white/10 px-5 py-3 text-sm font-semibold text-white disabled:opacity-60"
                    >
                      {exportProfile.pdfLabel}
                    </button>
                  ) : (
                    <div className="rounded-2xl border border-dashed border-white/10 bg-black/20 px-5 py-3 text-sm text-slate-300 sm:col-span-2">
                      This tool exports as an image preview here. Document-style PDF export is available for the PDF
                      and image-to-PDF workflows.
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={() => navigate("/recover")}
                    className="rounded-2xl border border-white/15 bg-white/10 px-5 py-3 text-sm font-semibold text-white"
                  >
                    Check status
                  </button>
                  <button
                    type="button"
                    onClick={() => navigate("/admin")}
                    className="rounded-2xl border border-white/15 bg-white/10 px-5 py-3 text-sm font-semibold text-white"
                  >
                    Admin
                  </button>
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>

      <PaywallModal
        open={paywallOpen}
        onClose={() => setPaywallOpen(false)}
        onChoosePlan={handleChoosePlan}
        reason="Choose a pass to unlock OCR, clean export, and additional scanner tools."
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

function ScannerPage() {
  const { toolId } = useParams();
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
  const [selectedTool, setSelectedTool] = useState("editPdf");
  const imageRef = useRef(null);
  const uploadSectionRef = useRef(null);
  const toolsSectionRef = useRef(null);
  const navigate = useNavigate();
  const preview = pages[selectedPageIndex]?.src || "";
  const scrollTo = (ref) => {
    ref.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };
  const routeTool = TOOL_CARDS.find((tool) => tool.id === toolId);
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

  useEffect(() => {
    if (!toolId) {
      return;
    }

    const nextTool = TOOL_CARDS.find((tool) => tool.id === toolId);
    if (!nextTool) {
      navigate("/");
      return;
    }

    setSelectedTool(nextTool.id);
    setConversionMode(nextTool.mode);
    setMessage("");

    const anchorId = getToolAnchor(nextTool.id);
    const scrollTimer = window.setTimeout(() => {
      uploadSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });

      if (anchorId !== "upload-section") {
        window.setTimeout(() => {
          document.getElementById(anchorId)?.scrollIntoView({ behavior: "smooth", block: "start" });
        }, 250);
      }
    }, 50);

    return () => window.clearTimeout(scrollTimer);
  }, [toolId, navigate]);

  const activeTool = useMemo(
    () => TOOL_CARDS.find((tool) => tool.id === selectedTool) || TOOL_CARDS[0],
    [selectedTool]
  );
  const activeToolCopy = useMemo(() => getToolCopy(selectedTool), [selectedTool]);
  const showTextTool = EDIT_TOOL_IDS.has(selectedTool) || TEXT_TOOL_IDS.has(selectedTool);
  const showSignatureTool = EDIT_TOOL_IDS.has(selectedTool) || SIGNATURE_TOOL_IDS.has(selectedTool);
  const showOcrTools = selectedTool === "pdfToWord";
  const showFilterTools = selectedTool !== "pdfToWord";

  if (toolId) {
    return (
      <div className="min-h-screen px-4 py-6 text-white sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <button
              type="button"
              onClick={() => navigate("/")}
              className="inline-flex items-center gap-3 self-start rounded-full border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-white"
            >
              <span className="text-lg leading-none">←</span>
              Back
            </button>
            <div>
              <div className="text-xs uppercase tracking-[0.35em] text-accent">Open tool</div>
              <h1 className="mt-2 text-3xl font-semibold text-white">{activeToolCopy.title}</h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300">{activeToolCopy.subtitle}</p>
            </div>
          </div>

          <section
            ref={uploadSectionRef}
            id="upload-section"
            className="rounded-[2.4rem] border border-white/15 bg-gradient-to-br from-white/10 via-white/6 to-transparent p-6 shadow-glow scroll-mt-28"
          >
            <div className="flex flex-col gap-4 border-b border-white/10 pb-5 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <div className="text-xs uppercase tracking-[0.3em] text-accent">Selected tool</div>
                <h3 className="mt-2 text-3xl font-semibold text-white">{activeToolCopy.uploadTitle}</h3>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300">{activeToolCopy.uploadDescription}</p>
              </div>
              <div className="flex flex-col gap-2 rounded-3xl border border-white/10 bg-black/20 px-4 py-4 text-xs font-semibold uppercase tracking-[0.18em] text-slate-200">
                <span className="text-slate-400">Selected workflow</span>
                <span className="text-sm text-white">{routeTool?.title || activeToolCopy.title}</span>
                <span className="text-[11px] normal-case tracking-normal text-slate-400">
                  Upload here, then continue with crop, text, signature, OCR, or export tools below.
                </span>
              </div>
            </div>

            <div className="mt-6">
              <ImageUpload
                onSelectFiles={handleSelectFiles}
                loading={uploading}
                hasPages={pages.length > 0}
                mode={conversionMode}
                titleOverride={activeToolCopy.uploadTitle}
                descriptionOverride={activeToolCopy.uploadDescription}
                primaryLabelOverride={activeToolCopy.primaryLabel}
                multiLabelOverride={selectedTool === "pdfToWord" ? "Convert PDF pages" : ""}
                showCameraOverride={selectedTool !== "pdfToWord"}
              />
            </div>

            <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <button
                type="button"
                onClick={() => {
                  if (!canUseEditingTools) {
                    requirePaid("Unlock paid subscription to add and edit text inside the image or PDF.");
                    return;
                  }

                  document.getElementById("text-tool-panel")?.scrollIntoView({ behavior: "smooth", block: "start" });
                }}
                className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm font-semibold text-white"
              >
                {selectedTool.includes("Image") ? "Add Text to Image" : "Add Text to PDF"}
              </button>
              <button
                type="button"
                onClick={addTimestamp}
                className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm font-semibold text-white"
              >
                Add Current Time
              </button>
              <button
                type="button"
                onClick={handleDetectEdges}
                disabled={!preview || edgeLoading}
                className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm font-semibold text-white disabled:opacity-60"
              >
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
                className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm font-semibold text-white"
              >
                {selectedTool.includes("Image") ? "Add Signature to Image" : "Add Signature to PDF"}
              </button>
            </div>
          </section>

          <div className="mt-6 grid gap-6 xl:grid-cols-[1.2fr,0.8fr]">
            <div className="space-y-6">
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
                          Keep the original file, or crop only the pages you want.
                        </div>

                        {pages.length > 1 ? (
                          <div className="mt-4">
                            <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-300">
                              Page
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
                                    Page {index + 1}
                                  </div>
                                  <div className="mt-1 text-sm font-semibold">Page {index + 1}</div>
                                </button>
                              ))}
                            </div>
                          </div>
                        ) : null}
                      </div>
                      <div className="w-full xl:max-w-[20rem]">
                        <div className="rounded-3xl border border-white/10 bg-black/20 p-3">
                          <div className="mb-2 flex items-center justify-between gap-3">
                            <div>
                              <div className="text-sm font-semibold text-white">Live preview</div>
                              <div className="text-xs text-slate-300">Tap a page above to edit it.</div>
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
              ) : (
                <div className="rounded-[2rem] border border-white/10 bg-white/5 p-6 text-sm text-slate-300">
                  Upload a file to start editing.
                </div>
              )}
            </div>

            <div className="space-y-4">
              <div className="rounded-3xl border border-white/10 bg-white/5 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold text-white">Pages in current document</div>
                    <div className="text-xs text-slate-300">Add more files with the plus button inside upload.</div>
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
              <div className="rounded-3xl border border-white/10 bg-white/5 p-4">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold text-white">Export</div>
                    <div className="text-xs text-slate-300">Choose PDF or image export.</div>
                  </div>
                </div>
                <div className="grid gap-3">
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
              <div ref={toolsSectionRef} id="tools-section" className="scroll-mt-28">
                {showFilterTools ? <FilterPanel activeFilter={filter} onChange={setFilter} /> : null}
              </div>
              {showTextTool ? (
                <AccessGuard
                  allowed={canUseEditingTools}
                  onLocked={() => requirePaid("Unlock paid subscription to add and edit text inside the image or PDF.")}
                  note="Paid version unlocks text editing, signature placement, combine files, and clean export."
                >
                  <div id="text-tool-panel">
                    <TextTool onAdd={addAnnotationText} />
                  </div>
                </AccessGuard>
              ) : null}
              {showSignatureTool ? (
                <AccessGuard
                  allowed={canUseEditingTools}
                  onLocked={() => requirePaid("Unlock paid subscription to add and edit signatures inside the image or PDF.")}
                  note="Paid version unlocks text editing, signature placement, combine files, and clean export."
                >
                  <div id="signature-panel">
                    <SignatureTool onAdd={addSignature} />
                  </div>
                </AccessGuard>
              ) : null}
              {showOcrTools ? (
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
              ) : null}
            </div>
          </div>
        </div>
      </div>
    );
  }

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
      navigate("/recover", { state: { email: String(email).trim() } });
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
        <div className="sticky top-0 z-30 -mx-4 mb-6 border-b border-white/10 bg-slate-950/80 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
          <div className="mx-auto flex max-w-7xl flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <button
              type="button"
              onClick={() => scrollTo(uploadSectionRef)}
              className="inline-flex items-center gap-3 text-left"
            >
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white text-2xl font-black text-slate-950">
                i
              </div>
              <div>
                <div className="text-sm font-black uppercase tracking-[0.18em] text-white">iScanner</div>
                <div className="text-xs text-slate-400">PDF editor and converter</div>
              </div>
            </button>

            <div className="flex flex-wrap gap-2 overflow-x-auto pb-1 lg:justify-center">
              {[
                { label: "Upload", action: () => scrollTo(uploadSectionRef) },
                { label: "Tools", action: () => scrollTo(toolsSectionRef) },
                { label: "Status", action: () => navigate("/recover") },
                { label: "Admin", action: () => navigate("/admin") }
              ].map((item) => (
                <button
                  key={item.label}
                  type="button"
                  onClick={item.action}
                  className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-100"
                >
                  {item.label}
                </button>
              ))}
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => scrollTo(uploadSectionRef)}
                className="rounded-full bg-white px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-950"
              >
                Select file
              </button>
              <button
                type="button"
                onClick={() => navigate("/recover")}
                className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-white"
              >
                Check status
              </button>
            </div>
          </div>
        </div>

        <header className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="text-xs uppercase tracking-[0.35em] text-accent">Document Suite</div>
            <h1 className="mt-3 max-w-3xl font-display text-5xl text-white sm:text-6xl">
              All your PDF and document tools in one clean place.
            </h1>
            <p className="mt-4 max-w-3xl text-sm leading-7 text-slate-300 sm:text-base">
              Image to PDF, PDF to image, crop, sign, annotate, OCR, and A4 export with a lighter iLovePDF-style layout.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              {CONVERSION_MODES.map((mode) => (
                <button
                  key={mode.id}
                  type="button"
                  onClick={() => {
                    setConversionMode(mode.id);
                    setMessage("");
                    scrollTo(uploadSectionRef);
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
                Choose Plan
              </button>
            ) : null}
          </div>
        </header>

        <section ref={toolsSectionRef} className="mb-6 rounded-[2rem] border border-white/10 bg-gradient-to-br from-white/8 via-white/5 to-transparent p-5 shadow-glow scroll-mt-28">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="text-xs uppercase tracking-[0.3em] text-accent">Tools</div>
              <h2 className="mt-2 text-3xl font-semibold text-white">Choose a box to open that workflow</h2>
              <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-300">
                Each tool opens its own upload and editing area so the page stays focused on one job at a time.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => navigate("/recover")}
                className="rounded-full border border-white/10 bg-white/5 px-5 py-3 text-sm font-semibold text-white"
              >
                Check payment status
              </button>
            </div>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {TOOL_CARDS.map((tool) => (
              <button
                key={tool.id}
                type="button"
                onClick={() => navigate(`/tool/${tool.id}`)}
                className={`rounded-[1.6rem] border p-5 text-left transition hover:-translate-y-0.5 ${
                  selectedTool === tool.id
                    ? "border-white/20 bg-white/10 shadow-glow"
                    : "border-white/10 bg-black/20 hover:border-white/20"
                }`}
              >
                <div className={`inline-flex rounded-2xl bg-gradient-to-br ${tool.accent} px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-white`}>
                  {tool.cta}
                </div>
                <div className="mt-4 text-xl font-semibold text-white">{tool.title}</div>
                <div className="mt-2 text-sm leading-6 text-slate-300">{tool.subtitle}</div>
              </button>
            ))}
          </div>

          <div className="mt-5 rounded-[1.4rem] border border-white/10 bg-black/20 p-4">
            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => navigate("/recover")}
                className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-white"
              >
                Payment status
              </button>
              <button
                type="button"
                onClick={() => {
                  navigate("/tool/pdfToWord");
                }}
                className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-white"
              >
                PDF to Word
              </button>
            </div>
          </div>
        </section>

        {message ? (
          <div className="mb-6 rounded-2xl border border-amber-400/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
            {message}
          </div>
        ) : null}

        <div className="grid gap-6 xl:grid-cols-[1.2fr,0.8fr]">
          <div className="space-y-6">
            <section
              ref={uploadSectionRef}
              id="upload-section"
              className="rounded-[2rem] border border-white/10 bg-white/5 p-5 shadow-glow"
            >
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <div className="text-xs uppercase tracking-[0.3em] text-accent">Selected tool</div>
                  <h3 className="mt-2 text-3xl font-semibold text-white">{activeTool.title}</h3>
                  <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300">{activeTool.subtitle}</p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-xs font-semibold uppercase tracking-[0.18em] text-slate-200">
                  {routeTool?.title || activeTool.title}
                </div>
              </div>

              <div className="mt-5">
                <ImageUpload
                  onSelectFiles={handleSelectFiles}
                  loading={uploading}
                  hasPages={pages.length > 0}
                  mode={conversionMode}
                  titleOverride={activeToolCopy.uploadTitle}
                  descriptionOverride={activeToolCopy.uploadDescription}
                  primaryLabelOverride={activeToolCopy.primaryLabel}
                  multiLabelOverride={selectedTool === "pdfToWord" ? "Convert PDF pages" : ""}
                  showCameraOverride={selectedTool !== "pdfToWord"}
                />
              </div>

              <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <button
                  type="button"
                  onClick={() => {
                    if (!canUseEditingTools) {
                      requirePaid("Unlock paid subscription to add and edit text inside the image or PDF.");
                      return;
                    }

                    document.getElementById("text-tool-panel")?.scrollIntoView({ behavior: "smooth", block: "start" });
                  }}
                  className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm font-semibold text-white"
                >
                  {selectedTool.includes("Image") ? "Add Text to Image" : "Add Text to PDF"}
                </button>
                <button
                  type="button"
                  onClick={addTimestamp}
                  className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm font-semibold text-white"
                >
                  Add Current Time
                </button>
                <button
                  type="button"
                  onClick={handleDetectEdges}
                  disabled={!preview || edgeLoading}
                  className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm font-semibold text-white disabled:opacity-60"
                >
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
                  className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm font-semibold text-white"
                >
                  {selectedTool.includes("Image") ? "Add Signature to Image" : "Add Signature to PDF"}
                </button>
              </div>
            </section>
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

            <div ref={toolsSectionRef} id="tools-section" className="scroll-mt-28">
              {showFilterTools ? <FilterPanel activeFilter={filter} onChange={setFilter} /> : null}
            </div>
            {showTextTool ? (
              <AccessGuard
                allowed={canUseEditingTools}
                onLocked={() => requirePaid("Unlock paid subscription to add and edit text inside the image or PDF.")}
                note="Paid version unlocks text editing, signature placement, combine files, and clean export."
              >
                <div id="text-tool-panel">
                  <TextTool onAdd={addAnnotationText} />
                </div>
              </AccessGuard>
            ) : null}

            {showSignatureTool ? (
              <AccessGuard
                allowed={canUseEditingTools}
                onLocked={() => requirePaid("Unlock paid subscription to add and edit signatures inside the image or PDF.")}
                note="Paid version unlocks text editing, signature placement, combine files, and clean export."
              >
                <div id="signature-panel">
                  <SignatureTool onAdd={addSignature} />
                </div>
              </AccessGuard>
            ) : null}

            {showOcrTools ? (
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
            ) : null}
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
  const location = useLocation();
  const initialEmail = location.state?.email || "";
  const navigate = useNavigate();

  const handleRecover = async (email) => {
    try {
      const response = await api.recoverAccess(email);
      if (response.token && response.access) {
        setStoredToken(response.token);
        setStatus(`Payment approved. Your ${formatPlanName(response.access.plan)} pass is active until ${formatAccessExpiry(response.access.expiry)}. Redirecting...`);
        setTimeout(() => navigate("/"), 900);
        return;
      }

      if (response.paymentStatus) {
        setStatus(`Payment status: ${response.paymentStatus}.`);
        return;
      }

      setStatus("No active access found.");
    } catch (error) {
      setStatus(error.message);
    }
  };

  return (
    <div className="min-h-screen px-4 py-8">
      <RecoverAccess onRecover={handleRecover} status={status} onBack={() => navigate("/")} initialEmail={initialEmail} />
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
      <Route path="/" element={<HomePage />} />
      <Route path="/tool/:toolId" element={<ScannerPage />} />
      <Route path="/recover" element={<RecoverPage />} />
      <Route path="/admin" element={<AdminPage />} />
    </Routes>
  );
}

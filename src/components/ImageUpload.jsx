import { useRef } from "react";

const MODE_CONFIG = {
  imageToPdf: {
    title: "Upload image file",
    multiTitle: "Upload multiple images",
    description: "Add one image or many images. New uploads stay in the current document and do not remove previous ones.",
    accept: "image/*",
    allowCamera: true
  },
  pdfToPdf: {
    title: "Upload PDF file",
    multiTitle: "Upload multiple PDFs",
    description: "Add one PDF or many PDFs. New uploads stay in the current document and do not remove previous ones.",
    accept: ".pdf,application/pdf",
    allowCamera: false
  },
  pdfToImage: {
    title: "Upload PDF file",
    multiTitle: "Upload multiple PDFs",
    description: "Upload PDF pages and convert them into images. New uploads stay in the current document and do not remove previous ones.",
    accept: ".pdf,application/pdf",
    allowCamera: false
  }
};

export function ImageUpload({ onSelectFiles, loading, hasPages = false, mode = "imageToPdf" }) {
  const fileRef = useRef(null);
  const multiFileRef = useRef(null);
  const cameraRef = useRef(null);
  const config = MODE_CONFIG[mode] || MODE_CONFIG.imageToPdf;

  const handleFiles = (files) => {
    const list = Array.from(files || []);

    if (!list.length) {
      return;
    }

    onSelectFiles(list);
  };

  return (
    <section className="rounded-[2rem] border border-white/10 bg-white/5 p-6 shadow-glow backdrop-blur">
      <div className="mb-5 flex items-end justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-accent">Capture</p>
          <h2 className="font-display text-3xl text-white">Bring in your document</h2>
        </div>
        <div className="text-sm text-slate-300">Drag in a file or open the phone camera.</div>
      </div>

      <div
        onDragOver={(event) => event.preventDefault()}
        onDrop={(event) => {
          event.preventDefault();
          handleFiles(event.dataTransfer.files);
        }}
        className="grid min-h-64 place-items-center rounded-[1.5rem] border border-dashed border-white/15 bg-grid grid-bg bg-[length:38px_38px] p-8 text-center"
      >
        <div className="max-w-md">
          <div className="text-lg font-semibold text-white">{hasPages ? `Add another ${config.title.toLowerCase().replace("upload ", "")}` : config.title}</div>
          <div className="mt-2 text-sm leading-6 text-slate-300">{config.description}</div>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={loading}
              className="rounded-full bg-accent px-5 py-3 text-sm font-semibold text-white transition hover:scale-[1.02]"
            >
              {loading ? "Preparing..." : hasPages ? `Upload second ${mode === "imageToPdf" ? "image" : "PDF"}` : config.title}
            </button>
            <button
              type="button"
              onClick={() => multiFileRef.current?.click()}
              disabled={loading}
              className="rounded-full border border-white/15 bg-white/10 px-5 py-3 text-sm font-semibold text-white"
            >
              {config.multiTitle}
            </button>
            {config.allowCamera ? (
              <button
                type="button"
                onClick={() => cameraRef.current?.click()}
                disabled={loading}
                className="rounded-full border border-white/15 bg-white/10 px-5 py-3 text-sm font-semibold text-white"
              >
                Use Camera
              </button>
            ) : null}
          </div>
        </div>
      </div>

      <input
        ref={fileRef}
        type="file"
        accept={config.accept}
        className="hidden"
        onChange={(event) => handleFiles(event.target.files)}
      />
      <input
        ref={multiFileRef}
        type="file"
        accept={config.accept}
        multiple
        className="hidden"
        onChange={(event) => handleFiles(event.target.files)}
      />
      <input
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        multiple
        className="hidden"
        onChange={(event) => handleFiles(event.target.files)}
      />
    </section>
  );
}

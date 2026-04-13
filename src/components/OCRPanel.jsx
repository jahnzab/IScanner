export function OCRPanel({ text, loading, onRun, disabled }) {
  return (
    <div className="rounded-3xl border border-white/10 bg-white/5 p-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <div className="text-sm font-semibold text-white">Read text from document</div>
          <div className="text-xs text-slate-300">Pull text from the current page when you need it.</div>
        </div>
        <button
          type="button"
          onClick={onRun}
          disabled={disabled || loading}
          className="rounded-full bg-white/10 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
        >
          {loading ? "Reading..." : "Run OCR"}
        </button>
      </div>
      <textarea
        value={text}
        readOnly
        placeholder="Document text appears here"
        className="mt-3 min-h-44 w-full rounded-2xl border border-white/10 bg-black/20 p-4 text-sm text-slate-100 outline-none placeholder:text-slate-500"
      />
    </div>
  );
}

export function PDFExport({ onExport, disabled, label }) {
  return (
    <button
      type="button"
      onClick={onExport}
      disabled={disabled}
      className="w-full min-h-[3.75rem] rounded-[1.5rem] bg-gradient-to-r from-accent to-amber-300 px-6 py-4 text-base font-semibold text-slate-950 shadow-glow disabled:opacity-60"
    >
      {label}
    </button>
  );
}

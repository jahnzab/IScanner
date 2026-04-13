export function AccessGuard({ allowed, onLocked, children, note }) {
  if (allowed) {
    return children;
  }

  return (
    <button
      type="button"
      onClick={onLocked}
      className="w-full rounded-2xl border border-dashed border-amber-400/40 bg-amber-400/10 p-4 text-left text-sm text-amber-100 transition hover:bg-amber-400/15"
    >
      <div className="font-semibold">Unlock paid version</div>
      <div className="mt-1 text-xs text-amber-50/80">{note}</div>
    </button>
  );
}

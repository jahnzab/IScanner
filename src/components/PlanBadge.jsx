export function PlanBadge({ access }) {
  if (!access) {
    return (
      <div className="rounded-full border border-white/15 bg-white/5 px-4 py-2 text-xs font-semibold uppercase tracking-[0.24em] text-amber-200">
        Free Mode
      </div>
    );
  }

  const expiryLabel = new Date(access.expiry).toLocaleString([], {
    dateStyle: "medium",
    timeStyle: "short"
  });
  const planLabel = String(access.plan || "")
    .replace(/([A-Z])/g, " $1")
    .replace(/^./, (value) => value.toUpperCase())
    .trim();

  return (
    <div className="rounded-full border border-emerald-300/30 bg-emerald-400/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.24em] text-emerald-200">
      Unlocked Paid Version • {planLabel} • Until {expiryLabel}
    </div>
  );
}

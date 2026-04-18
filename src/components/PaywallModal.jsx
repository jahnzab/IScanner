import { PLANS } from "../config/plans";

export function PaywallModal({ open, onClose, onChoosePlan, reason }) {
  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-40 flex items-start justify-center overflow-y-auto bg-slate-950/80 p-3 backdrop-blur sm:items-center sm:p-4">
      <div className="w-full max-w-5xl max-h-[calc(100dvh-1.5rem)] overflow-y-auto rounded-[2rem] border border-white/10 bg-slate-950 shadow-2xl shadow-black/40">
        <div className="flex items-start justify-between gap-4">
          <div className="p-6 pb-0">
            <div className="text-xs uppercase tracking-[0.3em] text-accent">Unlock access</div>
            <h2 className="mt-2 font-display text-4xl text-white">Choose your pass</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300">
              {reason || "Your one free lifetime scan has already been used on this device."}
            </p>
          </div>
          <button type="button" onClick={onClose} className="m-6 rounded-full bg-white/10 px-4 py-2 text-sm text-white">
            Back
          </button>
        </div>

        <div className="grid gap-4 p-6 pt-4 sm:grid-cols-2 xl:grid-cols-5">
          {PLANS.map((plan) => (
            <div
              key={plan.id}
              className={`rounded-[1.5rem] border border-white/10 bg-white/5 p-5 text-left ${
                plan.id === "free" ? "" : "transition hover:-translate-y-1 hover:border-accent/50"
              }`}
            >
              <div className="text-sm font-semibold uppercase tracking-[0.2em] text-amber-200">{plan.name}</div>
              {plan.id !== "free" ? (
                <div className="mt-3 flex items-end gap-3">
                  <div className="text-4xl font-bold text-white">₹{plan.amount}</div>
                  {plan.originalAmount ? (
                    <div className="pb-1 text-sm text-slate-400 line-through">₹{plan.originalAmount}</div>
                  ) : null}
                  <div className="rounded-full bg-emerald-500/15 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-200">
                    50% off
                  </div>
                </div>
              ) : (
                <div className="mt-3 text-4xl font-bold text-white">₹{plan.amount}</div>
              )}
              <div className="mt-2 text-sm text-slate-300">{plan.description}</div>
              <div className="mt-4 space-y-2 text-xs text-slate-200">
                {plan.features.map((feature) => (
                  <div key={feature}>{feature}</div>
                ))}
              </div>
              {plan.id !== "free" ? (
                <button
                  type="button"
                  onClick={() => onChoosePlan(plan)}
                  className="mt-4 rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-white"
                >
                  Choose Plan
                </button>
              ) : (
                <div className="mt-4 rounded-xl border border-white/10 bg-black/20 px-4 py-2 text-sm text-slate-300">
                  Watermark will be added after image or PDF download.
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

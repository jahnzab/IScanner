import { useEffect, useMemo, useState } from "react";
import QRCode from "qrcode";

function createUpiIntentUrl(packageName, upiUrl) {
  const normalized = upiUrl.replace(/^upi:\/\//, "");
  return `intent://${normalized}#Intent;scheme=upi;package=${packageName};end`;
}

export function PaymentModal({ open, plan, config, onClose, onSubmit, loading, status }) {
  const [qrSrc, setQrSrc] = useState("");
  const [email, setEmail] = useState("");
  const [utr, setUtr] = useState("");

  const upiUrl = useMemo(() => {
    if (!plan || !config.upiId) {
      return "";
    }

    return `upi://pay?pa=${config.upiId}&pn=${encodeURIComponent(config.upiName)}&am=${plan.amount}&cu=INR&tn=${encodeURIComponent(`iScanner ${plan.name}`)}`;
  }, [config, plan]);

  useEffect(() => {
    if (!open || !upiUrl) {
      return;
    }

    QRCode.toDataURL(upiUrl, {
      width: 220,
      margin: 1
    }).then(setQrSrc);
  }, [open, upiUrl]);

  if (!open || !plan) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-950/80 p-3 backdrop-blur sm:items-center sm:p-4">
      <div className="w-full max-w-2xl max-h-[calc(100dvh-1.5rem)] overflow-y-auto rounded-[2rem] border border-white/10 bg-slate-950 shadow-2xl shadow-black/40">
        <div className="flex items-start justify-between gap-4">
          <div className="p-6 pb-0">
            <div className="text-xs uppercase tracking-[0.3em] text-accent">Manual UPI</div>
            <h2 className="mt-2 font-display text-3xl text-white">{plan.name}</h2>
            <div className="mt-2 text-sm text-slate-300">
              Pay exactly ₹{plan.amount} using QR or a UPI app. Your UPI ID is hidden for privacy.
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="m-6 rounded-full bg-white/10 px-4 py-2 text-sm text-white"
          >
            Close
          </button>
        </div>

        <div className="grid gap-6 p-6 pt-4 md:grid-cols-[240px,1fr]">
          <div className="rounded-[1.5rem] border border-white/10 bg-white/5 p-4">
            {qrSrc ? <img src={qrSrc} alt="UPI QR code" className="mx-auto rounded-2xl bg-white p-3" /> : null}
            <div className="mt-4 text-center text-xs text-slate-300">
              Scan from GPay, PhonePe, Paytm, or BHIM
            </div>
          </div>

          <div className="space-y-4">
            <div className="rounded-[1.5rem] border border-amber-300/20 bg-amber-400/10 p-4 text-sm text-amber-50">
              Use your email and UTR so the admin can activate the subscription. Updates are usually completed in about 5 minutes.
            </div>

            <div className="grid gap-2 text-sm text-slate-200 sm:grid-cols-2">
              <a
                href={createUpiIntentUrl("com.google.android.apps.nbu.paisa.user", upiUrl)}
                target="_blank"
                rel="noreferrer"
                className="rounded-2xl bg-white/10 px-4 py-3 text-center font-semibold"
              >
                Open GPay
              </a>
              <a
                href={createUpiIntentUrl("com.phonepe.app", upiUrl)}
                target="_blank"
                rel="noreferrer"
                className="rounded-2xl bg-white/10 px-4 py-3 text-center font-semibold"
              >
                Open PhonePe
              </a>
              <a
                href={createUpiIntentUrl("net.one97.paytm", upiUrl)}
                target="_blank"
                rel="noreferrer"
                className="rounded-2xl bg-white/10 px-4 py-3 text-center font-semibold"
              >
                Open Paytm
              </a>
              <a
                href={createUpiIntentUrl("in.org.npci.upiapp", upiUrl)}
                target="_blank"
                rel="noreferrer"
                className="rounded-2xl bg-white/10 px-4 py-3 text-center font-semibold"
              >
                Open BHIM
              </a>
              <a
                href={upiUrl}
                className="sm:col-span-2 rounded-2xl border border-white/15 bg-white/5 px-4 py-3 text-center font-semibold text-slate-100"
              >
                Open default UPI app
              </a>
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-semibold text-white" htmlFor="payment-email">
                Email
              </label>
              <div className="text-xs text-slate-400">Use the same email you want the admin to activate.</div>
              <input
                id="payment-email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="your@email.com"
                inputMode="email"
                autoComplete="email"
                className="w-full rounded-2xl border border-white/15 bg-white/5 px-4 py-3 text-sm text-white outline-none placeholder:text-slate-400 ring-0 focus:border-accent focus:bg-white/10"
              />
            </div>
            <div className="space-y-2">
              <label className="block text-sm font-semibold text-white" htmlFor="payment-utr">
                UTR / transaction number
              </label>
              <div className="text-xs text-slate-400">Enter the payment reference from your UPI app so the admin can verify it quickly.</div>
              <input
                id="payment-utr"
                value={utr}
                onChange={(event) => setUtr(event.target.value)}
                placeholder="UTR or transaction ID"
                className="w-full rounded-2xl border border-white/15 bg-white/5 px-4 py-3 text-sm text-white outline-none placeholder:text-slate-400 ring-0 focus:border-accent focus:bg-white/10"
              />
            </div>
            <button
              type="button"
              onClick={() => onSubmit({ email, utr })}
              disabled={loading || !config.upiId}
              className="w-full rounded-2xl bg-accent px-4 py-3 text-sm font-semibold text-white disabled:opacity-60"
            >
              {loading ? "Saving payment..." : "I paid, activate access"}
            </button>
            {status ? <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-slate-100">{status}</div> : null}
            {!config.upiId ? (
              <div className="rounded-2xl border border-rose-400/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
                UPI is not configured yet. Add `UPI_ID` and `UPI_NAME` in `backend/.env`.
              </div>
            ) : null}
            <div className="text-xs leading-5 text-slate-400">
              Access is issued immediately and can be revoked if the UTR is fake. Approved UTRs stay active until expiry.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

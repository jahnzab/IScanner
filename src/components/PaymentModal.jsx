import { useEffect, useMemo, useState } from "react";
import QRCode from "qrcode";

function upiLink(providerBase, upiUrl) {
  return `${providerBase}${encodeURIComponent(upiUrl)}`;
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
    <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/80 p-4 backdrop-blur">
      <div className="w-full max-w-2xl rounded-[2rem] border border-white/10 bg-slate-950 p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-xs uppercase tracking-[0.3em] text-accent">Manual UPI</div>
            <h2 className="mt-2 font-display text-3xl text-white">{plan.name}</h2>
            <div className="mt-2 text-sm text-slate-300">
              Pay exactly ₹{plan.amount} to <span className="font-semibold text-white">{config.upiId}</span>
            </div>
          </div>
          <button type="button" onClick={onClose} className="rounded-full bg-white/10 px-4 py-2 text-sm text-white">
            Close
          </button>
        </div>

        <div className="mt-6 grid gap-6 md:grid-cols-[240px,1fr]">
          <div className="rounded-[1.5rem] border border-white/10 bg-white/5 p-4">
            {qrSrc ? <img src={qrSrc} alt="UPI QR code" className="mx-auto rounded-2xl bg-white p-3" /> : null}
            <div className="mt-4 text-center text-xs text-slate-300">
              Scan from GPay, PhonePe, Paytm, or BHIM
            </div>
          </div>

          <div className="space-y-4">
            <div className="grid gap-2 text-sm text-slate-200 sm:grid-cols-2">
              <a
                href={upiLink("gpay://upi/pay?url=", upiUrl)}
                className="rounded-2xl bg-white/10 px-4 py-3 text-center font-semibold"
              >
                Open GPay
              </a>
              <a
                href={upiLink("phonepe://pay?url=", upiUrl)}
                className="rounded-2xl bg-white/10 px-4 py-3 text-center font-semibold"
              >
                Open PhonePe
              </a>
              <a
                href={upiLink("paytmmp://pay?url=", upiUrl)}
                className="rounded-2xl bg-white/10 px-4 py-3 text-center font-semibold"
              >
                Open Paytm
              </a>
              <a
                href={upiLink("bhim://upi/pay?url=", upiUrl)}
                className="rounded-2xl bg-white/10 px-4 py-3 text-center font-semibold"
              >
                Open BHIM
              </a>
            </div>

            <input
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="Email for token recovery"
              className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none placeholder:text-slate-400"
            />
            <input
              value={utr}
              onChange={(event) => setUtr(event.target.value)}
              placeholder="Enter UTR / transaction ID"
              className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none placeholder:text-slate-400"
            />
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

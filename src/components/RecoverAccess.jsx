import { useState } from "react";

export function RecoverAccess({ onRecover, status, onBack }) {
  const [email, setEmail] = useState("");

  return (
    <section className="mx-auto max-w-xl rounded-[2rem] border border-white/10 bg-white/5 p-6">
      <div className="mb-4">
        <button
          type="button"
          onClick={onBack}
          className="rounded-full border border-white/15 bg-white/10 px-4 py-2 text-sm font-semibold text-white"
        >
          Back
        </button>
      </div>
      <div className="text-xs uppercase tracking-[0.3em] text-accent">Recovery</div>
      <h1 className="mt-2 font-display text-4xl text-white">Check status of paid subscription</h1>
      <p className="mt-3 text-sm leading-6 text-slate-300">
        Enter the purchase email to check whether your paid subscription is active. Manual payment approval can sometimes take up to 15 minutes.
      </p>
      <div className="mt-6 space-y-4">
        <input
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="your@email.com"
          className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none placeholder:text-slate-500"
        />
        <button
          type="button"
          onClick={() => onRecover(email)}
          className="w-full rounded-2xl bg-accent px-4 py-3 text-sm font-semibold text-white"
        >
          Check paid subscription status
        </button>
        {status ? <div className="text-sm text-slate-200">{status}</div> : null}
      </div>
    </section>
  );
}

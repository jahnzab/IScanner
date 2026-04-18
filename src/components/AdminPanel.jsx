import { useEffect, useState } from "react";
import { api } from "../lib/api";
import { STORAGE_KEYS } from "../lib/storage";

export function AdminPanel({ onBack }) {
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState("");
  const [payments, setPayments] = useState([]);
  const [freeUsages, setFreeUsages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [token, setToken] = useState(localStorage.getItem(STORAGE_KEYS.adminToken) || "");

  const loadPayments = async (adminToken = token) => {
    if (!adminToken) {
      return;
    }

    setLoading(true);
    try {
      const response = await api.getPayments(adminToken);
      setPayments(response.payments);
      setFreeUsages(response.freeUsages || []);
      setStatus("");
    } catch (error) {
      setStatus(error.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPayments();
  }, []);

  const handleLogin = async () => {
    try {
      const response = await api.adminLogin(password.trim());
      setToken(response.token);
      localStorage.setItem(STORAGE_KEYS.adminToken, response.token);
      setStatus("Admin access granted");
      loadPayments(response.token);
    } catch (error) {
      setStatus(error.message);
    }
  };

  const handleAction = async (paymentId, action) => {
    try {
      if (action === "approve") {
        await api.approvePayment(token, paymentId);
      } else {
        await api.rejectPayment(token, paymentId, "Rejected by admin");
      }
      loadPayments();
    } catch (error) {
      setStatus(error.message);
    }
  };

  return (
    <section className="mx-auto max-w-6xl rounded-[2rem] border border-white/10 bg-white/5 p-4 sm:p-6">
      <div className="mb-4">
        <button
          type="button"
          onClick={onBack}
          className="rounded-full border border-white/15 bg-white/10 px-4 py-2 text-sm font-semibold text-white"
        >
          Back
        </button>
      </div>
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <div className="text-xs uppercase tracking-[0.3em] text-accent">Admin</div>
          <h1 className="mt-2 font-display text-4xl text-white">Manual UTR review</h1>
        </div>
        <div className="flex w-full max-w-md gap-3">
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                handleLogin();
              }
            }}
            placeholder="Admin password"
            className="flex-1 rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none"
          />
          <button
            type="button"
            onClick={handleLogin}
            className="rounded-2xl bg-accent px-5 py-3 text-sm font-semibold text-white"
          >
            Login
          </button>
        </div>
      </div>

      {status ? <div className="mt-4 text-sm text-amber-200">{status}</div> : null}
      <div className="mt-4 rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-slate-300">
        Use the same value as `ADMIN_PASSWORD` from `backend/.env`. The repeated `401` lines in your backend log only mean the password entered on the admin page did not match.
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-4">
        <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
          <div className="text-xs uppercase tracking-[0.2em] text-slate-400">Pending</div>
          <div className="mt-2 text-2xl font-bold text-white">{payments.filter((p) => p.status === "pending").length}</div>
        </div>
        <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
          <div className="text-xs uppercase tracking-[0.2em] text-slate-400">Approved</div>
          <div className="mt-2 text-2xl font-bold text-white">{payments.filter((p) => p.status === "approved").length}</div>
        </div>
        <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
          <div className="text-xs uppercase tracking-[0.2em] text-slate-400">Rejected</div>
          <div className="mt-2 text-2xl font-bold text-white">{payments.filter((p) => p.status === "rejected").length}</div>
        </div>
        <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
          <div className="text-xs uppercase tracking-[0.2em] text-slate-400">Free used</div>
          <div className="mt-2 text-2xl font-bold text-white">{freeUsages.length}</div>
        </div>
      </div>

      <div className="mt-6 overflow-x-auto rounded-[1.5rem] border border-white/10">
        <table className="min-w-[880px] divide-y divide-white/10 text-left text-sm text-slate-200">
          <thead className="bg-black/20">
            <tr>
              <th className="px-4 py-3">#</th>
              <th className="px-4 py-3">UTR</th>
              <th className="px-4 py-3">Email</th>
              <th className="px-4 py-3">Plan</th>
              <th className="px-4 py-3">Amount</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/10 bg-white/5">
            {payments.map((payment, index) => (
              <tr key={payment._id}>
                <td className="px-4 py-3 font-mono text-xs text-slate-400">{String(index + 1).padStart(2, "0")}</td>
                <td className="px-4 py-3 font-mono text-xs">{payment.utr}</td>
                <td className="px-4 py-3">{payment.email}</td>
                <td className="px-4 py-3">{payment.plan}</td>
                <td className="px-4 py-3">₹{payment.amount}</td>
                <td className="px-4 py-3">{payment.status}</td>
                <td className="px-4 py-3">
                  {payment.status === "pending" ? (
                    <div className="grid gap-2 sm:flex">
                      <button
                        type="button"
                        onClick={() => handleAction(payment._id, "approve")}
                        className="rounded-full bg-emerald-500/20 px-3 py-1 text-xs font-semibold text-emerald-200"
                      >
                        Approve
                      </button>
                      <button
                        type="button"
                        onClick={() => handleAction(payment._id, "reject")}
                        className="rounded-full bg-rose-500/20 px-3 py-1 text-xs font-semibold text-rose-200"
                      >
                        Reject
                      </button>
                    </div>
                  ) : (
                    <span className="text-xs text-slate-400">Reviewed</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-6 rounded-[1.5rem] border border-white/10 bg-black/20 p-4">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <div className="text-sm font-semibold text-white">Free plan usage</div>
            <div className="text-xs text-slate-300">These device IDs have already used the free scan.</div>
          </div>
          <div className="text-xs text-slate-400">{freeUsages.length} device(s)</div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-[640px] divide-y divide-white/10 text-left text-sm text-slate-200">
            <thead className="bg-black/20">
              <tr>
                <th className="px-4 py-3">#</th>
                <th className="px-4 py-3">Device ID</th>
                <th className="px-4 py-3">Used At</th>
                <th className="px-4 py-3">IP</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/10">
              {freeUsages.map((usage, index) => (
                <tr key={usage._id || usage.deviceId || index}>
                  <td className="px-4 py-3 text-slate-400">{String(index + 1).padStart(2, "0")}</td>
                  <td className="px-4 py-3 font-mono text-xs">{usage.deviceId}</td>
                  <td className="px-4 py-3">{usage.usedAt ? new Date(usage.usedAt).toLocaleString() : "N/A"}</td>
                  <td className="px-4 py-3 font-mono text-xs">{usage.ip || "N/A"}</td>
                </tr>
              ))}
              {!freeUsages.length ? (
                <tr>
                  <td className="px-4 py-3 text-slate-400" colSpan={4}>
                    No free-plan usage recorded yet.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>

      {loading ? <div className="mt-4 text-sm text-slate-300">Loading payments...</div> : null}
    </section>
  );
}

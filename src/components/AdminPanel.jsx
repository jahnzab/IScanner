import { useEffect, useState } from "react";
import { api } from "../lib/api";
import { STORAGE_KEYS } from "../lib/storage";

export function AdminPanel({ onBack }) {
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState("");
  const [payments, setPayments] = useState([]);
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
    <section className="mx-auto max-w-6xl rounded-[2rem] border border-white/10 bg-white/5 p-6">
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

      <div className="mt-6 overflow-hidden rounded-[1.5rem] border border-white/10">
        <table className="min-w-full divide-y divide-white/10 text-left text-sm text-slate-200">
          <thead className="bg-black/20">
            <tr>
              <th className="px-4 py-3">UTR</th>
              <th className="px-4 py-3">Email</th>
              <th className="px-4 py-3">Plan</th>
              <th className="px-4 py-3">Amount</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/10 bg-white/5">
            {payments.map((payment) => (
              <tr key={payment._id}>
                <td className="px-4 py-3 font-mono text-xs">{payment.utr}</td>
                <td className="px-4 py-3">{payment.email}</td>
                <td className="px-4 py-3">{payment.plan}</td>
                <td className="px-4 py-3">₹{payment.amount}</td>
                <td className="px-4 py-3">{payment.status}</td>
                <td className="px-4 py-3">
                  {payment.status === "pending" ? (
                    <div className="flex gap-2">
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

      {loading ? <div className="mt-4 text-sm text-slate-300">Loading payments...</div> : null}
    </section>
  );
}

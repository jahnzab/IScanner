const API_BASE = import.meta.env.VITE_API_URL || "https://iscanner-back.onrender.com/api";

async function request(path, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {})
    },
    ...options
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.message || "Request failed");
  }

  return data;
}

export const api = {
  getPublicConfig: () => request("/public/config"),
  checkFreeUsage: (deviceId) =>
    request("/free-usage/check", {
      method: "POST",
      body: JSON.stringify({ deviceId })
    }),
  claimFreeUsage: (deviceId) =>
    request("/free-usage/claim", {
      method: "POST",
      body: JSON.stringify({ deviceId })
    }),
  initiatePayment: (payload) =>
    request("/payments/initiate", {
      method: "POST",
      body: JSON.stringify(payload)
    }),
  validateAccess: (token) =>
    request("/access/validate", {
      method: "POST",
      body: JSON.stringify({ token })
    }),
  recoverAccess: (email) =>
    request("/access/recover", {
      method: "POST",
      body: JSON.stringify({ email })
    }),
  adminLogin: (password) =>
    request("/admin/login", {
      method: "POST",
      body: JSON.stringify({ password })
    }),
  getPayments: (token) =>
    request("/admin/payments", {
      headers: { Authorization: `Bearer ${token}` }
    }),
  approvePayment: (token, paymentId) =>
    request(`/admin/payments/${paymentId}/approve`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` }
    }),
  rejectPayment: (token, paymentId, reason) =>
    request(`/admin/payments/${paymentId}/reject`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify({ reason })
    })
};

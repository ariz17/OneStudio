const API_BASE = (import.meta.env?.VITE_API_URL || "http://localhost:5000");

export async function apiRequest(
  endpoint,
  data,
  method = "POST"
) {
  const res = await fetch(`${API_BASE}${endpoint}`, {
    method,
    headers: {
      "Content-Type": "application/json",
    },
    credentials: "include",
    body: method === "GET" ? undefined : JSON.stringify(data),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || "Request failed");
  }

  return res.json();
}

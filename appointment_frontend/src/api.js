const API_BASE = process.env.REACT_APP_API_BASE_URL || 'http://localhost:3001';

function getToken() {
  return localStorage.getItem('auth_token');
}

// PUBLIC_INTERFACE
export function setToken(token) {
  /** Store JWT token for subsequent API requests. */
  if (!token) localStorage.removeItem('auth_token');
  else localStorage.setItem('auth_token', token);
}

async function request(path, { method = 'GET', body, auth = true } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (auth) {
    const token = getToken();
    if (token) headers.Authorization = `Bearer ${token}`;
  }

  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  const contentType = res.headers.get('content-type') || '';
  const data = contentType.includes('application/json') ? await res.json() : await res.text();

  if (!res.ok) {
    const message = data?.detail || data?.error || (typeof data === 'string' ? data : 'Request failed');
    throw new Error(message);
  }
  return data;
}

// PUBLIC_INTERFACE
export const api = {
  /** Auth */
  register: (payload) => request('/auth/register', { method: 'POST', body: payload, auth: false }),
  login: (payload) => request('/auth/login', { method: 'POST', body: payload, auth: false }),
  me: () => request('/me', { method: 'GET' }),

  /** Appointments */
  createAppointment: (payload) => request('/appointments', { method: 'POST', body: payload }),
  listAppointments: () => request('/appointments', { method: 'GET' }),
  rescheduleAppointment: (id, payload) => request(`/appointments/${id}/reschedule`, { method: 'PATCH', body: payload }),
  cancelAppointment: (id) => request(`/appointments/${id}/cancel`, { method: 'PATCH' }),

  /** Availability (admin) */
  upsertAvailability: (payload) => request('/admin/availability', { method: 'POST', body: payload }),
  listAvailability: () => request('/admin/availability', { method: 'GET' }),
  deleteAvailability: (id) => request(`/admin/availability/${id}`, { method: 'DELETE' }),
};

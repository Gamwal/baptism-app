const BASE = '/api';

function authHeaders() {
  const token = localStorage.getItem('token');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function request(path, options = {}) {
  const res = await fetch(`${BASE}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...authHeaders(),
      ...options.headers,
    },
    ...options,
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    const msg = data.error || `Request failed (${res.status})`;
    throw new Error(msg);
  }

  return data;
}

// ── Auth ──────────────────────────────────────────────────────────────────────
export const login = (email, password) =>
  request('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) });

export const getMe = () => request('/auth/me');

// ── Registrations ─────────────────────────────────────────────────────────────
export const registerCandidate = (data) =>
  request('/registrations', { method: 'POST', body: JSON.stringify(data) });

export const getRegistrations = (params = {}) => {
  const qs = new URLSearchParams(
    Object.fromEntries(Object.entries(params).filter(([, v]) => v != null && v !== ''))
  ).toString();
  return request(`/registrations${qs ? `?${qs}` : ''}`);
};

export const getRegistration = (id) => request(`/registrations/${id}`);

// ── Interviews ────────────────────────────────────────────────────────────────
export const getStats = () => request('/interviews/stats');

export const addComment = (registrationId, comment) =>
  request(`/interviews/${registrationId}/comments`, {
    method: 'POST',
    body: JSON.stringify({ comment }),
  });

export const certifyCandidate = (registrationId, comment) =>
  request(`/interviews/${registrationId}/certify`, {
    method: 'PATCH',
    body: JSON.stringify({ comment }),
  });

export const declineCandidate = (registrationId, comment) =>
  request(`/interviews/${registrationId}/decline`, {
    method: 'PATCH',
    body: JSON.stringify({ comment }),
  });

// ── Interviewers (admin only) ─────────────────────────────────────────────────
export const getInterviewers = () => request('/interviewers');

export const createInterviewer = (data) =>
  request('/interviewers', { method: 'POST', body: JSON.stringify(data) });

export const deleteInterviewer = (id) =>
  request(`/interviewers/${id}`, { method: 'DELETE' });

// ── Church directory (public; cascading dropdowns) ──────────────────────────
export const getAreas = () => request('/church/areas');

export const getZones = (areaId) =>
  request(`/church/zones?areaId=${encodeURIComponent(areaId)}`);

export const getBranches = (zoneId, areaId) =>
  request(`/church/branches?zoneId=${encodeURIComponent(zoneId)}&areaId=${encodeURIComponent(areaId || '')}`);

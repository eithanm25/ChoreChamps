import axios from 'axios';

export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000';

// No default Content-Type header here on purpose: axios already sets
// 'application/json' automatically for plain-object payloads (every JSON POST/PUT
// in this app), but a pre-set instance-level Content-Type is not reliably cleared
// by axios's FormData auto-detection — it can leak through and mislabel a
// multipart photo upload as JSON, which silently drops the files before they
// ever reach the server (multer then sees zero files and 400s).
const api = axios.create({
  baseURL: API_BASE_URL,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token && config.headers) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

/**
 * A 401 from any authenticated route means the stored session is dead — the
 * user was deleted, the DB was reset, or the token expired. Without this, the
 * app kept rendering the dashboard shell from stale localStorage forever,
 * showing an empty page instead of returning to login.
 *
 * The /api/auth/* endpoints are excluded: a 401 there is just "wrong password"
 * on an unauthenticated request, and must not wipe out the login form's own
 * error message or force a reload mid-attempt.
 */
api.interceptors.response.use(
  (response) => response,
  (error: unknown) => {
    const isAuthEndpoint = axios.isAxiosError(error) && error.config?.url?.includes('/api/auth/');
    if (axios.isAxiosError(error) && error.response?.status === 401 && !isAuthEndpoint) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      if (window.location.pathname !== '/') {
        window.location.assign('/');
      }
    }
    return Promise.reject(error);
  },
);

/** Proof photos come back from the server as '/uploads/<file>' — resolve against the API host. */
export function resolvePhotoUrl(url: string): string {
  if (/^https?:\/\//i.test(url)) {
    return url;
  }
  return `${API_BASE_URL}${url.startsWith('/') ? url : `/${url}`}`;
}

export default api;

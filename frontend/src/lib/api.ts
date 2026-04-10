function resolveDefaultApiBaseUrl(): string {
  if (typeof window !== 'undefined') {
    const { protocol, hostname } = window.location;
    return `${protocol}//${hostname}:5000`;
  }

  return 'http://127.0.0.1:5000';
}

export const API_BASE_URL =
  (import.meta.env.VITE_API_BASE_URL || '').trim() || resolveDefaultApiBaseUrl();

export function authHeader(): HeadersInit {
  const token = localStorage.getItem('access_token');
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

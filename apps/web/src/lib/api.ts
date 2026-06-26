import axios, { AxiosError } from "axios";

const TOKEN_KEY = "cobranza_access_token";
const USER_KEY = "cobranza_usuario";

export const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000",
  timeout: 10000,
});

export function getStoredToken() {
  if (typeof window === "undefined") {
    return null;
  }

  return localStorage.getItem(TOKEN_KEY);
}

export function setStoredSession(token: string, usuario?: unknown) {
  if (typeof window === "undefined") {
    return;
  }

  localStorage.setItem(TOKEN_KEY, token);

  if (usuario) {
    localStorage.setItem(USER_KEY, JSON.stringify(usuario));
  }
}

export function clearStoredSession() {
  if (typeof window === "undefined") {
    return;
  }

  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

api.interceptors.request.use((config) => {
  const token = getStoredToken();

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error: AxiosError<{ message?: string | string[] }>) => {
    if (error.response?.status === 401 && typeof window !== "undefined") {
      clearStoredSession();

      if (window.location.pathname !== "/login") {
        window.location.href = "/login";
      }
    }

    const message = error.response?.data?.message;
    const normalizedMessage = Array.isArray(message)
      ? message.join(", ")
      : message;

    return Promise.reject(
      new Error(normalizedMessage || "No se pudo conectar con el API"),
    );
  },
);

export function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Ocurrio un error inesperado";
}

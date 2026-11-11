import axios from "axios";

const normalizeBaseUrl = (value?: string) => {
  const base = (value || "http://localhost:8000/api").trim().replace(/\/+$/, "");
  return base;
};

export const api = axios.create({
  baseURL: normalizeBaseUrl(import.meta.env.VITE_API_BASE_URL as string | undefined),
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("aegis_jwt");
  if (token) {
    config.headers = config.headers ?? {};
    (config.headers as Record<string, string>).Authorization = `Bearer ${token}`;
  }
  return config;
});

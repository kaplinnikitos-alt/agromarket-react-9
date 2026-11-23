// Адрес API — из переменной окружения Vite.
// Локально берётся из .env.development, на хостинге (ЛР9) — из настроек сборки
export const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

// Текст ошибки из ответа API. Если сервер прислал details (валидация zod),
// добавляем причины: «Ошибка валидации: Цена должна быть больше 0; Некорректный e-mail»
export function formatApiError(data, status) {
  const base = data?.error || `Ошибка ${status}`;
  const details = Array.isArray(data?.details) ? data.details : [];
  if (details.length === 0) return base;
  return `${base}: ${details.map((d) => d.message).join('; ')}`;
}

// Обёртка над fetch: добавляет токен, разбирает JSON и превращает ошибки API в исключения
export async function apiFetch(path, options = {}) {
  const token = localStorage.getItem('token');

  const headers = { 'Content-Type': 'application/json', ...options.headers };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const res = await fetch(`${API_URL}${path}`, { ...options, headers });
  const data = res.status === 204 ? null : await res.json().catch(() => null);

  // Токен был, но сервер его не принял (истёк / подделан) — выходим из аккаунта
  if (res.status === 401 && token) {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.reload();
  }

  if (!res.ok) {
    // 400 (валидация), 401, 403, 429 (слишком много попыток) — показываем текст сервера
    const error = new Error(formatApiError(data, res.status));
    error.status = res.status;
    error.details = Array.isArray(data?.details) ? data.details : [];
    throw error;
  }
  return data;
}

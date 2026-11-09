import { vi } from 'vitest';

// Помощники для подмены fetch. Подменяем «сервер» целиком: тест сам решает,
// что ответит каждый адрес, и сеть вообще не используется.

class Reply {
  constructor(status, body) {
    this.status = status;
    this.body = body;
  }
}

// reply(401, { error: '...' }) — ответ с нужным статусом
export const reply = (status, body = null) => new Reply(status, body);
// сеть недоступна: fetch отклоняется, как при выключенном сервере
export const NETWORK_ERROR = Symbol('network error');
// запрос «завис» и не заканчивается — чтобы проверить состояние загрузки
export const NEVER = Symbol('never');

function toResponse({ status, body }) {
  if (status === 204 || body === null) return new Response(null, { status });
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

/**
 * Подменяет globalThis.fetch. routes — объект вида
 *   { 'GET /products': [...], 'POST /auth/login': reply(401, { error: '...' }) }
 * Значение: тело ответа (статус 200), reply(...), NETWORK_ERROR, NEVER или функция (url, options) => любое из этого.
 * Запрос на адрес, которого нет в routes, роняет тест: так видно, что компонент сходил «не туда».
 * Вызывать ДО render — иначе компонент успеет сходить на настоящий сервер.
 */
export function mockApi(routes = {}) {
  return vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, options = {}) => {
    const method = (options.method || 'GET').toUpperCase();
    const path = new URL(String(input)).pathname.replace(/^\/api/, '');
    const key = `${method} ${path}`;

    if (!(key in routes)) {
      throw new Error(`mockApi: нет подмены для «${key}»`);
    }
    let result = routes[key];
    if (typeof result === 'function') result = result(String(input), options);

    if (result === NETWORK_ERROR) throw new TypeError('Failed to fetch');
    if (result === NEVER) return new Promise(() => {});
    if (result instanceof Reply) return toResponse(result);
    return toResponse({ status: 200, body: result });
  });
}

// Вызовы fetch к конкретному адресу: [[url, options], ...]
export function callsTo(spy, method, path) {
  return spy.mock.calls.filter(([url, options = {}]) => {
    const m = (options.method || 'GET').toUpperCase();
    return m === method && new URL(String(url)).pathname.replace(/^\/api/, '') === path;
  });
}

// Тело запроса как объект
export const bodyOf = (call) => JSON.parse(call[1].body);

// window.location.reload в jsdom не работает — подменяем и возвращаем «шпиона»
export function mockReload() {
  const reload = vi.fn();
  vi.stubGlobal('location', { ...window.location, reload });
  return reload;
}

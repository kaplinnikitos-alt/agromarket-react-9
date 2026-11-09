import { describe, test, expect } from 'vitest';
import { API_URL, apiFetch } from './api';
import { mockApi, mockReload, reply, callsTo } from './test/mockApi';

describe('apiFetch', () => {
  test('идёт на API_URL + путь и возвращает разобранный JSON', async () => {
    const spy = mockApi({ 'GET /products': [{ id: 1 }] });

    const data = await apiFetch('/products');

    expect(data).toEqual([{ id: 1 }]);
    expect(String(spy.mock.calls[0][0])).toBe(`${API_URL}/products`);
  });

  test('с токеном в localStorage добавляет Authorization: Bearer', async () => {
    localStorage.setItem('token', 'test-token');
    const spy = mockApi({ 'GET /auth/me': { id: 1 } });

    await apiFetch('/auth/me');

    const [, options] = spy.mock.calls[0];
    expect(options.headers.Authorization).toBe('Bearer test-token');
    expect(options.headers['Content-Type']).toBe('application/json');
  });

  test('без токена заголовка Authorization нет', async () => {
    const spy = mockApi({ 'GET /products': [] });

    await apiFetch('/products');

    expect(spy.mock.calls[0][1].headers).not.toHaveProperty('Authorization');
  });

  test('свои заголовки и метод сохраняются', async () => {
    const spy = mockApi({ 'POST /orders': reply(201, { id: 1 }) });

    await apiFetch('/orders', { method: 'POST', headers: { 'X-Test': '1' }, body: '{}' });

    const [call] = callsTo(spy, 'POST', '/orders');
    expect(call[1].headers['X-Test']).toBe('1');
    expect(call[1].headers['Content-Type']).toBe('application/json');
  });

  test('статус 204 даёт null и не пытается разобрать тело', async () => {
    mockApi({ 'DELETE /products/1': reply(204) });

    await expect(apiFetch('/products/1', { method: 'DELETE' })).resolves.toBeNull();
  });

  test('ошибка API превращается в исключение с текстом сервера', async () => {
    mockApi({ 'POST /products': reply(400, { error: 'Поле name обязательно' }) });

    await expect(apiFetch('/products', { method: 'POST' })).rejects.toThrow('Поле name обязательно');
  });

  test('если в ответе нет поля error, сообщение — «Ошибка <статус>»', async () => {
    mockApi({ 'GET /x': reply(500, {}) });

    await expect(apiFetch('/x')).rejects.toThrow('Ошибка 500');
  });

  test('401 при сохранённом токене: токен и пользователь удаляются, страница перезагружается', async () => {
    localStorage.setItem('token', 'expired');
    localStorage.setItem('user', '{"name":"Анна"}');
    const reload = mockReload();
    mockApi({ 'GET /auth/me': reply(401, { error: 'Срок действия токена истёк, войдите снова' }) });

    await expect(apiFetch('/auth/me')).rejects.toThrow('Срок действия токена истёк');

    expect(localStorage.getItem('token')).toBeNull();
    expect(localStorage.getItem('user')).toBeNull();
    expect(reload).toHaveBeenCalledTimes(1);
  });

  test('401 без токена (неверный пароль при входе): перезагрузки нет', async () => {
    const reload = mockReload();
    mockApi({ 'POST /auth/login': reply(401, { error: 'Неверный email или пароль' }) });

    await expect(apiFetch('/auth/login', { method: 'POST' })).rejects.toThrow('Неверный email или пароль');

    expect(reload).not.toHaveBeenCalled();
  });
});

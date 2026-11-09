import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, test, expect, vi } from 'vitest';
import AddProductForm from './AddProductForm';
import { mockApi, reply, callsTo, bodyOf } from '../test/mockApi';

const created = { id: 11, name: 'Сметана', category: 'Молочное', price: 750, unit: 'кг' };

async function fillForm(user) {
  await user.type(screen.getByLabelText('Название'), 'Сметана');
  await user.type(screen.getByLabelText('Категория'), 'Молочное');
  await user.type(screen.getByLabelText(/цена/i), '750');
}

describe('AddProductForm (запросы с токеном)', () => {
  test('отправляет POST /products с заголовком Authorization: Bearer <токен>', async () => {
    localStorage.setItem('token', 'test-token');
    const user = userEvent.setup();
    const spy = mockApi({ 'POST /products': reply(201, created) });
    render(<AddProductForm onAdded={vi.fn()} />);

    await fillForm(user);
    await user.click(screen.getByRole('button', { name: 'Добавить' }));

    const [call] = callsTo(spy, 'POST', '/products');
    expect(call[1].headers.Authorization).toBe('Bearer test-token');
    expect(call[1].headers['Content-Type']).toBe('application/json');
  });

  test('цена уходит на сервер числом, а не строкой; единица по умолчанию «кг»', async () => {
    localStorage.setItem('token', 'test-token');
    const user = userEvent.setup();
    const spy = mockApi({ 'POST /products': reply(201, created) });
    render(<AddProductForm onAdded={vi.fn()} />);

    await fillForm(user);
    await user.click(screen.getByRole('button', { name: 'Добавить' }));

    const [call] = callsTo(spy, 'POST', '/products');
    expect(bodyOf(call)).toEqual({ name: 'Сметана', category: 'Молочное', price: 750, unit: 'кг' });
  });

  test('после успеха вызывает onAdded с созданным товаром и очищает форму', async () => {
    localStorage.setItem('token', 'test-token');
    const user = userEvent.setup();
    mockApi({ 'POST /products': reply(201, created) });
    const onAdded = vi.fn();
    render(<AddProductForm onAdded={onAdded} />);

    await fillForm(user);
    await user.click(screen.getByRole('button', { name: 'Добавить' }));

    expect(onAdded).toHaveBeenCalledWith(created);
    expect(screen.getByLabelText('Название')).toHaveValue('');
  });

  test('без токена заголовка Authorization нет', async () => {
    const user = userEvent.setup();
    const spy = mockApi({ 'POST /products': reply(401, { error: 'Требуется вход в систему' }) });
    render(<AddProductForm onAdded={vi.fn()} />);

    await fillForm(user);
    await user.click(screen.getByRole('button', { name: 'Добавить' }));

    const [call] = callsTo(spy, 'POST', '/products');
    expect(call[1].headers).not.toHaveProperty('Authorization');
    expect(await screen.findByText('Требуется вход в систему')).toBeInTheDocument();
  });

  test('403 (не админ): показывает ошибку, onAdded не вызван, введённое не стирается', async () => {
    localStorage.setItem('token', 'user-token');
    const user = userEvent.setup();
    mockApi({ 'POST /products': reply(403, { error: 'Недостаточно прав' }) });
    const onAdded = vi.fn();
    render(<AddProductForm onAdded={onAdded} />);

    await fillForm(user);
    await user.click(screen.getByRole('button', { name: 'Добавить' }));

    expect(await screen.findByText('Недостаточно прав')).toBeInTheDocument();
    expect(onAdded).not.toHaveBeenCalled();
    expect(screen.getByLabelText('Название')).toHaveValue('Сметана');
  });

  test('с пустым названием и ценой форма не отправляется', async () => {
    const user = userEvent.setup();
    const spy = mockApi({});
    render(<AddProductForm onAdded={vi.fn()} />);

    await user.click(screen.getByRole('button', { name: 'Добавить' }));

    expect(spy).not.toHaveBeenCalled();
  });
});

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, test, expect, vi } from 'vitest';
import LoginForm from './LoginForm';
import { mockApi, reply, callsTo, bodyOf, NETWORK_ERROR, NEVER } from '../test/mockApi';

const loginAnswer = {
  user: { id: 5, name: 'Анна', email: 'anna@agromarket.kz', role: 'user' },
  token: 'jwt-token',
};

async function fillAndSubmit(user, email, password) {
  await user.type(screen.getByLabelText(/email/i), email);
  await user.type(screen.getByLabelText(/пароль/i), password);
  await user.click(screen.getByRole('button', { name: /войти/i }));
}

describe('LoginForm — вход', () => {
  test('по умолчанию это форма входа без поля «Имя»', () => {
    render(<LoginForm onLogin={vi.fn()} />);
    expect(screen.getByRole('heading', { name: 'Вход' })).toBeInTheDocument();
    expect(screen.queryByLabelText('Имя')).not.toBeInTheDocument();
  });

  test('отправляет e-mail и пароль на /auth/login и передаёт пользователя и токен', async () => {
    const user = userEvent.setup();
    const spy = mockApi({ 'POST /auth/login': loginAnswer });
    const onLogin = vi.fn();
    render(<LoginForm onLogin={onLogin} />);

    await fillAndSubmit(user, 'anna@agromarket.kz', 'secret123');

    expect(onLogin).toHaveBeenCalledWith(loginAnswer.user, 'jwt-token');
    const [call] = callsTo(spy, 'POST', '/auth/login');
    expect(bodyOf(call)).toEqual({ email: 'anna@agromarket.kz', password: 'secret123' });
  });

  test('неверный пароль (401): показывает ошибку сервера, onLogin не вызван', async () => {
    const user = userEvent.setup();
    mockApi({ 'POST /auth/login': reply(401, { error: 'Неверный email или пароль' }) });
    const onLogin = vi.fn();
    render(<LoginForm onLogin={onLogin} />);

    await fillAndSubmit(user, 'anna@agromarket.kz', 'wrong-password');

    expect(await screen.findByText('Неверный email или пароль')).toBeInTheDocument();
    expect(onLogin).not.toHaveBeenCalled();
    // кнопка снова доступна — можно попробовать ещё раз
    expect(screen.getByRole('button', { name: /войти/i })).toBeEnabled();
  });

  test('лимит попыток (429): показывает сообщение сервера', async () => {
    const user = userEvent.setup();
    mockApi({
      'POST /auth/login': reply(429, { error: 'Слишком много попыток входа. Попробуйте через 15 минут' }),
    });
    render(<LoginForm onLogin={vi.fn()} />);

    await fillAndSubmit(user, 'anna@agromarket.kz', 'whatever123');

    expect(await screen.findByText(/слишком много попыток/i)).toBeInTheDocument();
  });

  test('сервер недоступен: показывает ошибку сети', async () => {
    const user = userEvent.setup();
    mockApi({ 'POST /auth/login': NETWORK_ERROR });
    render(<LoginForm onLogin={vi.fn()} />);

    await fillAndSubmit(user, 'anna@agromarket.kz', 'secret123');

    expect(await screen.findByText('Failed to fetch')).toBeInTheDocument();
  });

  test('пока идёт запрос, кнопка заблокирована и написано «Подождите…»', async () => {
    const user = userEvent.setup();
    mockApi({ 'POST /auth/login': NEVER });
    render(<LoginForm onLogin={vi.fn()} />);

    await fillAndSubmit(user, 'anna@agromarket.kz', 'secret123');

    expect(await screen.findByRole('button', { name: /подождите/i })).toBeDisabled();
  });

  test('с пустыми полями форма не отправляется', async () => {
    const user = userEvent.setup();
    const spy = mockApi({});
    const onLogin = vi.fn();
    render(<LoginForm onLogin={onLogin} />);

    await user.click(screen.getByRole('button', { name: /войти/i }));

    // браузерная валидация (required) не даёт отправить пустую форму
    expect(spy).not.toHaveBeenCalled();
    expect(onLogin).not.toHaveBeenCalled();
  });

  test('e-mail без «@» не отправляется', async () => {
    const user = userEvent.setup();
    const spy = mockApi({});
    render(<LoginForm onLogin={vi.fn()} />);

    await fillAndSubmit(user, 'anna-without-at', 'secret123');

    expect(screen.getByLabelText(/email/i)).toBeInvalid();
    expect(spy).not.toHaveBeenCalled();
  });
});

describe('LoginForm — регистрация', () => {
  test('кнопка переключает форму в режим регистрации и обратно', async () => {
    const user = userEvent.setup();
    render(<LoginForm onLogin={vi.fn()} />);

    await user.click(screen.getByRole('button', { name: /нет аккаунта/i }));
    expect(screen.getByRole('heading', { name: 'Регистрация' })).toBeInTheDocument();
    expect(screen.getByLabelText('Имя')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Зарегистрироваться' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /уже есть аккаунт/i }));
    expect(screen.getByRole('heading', { name: 'Вход' })).toBeInTheDocument();
    expect(screen.queryByLabelText('Имя')).not.toBeInTheDocument();
  });

  test('регистрация отправляет имя, e-mail и пароль на /auth/register', async () => {
    const user = userEvent.setup();
    const spy = mockApi({ 'POST /auth/register': { ...loginAnswer, user: { ...loginAnswer.user, name: 'Борис' } } });
    const onLogin = vi.fn();
    render(<LoginForm onLogin={onLogin} />);

    await user.click(screen.getByRole('button', { name: /нет аккаунта/i }));
    await user.type(screen.getByLabelText('Имя'), 'Борис');
    await user.type(screen.getByLabelText(/email/i), 'boris@agromarket.kz');
    await user.type(screen.getByLabelText(/пароль/i), 'secret123');
    await user.click(screen.getByRole('button', { name: 'Зарегистрироваться' }));

    const [call] = callsTo(spy, 'POST', '/auth/register');
    expect(bodyOf(call)).toEqual({ name: 'Борис', email: 'boris@agromarket.kz', password: 'secret123' });
    expect(onLogin).toHaveBeenCalledWith(expect.objectContaining({ name: 'Борис' }), 'jwt-token');
  });

  test('e-mail уже занят (409/400): показывает ошибку сервера', async () => {
    const user = userEvent.setup();
    mockApi({ 'POST /auth/register': reply(409, { error: 'Пользователь с таким email уже есть' }) });
    render(<LoginForm onLogin={vi.fn()} />);

    await user.click(screen.getByRole('button', { name: /нет аккаунта/i }));
    await user.type(screen.getByLabelText('Имя'), 'Борис');
    await user.type(screen.getByLabelText(/email/i), 'boris@agromarket.kz');
    await user.type(screen.getByLabelText(/пароль/i), 'secret123');
    await user.click(screen.getByRole('button', { name: 'Зарегистрироваться' }));

    expect(await screen.findByText('Пользователь с таким email уже есть')).toBeInTheDocument();
  });
});

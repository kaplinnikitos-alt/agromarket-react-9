import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, test, expect, vi } from 'vitest';
import ContactForm from './ContactForm';
import { mockApi, reply, callsTo, bodyOf, NETWORK_ERROR, NEVER } from '../test/mockApi';

async function fillOrder(user, { quantity = '50' } = {}) {
  await user.type(screen.getByLabelText(/имя/i), 'КХ «Береке»');
  await user.type(screen.getByLabelText('Email'), 'bereke@mail.kz');
  await user.type(screen.getByLabelText(/объ[её]м/i), quantity);
}

const submit = () => screen.getByRole('button', { name: /отправить заявку/i });

describe('ContactForm (оптовая заявка)', () => {
  test('у всех полей есть подписи (label)', () => {
    render(<ContactForm />);
    for (const label of [/имя/i, 'Email', /телефон/i, /объ[её]м/i, /дата/i, /комментарий/i]) {
      expect(screen.getByLabelText(label)).toBeInTheDocument();
    }
  });

  test('успешная заявка: POST /orders, сообщение с номером и очистка формы', async () => {
    const user = userEvent.setup();
    const spy = mockApi({ 'POST /orders': reply(201, { id: 7 }) });
    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});
    render(<ContactForm />);

    await fillOrder(user);
    await user.click(submit());

    expect(alertSpy).toHaveBeenCalledWith('Заявка №7 принята!');
    const [call] = callsTo(spy, 'POST', '/orders');
    expect(bodyOf(call)).toMatchObject({ name: 'КХ «Береке»', email: 'bereke@mail.kz', quantity: '50' });
    expect(screen.getByLabelText(/имя/i)).toHaveValue('');
  });

  test('сервер вернул 400: показывает его сообщение, форма не очищается', async () => {
    const user = userEvent.setup();
    mockApi({ 'POST /orders': reply(400, { error: 'Минимальный объём заказа — 10 кг' }) });
    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});
    render(<ContactForm />);

    await fillOrder(user);
    await user.click(submit());

    expect(alertSpy).toHaveBeenCalledWith('Ошибка: Минимальный объём заказа — 10 кг');
    expect(screen.getByLabelText(/имя/i)).toHaveValue('КХ «Береке»');
  });

  test('сервер недоступен: подсказывает подождать', async () => {
    const user = userEvent.setup();
    mockApi({ 'POST /orders': NETWORK_ERROR });
    vi.spyOn(console, 'error').mockImplementation(() => {}); // компонент пишет ошибку в консоль
    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});
    render(<ContactForm />);

    await fillOrder(user);
    await user.click(submit());

    expect(alertSpy).toHaveBeenCalledWith(expect.stringMatching(/сервер недоступен/i));
    // после ошибки кнопка снова доступна
    expect(submit()).toBeEnabled();
  });

  test('пока заявка отправляется, кнопка заблокирована («Отправка…»)', async () => {
    const user = userEvent.setup();
    mockApi({ 'POST /orders': NEVER });
    render(<ContactForm />);

    await fillOrder(user);
    await user.click(submit());

    expect(await screen.findByRole('button', { name: /отправка/i })).toBeDisabled();
  });

  test('объём меньше 10 кг не отправляется', async () => {
    const user = userEvent.setup();
    const spy = mockApi({});
    render(<ContactForm />);

    await fillOrder(user, { quantity: '5' });
    await user.click(submit());

    expect(screen.getByLabelText(/объ[её]м/i)).toBeInvalid();
    expect(spy).not.toHaveBeenCalled();
  });

  test('пустая форма не отправляется', async () => {
    const user = userEvent.setup();
    const spy = mockApi({});
    render(<ContactForm />);

    await user.click(submit());

    expect(spy).not.toHaveBeenCalled();
  });
});

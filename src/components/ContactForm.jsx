import { useState } from 'react';
import { API_URL } from '../api.js';

function ContactForm() {
  const [sending, setSending] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault(); // не перезагружать страницу
    const form = e.target;

    // Собираем все поля формы в объект { name: ..., email: ..., ... }
    const data = Object.fromEntries(new FormData(form));

    setSending(true);
    try {
      const res = await fetch(`${API_URL}/orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      const result = await res.json();

      if (!res.ok) { // статус не 2xx (например, 400)
        alert('Ошибка: ' + result.error);
        return;
      }

      alert(`Заявка №${result.id} принята!`);
      form.reset();
    } catch (err) { // сервер выключен или недоступен
      console.error(err);
      alert('Сервер недоступен или ещё просыпается. Подождите минуту и попробуйте снова.');
    } finally {
      setSending(false);
    }
  }

  return (
    <section id="contact" className="contact">
      <h2>Оптовая заявка</h2>

      <form className="contact-form" onSubmit={handleSubmit}>
        <label htmlFor="name">Имя / организация</label>
        <input id="name" name="name" type="text" required />

        <label htmlFor="email">Email</label>
        <input id="email" name="email" type="email" required
               placeholder="farmer@mail.kz" />

        <label htmlFor="phone">Телефон</label>
        <input id="phone" name="phone" type="tel"
               placeholder="+7 7XX XXX XX XX" />

        <label htmlFor="quantity">Объём заказа, кг</label>
        <input id="quantity" name="quantity" type="number" min="10" required />

        <label htmlFor="date">Желаемая дата доставки</label>
        <input id="date" name="date" type="date" />

        <label htmlFor="comment">Комментарий</label>
        <textarea id="comment" name="comment" rows="4" />

        <button type="submit" disabled={sending}>
          {sending ? 'Отправка…' : 'Отправить заявку'}
        </button>
      </form>
    </section>
  );
}

export default ContactForm;

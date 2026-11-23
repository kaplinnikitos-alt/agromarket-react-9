import { useState } from 'react';
import { apiFetch } from '../api.js';

export default function AddProductForm({ onAdded }) {
  const [error, setError] = useState('');
  const [details, setDetails] = useState([]); // ошибки по полям из ответа сервера (zod)

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setDetails([]);
    const form = e.target;
    const data = Object.fromEntries(new FormData(form));

    try {
      // POST /products с токеном администратора (токен добавляет apiFetch);
      // price из формы — строка, на сервер отправляем числом
      const product = await apiFetch('/products', {
        method: 'POST',
        body: JSON.stringify({ ...data, price: Number(data.price) }),
      });

      onAdded(product); // сообщаем App о новом товаре
      form.reset();
    } catch (err) {
      // при ошибке валидации показываем заголовок и список причин по полям
      setError(err.details?.length ? 'Ошибка валидации' : err.message);
      setDetails(err.details || []);
    }
  }

  return (
    <form className="admin-form" onSubmit={handleSubmit}>
      <h3>Новый товар</h3>
      <label className="sr-only" htmlFor="product-name">Название</label>
      <input id="product-name" name="name" placeholder="Название" required />
      <label className="sr-only" htmlFor="product-category">Категория</label>
      <input id="product-category" name="category" placeholder="Категория" />
      <label className="sr-only" htmlFor="product-price">Цена, ₸</label>
      <input id="product-price" name="price" type="number" min="0" placeholder="Цена, ₸" required />
      <label className="sr-only" htmlFor="product-unit">Единица измерения</label>
      <input id="product-unit" name="unit" placeholder="Единица (кг, л)" defaultValue="кг" />
      {error && <p className="error">{error}</p>}
      {details.length > 0 && (
        <ul className="error">
          {details.map((d) => <li key={d.field + d.message}>{d.message}</li>)}
        </ul>
      )}
      <button type="submit">Добавить</button>
    </form>
  );
}

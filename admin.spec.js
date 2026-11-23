import { test, expect } from '@playwright/test';

// Сценарий администратора. Нужен готовый аккаунт админа (создаётся db:init):
//   E2E_ADMIN_EMAIL, E2E_ADMIN_PASSWORD — задаются в окружении, в код не пишем.
// Запускать только на ЛОКАЛЬНОМ API: тест создаёт и удаляет товар.
// Без переменных тесты пропускаются (CI и продакшен их не запускают).
const email = process.env.E2E_ADMIN_EMAIL;
const password = process.env.E2E_ADMIN_PASSWORD;
const apiUrl = process.env.E2E_API_URL || 'http://localhost:3000/api';

test.describe('администратор', () => {
  test.skip(!email || !password, 'не заданы E2E_ADMIN_EMAIL / E2E_ADMIN_PASSWORD');

  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    const auth = page.locator('.auth-bar');
    await auth.getByLabel('Email').fill(email);
    await auth.getByLabel('Пароль').fill(password);
    await auth.getByRole('button', { name: 'Войти' }).click();
    await expect(auth.getByRole('button', { name: 'Выйти' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Новый товар' })).toBeVisible();
  });

  test('администратор добавляет товар, и он появляется в каталоге', async ({ page }) => {
    const name = `Тестовый мёд ${Date.now()}`;
    const form = page.locator('.admin-form');

    await form.getByLabel('Название').fill(name);
    await form.getByLabel('Категория').fill('Мёд');
    await form.getByLabel(/цена/i).fill('1234');

    const responsePromise = page.waitForResponse(
      (r) => r.url().endsWith('/products') && r.request().method() === 'POST',
    );
    await form.getByRole('button', { name: 'Добавить' }).click();
    const response = await responsePromise;
    expect(response.status()).toBe(201);
    const { id } = await response.json();

    await expect(page.getByTestId('product-card').filter({ hasText: name })).toBeVisible();

    // в интерфейсе кнопки «Удалить» нет — убираем за собой через API
    const token = await page.evaluate(() => localStorage.getItem('token'));
    const del = await page.request.delete(`${apiUrl}/products/${id}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(del.status()).toBe(204);
  });

  test('цена -500: сначала её не пускает браузер, а в обход формы — сервер (zod)', async ({ page }) => {
    const form = page.locator('.admin-form');
    const price = form.getByLabel(/цена/i);

    await form.getByLabel('Название').fill('Товар с плохой ценой');
    await price.fill('-500');

    // 1) защита браузера: у поля min="0", поэтому форма не отправится
    expect(await price.evaluate((el) => el.validity.rangeUnderflow)).toBe(true);

    // 2) «обходим форму»: снимаем min — запрос уходит на сервер, и отвечает уже он
    await price.evaluate((el) => el.removeAttribute('min'));
    await form.getByRole('button', { name: 'Добавить' }).click();

    await expect(form.getByText('Цена должна быть больше 0')).toBeVisible();
  });
});

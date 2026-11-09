import { test, expect } from '@playwright/test';

const password = 'E2e-Test-Password-123';

// Форма входа/регистрации лежит в .auth-bar; поля «Email» есть и в форме заявки,
// поэтому ищем внутри нужного блока
const authBar = (page) => page.locator('.auth-bar');

test.describe('каталог и навигация (гость)', () => {
  test('каталог загружается с сервера', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/АгроМаркет/i);
    await expect(page.getByTestId('product-card').first()).toBeVisible();
    await expect(page.getByText('Загрузка...')).toBeHidden();
  });

  test('прямая ссылка на внутреннюю страницу не даёт 404 (rewrites из vercel.json)', async ({ page }) => {
    for (const path of ['/login', '/admin']) {
      const response = await page.goto(path);
      expect(response.status(), path).toBe(200);
      await expect(page.getByRole('heading', { name: 'Каталог' })).toBeVisible();
    }
  });

  test('поиск оставляет только подходящие товары', async ({ page }) => {
    await page.goto('/');
    const cards = page.getByTestId('product-card');
    await expect(cards.first()).toBeVisible();

    // ищем по названию первого товара — тест не зависит от того, что лежит в базе
    const name = (await cards.first().getByRole('heading').innerText()).trim();
    await page.getByRole('searchbox', { name: /поиск/i }).fill(name);

    await expect(cards.first().getByRole('heading')).toHaveText(name);
    for (const title of await cards.getByRole('heading').allInnerTexts()) {
      expect(title.toLowerCase()).toContain(name.toLowerCase());
    }

    await page.getByRole('searchbox', { name: /поиск/i }).fill('несуществующий-товар-xyz');
    await expect(cards).toHaveCount(0);
  });

  test('«В корзину» увеличивает счётчик в шапке', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByText(/корзина: 0/i)).toBeVisible();

    await page.getByTestId('product-card').first().getByRole('button', { name: /в корзину/i }).click();

    await expect(page.getByText(/корзина: 1/i)).toBeVisible();
  });

  test('гость не видит форму добавления товара', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByTestId('product-card').first()).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Новый товар' })).toHaveCount(0);
    await expect(authBar(page).getByRole('heading', { name: 'Вход' })).toBeVisible();
  });

  test('неверный пароль: показывается ошибка, пользователь остаётся гостем', async ({ page }) => {
    await page.goto('/');
    const auth = authBar(page);
    // адрес случайный, существующих пользователей не трогаем. Не гонять в цикле: лимит 5 неудачных входов / 15 мин
    await auth.getByLabel('Email').fill(`nobody+${Date.now()}@agromarket.test`);
    await auth.getByLabel('Пароль').fill('wrong-password-123');
    await auth.getByRole('button', { name: 'Войти' }).click();

    await expect(auth.getByText('Неверный email или пароль')).toBeVisible();
    await expect(auth.getByRole('button', { name: 'Выйти' })).toHaveCount(0);
  });
});

test.describe('сценарий покупателя: регистрация → заявка → выход', () => {
  // Шаги зависят друг от друга и используют одного пользователя
  test.describe.configure({ mode: 'serial' });

  let email;
  test.beforeAll(() => {
    // каждый запуск (и каждая повторная попытка) — новый покупатель
    email = `e2e+${Date.now()}@agromarket.test`;
  });

  test('покупатель регистрируется и сразу оказывается в системе', async ({ page }) => {
    await page.goto('/');
    const auth = authBar(page);

    await auth.getByRole('button', { name: /нет аккаунта/i }).click();
    await expect(auth.getByRole('heading', { name: 'Регистрация' })).toBeVisible();
    await auth.getByLabel('Имя').fill('E2E Покупатель');
    await auth.getByLabel('Email').fill(email);
    await auth.getByLabel('Пароль').fill(password);
    await auth.getByRole('button', { name: 'Зарегистрироваться' }).click();

    // после регистрации сервер сразу выдаёт токен — вход выполнять не нужно
    await expect(auth.getByText(/вы вошли как/i)).toBeVisible();
    await expect(auth.getByText('E2E Покупатель')).toBeVisible();
    await expect(auth.getByText('(user)')).toBeVisible();
    await expect(auth.getByRole('button', { name: 'Выйти' })).toBeVisible();
    // обычный пользователь формы добавления товара не видит
    await expect(page.getByRole('heading', { name: 'Новый товар' })).toHaveCount(0);
  });

  test('после перезагрузки страницы покупатель остаётся в системе (токен + /auth/me)', async ({ page }) => {
    // входим «по-настоящему»: заново через форму
    await page.goto('/');
    const auth = authBar(page);
    await auth.getByLabel('Email').fill(email);
    await auth.getByLabel('Пароль').fill(password);
    await auth.getByRole('button', { name: 'Войти' }).click();
    await expect(auth.getByText('E2E Покупатель')).toBeVisible();

    await page.reload();

    await expect(authBar(page).getByText('E2E Покупатель')).toBeVisible();
    await expect(page.getByTestId('product-card').first()).toBeVisible();
  });

  test('покупатель оставляет оптовую заявку и получает номер', async ({ page }) => {
    await page.goto('/');
    const form = page.locator('#contact');

    await form.getByLabel(/имя/i).fill('E2E Покупатель');
    await form.getByLabel('Email').fill(email);
    await form.getByLabel(/объ[её]м/i).fill('25');
    await form.getByLabel('Комментарий').fill('Автотест Playwright, заявку можно удалить');

    // форма сообщает результат через alert — перехватываем диалог
    const dialogPromise = page.waitForEvent('dialog');
    await form.getByRole('button', { name: /отправить заявку/i }).click();
    const dialog = await dialogPromise;

    expect(dialog.message()).toMatch(/Заявка №\d+ принята!/);
    await dialog.accept();
    // после успеха форма очищена
    await expect(form.getByLabel(/имя/i)).toHaveValue('');
  });

  test('заявка с объёмом меньше 10 кг не уходит на сервер', async ({ page }) => {
    let orderRequests = 0;
    page.on('request', (r) => { if (r.url().includes('/api/orders') && r.method() === 'POST') orderRequests++; });
    await page.goto('/');
    const form = page.locator('#contact');

    await form.getByLabel(/имя/i).fill('E2E Покупатель');
    await form.getByLabel('Email').fill(email);
    await form.getByLabel(/объ[её]м/i).fill('5');
    await form.getByRole('button', { name: /отправить заявку/i }).click();

    // браузер сам заблокировал отправку: у поля сработала проверка min=10
    const tooSmall = await form.getByLabel(/объ[её]м/i).evaluate((el) => el.validity.rangeUnderflow);
    expect(tooSmall).toBe(true);
    expect(orderRequests).toBe(0);
  });

  test('«Выйти» возвращает форму входа и не пускает обратно без пароля', async ({ page }) => {
    await page.goto('/');
    const auth = authBar(page);
    await auth.getByLabel('Email').fill(email);
    await auth.getByLabel('Пароль').fill(password);
    await auth.getByRole('button', { name: 'Войти' }).click();
    await expect(auth.getByRole('button', { name: 'Выйти' })).toBeVisible();

    await auth.getByRole('button', { name: 'Выйти' }).click();

    await expect(auth.getByRole('heading', { name: 'Вход' })).toBeVisible();
    await page.reload();
    await expect(authBar(page).getByRole('heading', { name: 'Вход' })).toBeVisible();
  });
});

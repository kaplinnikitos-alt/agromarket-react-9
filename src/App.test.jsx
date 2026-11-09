import { render, screen, within, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, test, expect, vi } from 'vitest';
import App from './App';
import { mockApi, mockReload, reply, callsTo, NETWORK_ERROR, NEVER } from './test/mockApi';

const products = [
  { id: 1, name: 'Картофель, 1 кг', price: 350, category: 'Овощи', image: 'a.png' },
  { id: 2, name: 'Мёд натуральный, 1 л', price: 4500, category: 'Мёд', image: 'b.png' },
  { id: 3, name: 'Молоко фермерское, 1 л', price: 600, category: 'Молочное', image: 'c.png' },
];
const categories = [
  { name: 'Овощи', count: 1 },
  { name: 'Мёд', count: 1 },
  { name: 'Молочное', count: 1 },
];
const anna = { id: 5, name: 'Анна', email: 'anna@agromarket.kz', role: 'user' };
const admin = { id: 1, name: 'Администратор', email: 'admin@agromarket.kz', role: 'admin' };

// Каталог с нормальными ответами сервера; routes дополняют или переопределяют
const catalogRoutes = (routes = {}) => ({
  'GET /products': products,
  'GET /categories': categories,
  ...routes,
});

function loginAs(user, token = 'test-token') {
  localStorage.setItem('token', token);
  localStorage.setItem('user', JSON.stringify(user));
}

describe('App — каталог: загрузка / данные / ошибка', () => {
  test('сначала «Загрузка...», потом товары', async () => {
    mockApi(catalogRoutes());
    render(<App />);

    expect(screen.getByText('Загрузка...')).toBeInTheDocument();
    // findBy ждёт, пока «придёт ответ сервера» и React перерисует экран
    expect(await screen.findByText('Картофель, 1 кг')).toBeInTheDocument();
    expect(screen.getByText('Мёд натуральный, 1 л')).toBeInTheDocument();
    expect(screen.getAllByTestId('product-card')).toHaveLength(3);
    expect(screen.queryByText('Загрузка...')).not.toBeInTheDocument();
  });

  test('запрашивает /products и /categories по одному разу', async () => {
    const spy = mockApi(catalogRoutes());
    render(<App />);
    await screen.findByText('Картофель, 1 кг');

    expect(callsTo(spy, 'GET', '/products')).toHaveLength(1);
    expect(callsTo(spy, 'GET', '/categories')).toHaveLength(1);
  });

  test('ошибка сервера (500): сообщение вместо каталога', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    mockApi(catalogRoutes({ 'GET /products': reply(500, { error: 'Внутренняя ошибка сервера' }) }));
    render(<App />);

    expect(await screen.findByText(/не удалось загрузить товары/i)).toBeInTheDocument();
    expect(screen.queryByTestId('product-card')).not.toBeInTheDocument();
    expect(screen.queryByText('Загрузка...')).not.toBeInTheDocument();
  });

  test('сеть недоступна: то же сообщение об ошибке', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    mockApi(catalogRoutes({ 'GET /products': NETWORK_ERROR }));
    render(<App />);

    expect(await screen.findByText(/не удалось загрузить товары/i)).toBeInTheDocument();
  });

  test('сервер вернул []: «Товаров пока нет»', async () => {
    mockApi(catalogRoutes({ 'GET /products': [], 'GET /categories': [] }));
    render(<App />);

    expect(await screen.findByText('Товаров пока нет')).toBeInTheDocument();
    expect(screen.queryByTestId('product-card')).not.toBeInTheDocument();
  });

  test('если сервер «просыпается» дольше 3 секунд, появляется подсказка', async () => {
    vi.useFakeTimers();
    mockApi(catalogRoutes({ 'GET /products': NEVER }));
    render(<App />);

    expect(screen.queryByText(/сервер просыпается/i)).not.toBeInTheDocument();

    await act(async () => { vi.advanceTimersByTime(3000); });

    expect(screen.getByText(/сервер просыпается/i)).toBeInTheDocument();
    expect(screen.getByText('Загрузка...')).toBeInTheDocument();
  });

  test('если /categories не отвечает, каталог всё равно работает без фильтров', async () => {
    mockApi(catalogRoutes({ 'GET /categories': NETWORK_ERROR }));
    render(<App />);

    expect(await screen.findByText('Картофель, 1 кг')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Все' })).not.toBeInTheDocument();
  });
});

describe('App — поиск, фильтры, корзина', () => {
  test('поиск фильтрует товары без учёта регистра', async () => {
    const user = userEvent.setup();
    mockApi(catalogRoutes());
    render(<App />);
    await screen.findByText('Картофель, 1 кг');

    await user.type(screen.getByRole('searchbox', { name: /поиск/i }), 'МОЛОК');

    expect(screen.getAllByTestId('product-card')).toHaveLength(1);
    expect(screen.getByText('Молоко фермерское, 1 л')).toBeInTheDocument();
    expect(screen.queryByText('Картофель, 1 кг')).not.toBeInTheDocument();
  });

  test('поиск без совпадений: «Ничего не найдено»', async () => {
    const user = userEvent.setup();
    mockApi(catalogRoutes());
    render(<App />);
    await screen.findByText('Картофель, 1 кг');

    await user.type(screen.getByRole('searchbox', { name: /поиск/i }), 'ананас');

    expect(screen.getByText('Ничего не найдено')).toBeInTheDocument();
    expect(screen.queryByTestId('product-card')).not.toBeInTheDocument();
  });

  test('кнопки категорий показывают количество и фильтруют каталог', async () => {
    const user = userEvent.setup();
    mockApi(catalogRoutes());
    render(<App />);
    await screen.findByText('Картофель, 1 кг');

    await user.click(screen.getByRole('button', { name: 'Мёд (1)' }));
    expect(screen.getAllByTestId('product-card')).toHaveLength(1);
    expect(screen.getByText('Мёд натуральный, 1 л')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Все' }));
    expect(screen.getAllByTestId('product-card')).toHaveLength(3);
  });

  test('категория без названия не превращается в кнопку', async () => {
    mockApi(catalogRoutes({ 'GET /categories': [...categories, { name: null, count: 2 }] }));
    render(<App />);
    await screen.findByText('Картофель, 1 кг');

    // «Все» + три настоящие категории
    expect(screen.getAllByRole('button', { name: /\(\d+\)|^Все$/ })).toHaveLength(4);
  });

  test('«В корзину» увеличивает счётчик в шапке', async () => {
    const user = userEvent.setup();
    mockApi(catalogRoutes());
    render(<App />);
    await screen.findByText('Картофель, 1 кг');
    expect(screen.getByText(/корзина: 0/i)).toBeInTheDocument();

    const [first, second] = screen.getAllByRole('button', { name: /в корзину/i });
    await user.click(first);
    await user.click(second);

    expect(screen.getByText(/корзина: 2/i)).toBeInTheDocument();
  });

  test('«Товар недели» только у товара с id = 1', async () => {
    mockApi(catalogRoutes());
    render(<App />);
    await screen.findByText('Картофель, 1 кг');

    const badges = screen.getAllByText('Товар недели');
    expect(badges).toHaveLength(1);
    expect(within(badges[0].closest('article')).getByText('Картофель, 1 кг')).toBeInTheDocument();
  });
});

describe('App — вход, выход, роли, токен', () => {
  test('гость видит форму входа и не видит форму добавления товара', async () => {
    mockApi(catalogRoutes());
    render(<App />);
    await screen.findByText('Картофель, 1 кг');

    expect(screen.getByRole('heading', { name: 'Вход' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Новый товар' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Выйти' })).not.toBeInTheDocument();
  });

  test('вход через форму: показывает имя и роль, сохраняет токен', async () => {
    const user = userEvent.setup();
    mockApi(catalogRoutes({ 'POST /auth/login': { user: anna, token: 'jwt-token' } }));
    render(<App />);
    await screen.findByText('Картофель, 1 кг');

    // на странице две формы с полем Email (вход и оптовая заявка) — ищем внутри формы входа
    const loginForm = within(screen.getByRole('heading', { name: 'Вход' }).closest('form'));
    await user.type(loginForm.getByLabelText(/email/i), 'anna@agromarket.kz');
    await user.type(loginForm.getByLabelText(/пароль/i), 'secret123');
    await user.click(loginForm.getByRole('button', { name: 'Войти' }));

    expect(await screen.findByText('Анна')).toBeInTheDocument();
    expect(screen.getByText(/\(user\)/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Выйти' })).toBeInTheDocument();
    expect(localStorage.getItem('token')).toBe('jwt-token');
    expect(JSON.parse(localStorage.getItem('user'))).toEqual(anna);
  });

  test('«Выйти» удаляет токен и возвращает форму входа', async () => {
    const user = userEvent.setup();
    loginAs(anna);
    mockApi(catalogRoutes({ 'GET /auth/me': anna }));
    render(<App />);

    await user.click(await screen.findByRole('button', { name: 'Выйти' }));

    expect(localStorage.getItem('token')).toBeNull();
    expect(localStorage.getItem('user')).toBeNull();
    expect(screen.getByRole('heading', { name: 'Вход' })).toBeInTheDocument();
  });

  test('при открытии страницы токен проверяется запросом /auth/me с заголовком Authorization', async () => {
    loginAs(anna, 'test-token');
    const spy = mockApi(catalogRoutes({ 'GET /auth/me': anna }));
    render(<App />);
    await screen.findByText('Картофель, 1 кг');

    const [call] = callsTo(spy, 'GET', '/auth/me');
    expect(call[1].headers.Authorization).toBe('Bearer test-token');
  });

  test('без токена /auth/me не запрашивается', async () => {
    const spy = mockApi(catalogRoutes());
    render(<App />);
    await screen.findByText('Картофель, 1 кг');

    expect(callsTo(spy, 'GET', '/auth/me')).toHaveLength(0);
  });

  test('данные пользователя обновляются тем, что ответил /auth/me', async () => {
    loginAs({ ...anna, name: 'Старое имя' });
    mockApi(catalogRoutes({ 'GET /auth/me': { ...anna, name: 'Новое имя' } }));
    render(<App />);

    expect(await screen.findByText('Новое имя')).toBeInTheDocument();
    expect(screen.queryByText('Старое имя')).not.toBeInTheDocument();
  });

  test('сервер ответил 401: токен удалён, страница перезагружена', async () => {
    loginAs(anna, 'expired-token');
    const reload = mockReload();
    mockApi(catalogRoutes({
      'GET /auth/me': reply(401, { error: 'Срок действия токена истёк, войдите снова' }),
    }));
    render(<App />);
    await screen.findByText('Картофель, 1 кг');

    await vi.waitFor(() => expect(reload).toHaveBeenCalledTimes(1));
    expect(localStorage.getItem('token')).toBeNull();
    expect(localStorage.getItem('user')).toBeNull();
  });

  test('администратор видит форму «Новый товар», обычный пользователь — нет', async () => {
    loginAs(admin);
    mockApi(catalogRoutes({ 'GET /auth/me': admin }));
    const { unmount } = render(<App />);
    expect(await screen.findByRole('heading', { name: 'Новый товар' })).toBeInTheDocument();
    unmount();

    loginAs(anna);
    mockApi(catalogRoutes({ 'GET /auth/me': anna }));
    render(<App />);
    await screen.findByText('Анна');
    expect(screen.queryByRole('heading', { name: 'Новый товар' })).not.toBeInTheDocument();
  });

  test('администратор добавляет товар: он появляется в каталоге', async () => {
    const user = userEvent.setup();
    loginAs(admin);
    const newProduct = { id: 9, name: 'Сметана', category: 'Молочное', price: 750, unit: 'кг' };
    mockApi(catalogRoutes({ 'GET /auth/me': admin, 'POST /products': reply(201, newProduct) }));
    render(<App />);
    await screen.findByText('Картофель, 1 кг');

    await user.type(screen.getByLabelText('Название'), 'Сметана');
    await user.type(screen.getByLabelText(/цена/i), '750');
    await user.click(screen.getByRole('button', { name: 'Добавить' }));

    expect(await screen.findByText('Сметана')).toBeInTheDocument();
    expect(screen.getAllByTestId('product-card')).toHaveLength(4);
  });
});

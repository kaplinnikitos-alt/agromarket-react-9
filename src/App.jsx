import { useState, useEffect } from 'react';
import Header from './components/Header';
import Footer from './components/Footer';
import ProductCard from './components/ProductCard';
import ContactForm from './components/ContactForm';
import LoginForm from './components/LoginForm.jsx';
import AddProductForm from './components/AddProductForm.jsx';
import { API_URL, apiFetch } from './api.js';
import { useSlowHint } from './useSlowHint.js';

function App() {
  const [products, setProducts] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [cartCount, setCartCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  // категории с количеством товаров (GET /api/categories) и выбранный фильтр
  const [categories, setCategories] = useState([]);
  const [activeCategory, setActiveCategory] = useState(null);
  // true, если каталог грузится дольше 3 секунд — скорее всего, сервер «просыпается»
  const slowLoading = useSlowHint(loading, 3000);
  // ленивая инициализация: localStorage читается один раз, при первом рендере
  const [user, setUser] = useState(
    () => JSON.parse(localStorage.getItem('user') || 'null')
  );

  // При открытии страницы спрашиваем у сервера, действителен ли сохранённый токен
  useEffect(() => {
    if (!localStorage.getItem('token')) return; // не входили — проверять нечего

    apiFetch('/auth/me')
      .then(setUser)
      .catch(() => {}); // при 401 apiFetch сам выполнит выход
  }, []);

  useEffect(() => {
    async function loadProducts() {
      try {
        const response = await fetch(`${API_URL}/products`);

        if (!response.ok) {
          throw new Error('Сервер ответил со статусом ' + response.status);
        }

        const data = await response.json();
        setProducts(data);
        setLoading(false);
      } catch (err) {
        console.error(err);
        setError('Не удалось загрузить товары. Сервер недоступен — попробуйте обновить страницу через минуту.');
        setLoading(false);
      }
    }

    loadProducts();
  }, []);

  // Категории — необязательное украшение: если запрос не удался, фильтров просто не будет
  useEffect(() => {
    fetch(`${API_URL}/categories`)
      .then((res) => (res.ok ? res.json() : []))
      .then((list) => setCategories(list.filter((c) => c.name)))
      .catch(() => {});
  }, []);

  function handleAddToCart() {
    setCartCount(cartCount + 1);
  }

  function handleLogin(user, token) {
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(user));
    setUser(user);
  }

  function handleLogout() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser(null);
  }

  const filteredProducts = products.filter(
    (product) =>
      product.name.toLowerCase().includes(searchTerm.toLowerCase()) &&
      (!activeCategory || product.category === activeCategory)
  );

  return (
    <>
      <Header cartCount={cartCount} />

      <div className="auth-bar">
        {user ? (
          <>
            <span>Вы вошли как <b>{user.name}</b> ({user.role})</span>
            <button onClick={handleLogout}>Выйти</button>
          </>
        ) : (
          <LoginForm onLogin={handleLogin} />
        )}
      </div>

      <main className="page">
        <section id="catalog" className="catalog">
          <div className="catalog-toolbar">
            <h2>Каталог</h2>
            <input
              type="search"
              placeholder="Поиск товара..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          {user?.role === 'admin' && (
            <AddProductForm onAdded={(p) => setProducts([...products, p])} />
          )}

          {categories.length > 0 && (
            <div className="category-filter">
              <button
                type="button"
                className={activeCategory === null ? 'chip chip--active' : 'chip'}
                onClick={() => setActiveCategory(null)}
              >
                Все
              </button>
              {categories.map((c) => (
                <button
                  key={c.name}
                  type="button"
                  className={activeCategory === c.name ? 'chip chip--active' : 'chip'}
                  onClick={() => setActiveCategory(c.name)}
                >
                  {c.name} ({c.count})
                </button>
              ))}
            </div>
          )}

          {loading && <p className="status">Загрузка...</p>}
          {loading && slowLoading && (
            <p className="status">
              Сервер просыпается, это может занять до минуты. Бесплатный хостинг
              «засыпает» без посетителей — повторные запросы будут быстрыми.
            </p>
          )}
          {error && <p className="error">{error}</p>}

          {!loading && !error && (
            <div className="product-grid">
              {filteredProducts.map((product) => (
                <ProductCard
                  key={product.id}
                  product={product}
                  onAdd={handleAddToCart}
                  featured={product.id === 1}
                />
              ))}
            </div>
          )}
        </section>

        <aside id="delivery" className="sidebar">
          <h3>Доставка</h3>
          <ul>
            <li>Астана — на следующий день</li>
            <li>Акмолинская область — 2–3 дня</li>
            <li>Бесплатно от 20 000 тг</li>
          </ul>
        </aside>

        <ContactForm />
      </main>

      <Footer />
    </>
  );
}

export default App;

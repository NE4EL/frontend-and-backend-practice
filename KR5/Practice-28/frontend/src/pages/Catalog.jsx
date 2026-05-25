import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/index.js';

const CATEGORIES = ['', 'Смартфоны', 'Ноутбуки', 'Наушники', 'Планшеты', 'Телевизоры'];

export default function Catalog() {
  const [products, setProducts] = useState([]);
  const [search,   setSearch]   = useState('');
  const [category, setCategory] = useState('');
  const [loading,  setLoading]  = useState(true);
  const [addMsg,   setAddMsg]   = useState({});
  const isLoggedIn = !!localStorage.getItem('accessToken');

  async function load() {
    setLoading(true);
    const params = {};
    if (search)   params.search   = search;
    if (category) params.category = category;
    const { data } = await api.get('/products', { params });
    setProducts(data);
    setLoading(false);
  }

  useEffect(() => { load(); }, [search, category]);

  async function addToCart(productId) {
    try {
      await api.post('/cart', { productId, quantity: 1 });
      setAddMsg(m => ({ ...m, [productId]: '✓ Добавлено' }));
      setTimeout(() => setAddMsg(m => ({ ...m, [productId]: '' })), 1500);
    } catch (err) {
      setAddMsg(m => ({ ...m, [productId]: err.response?.data?.error || 'Ошибка' }));
    }
  }

  return (
    <div className="page">
      <div className="page__head">
        <h2 className="page__title">Каталог товаров</h2>
      </div>

      <div className="filters">
        <input
          placeholder="Поиск..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ minWidth: 220 }}
        />
        <select value={category} onChange={e => setCategory(e.target.value)}>
          {CATEGORIES.map(c => <option key={c} value={c}>{c || 'Все категории'}</option>)}
        </select>
      </div>

      {loading ? (
        <div className="loader"><div className="loader__spinner" />Загрузка...</div>
      ) : products.length === 0 ? (
        <div className="empty-state">Товары не найдены</div>
      ) : (
        <div className="grid">
          {products.map(p => (
            <div key={p.id} className="card">
              <span className="card__tag">{p.category}</span>
              <p className="card__title">{p.title}</p>
              <p className="card__desc">{p.description}</p>
              <p className="card__price">{Number(p.price).toLocaleString('ru-RU')} ₽</p>
              <p className="card__stock">На складе: {p.stock} шт.</p>
              <div className="card__actions">
                {isLoggedIn ? (
                  <button
                    className="btn btn--primary btn--sm"
                    onClick={() => addToCart(p.id)}
                    disabled={p.stock === 0}
                  >
                    {addMsg[p.id] || (p.stock === 0 ? 'Нет в наличии' : '+ В корзину')}
                  </button>
                ) : (
                  <Link to="/login" className="btn btn--ghost btn--sm">Войти для покупки</Link>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

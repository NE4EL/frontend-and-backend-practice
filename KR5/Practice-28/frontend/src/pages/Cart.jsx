import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/index.js';

export default function Cart() {
  const navigate = useNavigate();
  const [cart,    setCart]    = useState({ items: [], total: '0.00' });
  const [loading, setLoading] = useState(true);
  const [placing, setPlacing] = useState(false);
  const [error,   setError]   = useState('');

  async function load() {
    const { data } = await api.get('/cart');
    setCart(data);
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  async function updateQty(productId, qty) {
    await api.put(`/cart/${productId}`, { quantity: qty });
    load();
  }
  async function remove(productId) {
    await api.delete(`/cart/${productId}`);
    load();
  }
  async function checkout() {
    setPlacing(true); setError('');
    try {
      await api.post('/orders');
      navigate('/orders');
    } catch (err) {
      setError(err.response?.data?.error || 'Ошибка оформления заказа');
      setPlacing(false);
    }
  }

  if (loading) return <div className="loader"><div className="loader__spinner" />Загрузка...</div>;

  return (
    <div className="page">
      <div className="page__head"><h2 className="page__title">Корзина</h2></div>

      {cart.items.length === 0 ? (
        <div className="empty-state">Корзина пуста</div>
      ) : (
        <>
          <div className="cart-items">
            {cart.items.map(item => (
              <div key={item.id || item.productId} className="cart-item">
                <div className="cart-item__info">
                  <div className="cart-item__title">{item.Product?.title || item.product?.title || `Товар ${item.ProductId || item.productId}`}</div>
                  <div className="cart-item__price">{Number(item.Product?.price || item.product?.price || 0).toLocaleString('ru-RU')} ₽ × {item.quantity}</div>
                </div>
                <div className="qty-control">
                  <button className="qty-btn" onClick={() => updateQty(item.ProductId || item.productId, item.quantity - 1)}>−</button>
                  <span style={{ minWidth: 24, textAlign: 'center' }}>{item.quantity}</span>
                  <button className="qty-btn" onClick={() => updateQty(item.ProductId || item.productId, item.quantity + 1)}>+</button>
                </div>
                <button className="btn btn--danger btn--sm" onClick={() => remove(item.ProductId || item.productId)}>Удалить</button>
              </div>
            ))}
          </div>

          {error && <div className="error" style={{ marginBottom: 12 }}>{error}</div>}

          <div className="cart-total">
            <span className="cart-total__label">Итого</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
              <span className="cart-total__val">{Number(cart.total).toLocaleString('ru-RU')} ₽</span>
              <button className="btn btn--primary" onClick={checkout} disabled={placing}>
                {placing ? 'Оформляем...' : 'Оформить заказ'}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

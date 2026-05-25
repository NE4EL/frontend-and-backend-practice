import { useState, useEffect } from 'react';
import api from '../api/index.js';

const STATUS_MAP = { pending: 'Ожидает', confirmed: 'Подтверждён', shipped: 'Доставляется', delivered: 'Доставлен', cancelled: 'Отменён' };

export default function Orders() {
  const [orders,  setOrders]  = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/orders').then(r => { setOrders(r.data); setLoading(false); });
  }, []);

  if (loading) return <div className="loader"><div className="loader__spinner" />Загрузка...</div>;

  return (
    <div className="page">
      <div className="page__head"><h2 className="page__title">Мои заказы</h2></div>

      {orders.length === 0 ? (
        <div className="empty-state">Заказов ещё нет</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {orders.map(order => (
            <div key={order.id} className="card" style={{ gap: 14 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontWeight: 700 }}>Заказ #{order.id}</span>
                <span className={`badge badge--${order.status}`}>{STATUS_MAP[order.status] || order.status}</span>
              </div>
              <div style={{ fontSize: 13, color: 'var(--muted)' }}>
                {new Date(order.created_at || order.createdAt).toLocaleString('ru-RU')}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {(order.OrderItems || []).map((item, i) => (
                  <div key={i} style={{ fontSize: 13, color: 'var(--muted)' }}>
                    {item.Product?.title || `Товар ${item.ProductId}`} × {item.quantity} — {Number(item.unit_price).toLocaleString('ru-RU')} ₽/шт.
                  </div>
                ))}
              </div>
              <div style={{ fontWeight: 700, fontSize: 18, color: 'var(--success)' }}>
                {Number(order.total).toLocaleString('ru-RU')} ₽
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

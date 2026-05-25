import { useState, useEffect } from 'react';
import api from '../api/index.js';

const ORDER_STATUSES = ['pending','confirmed','shipped','delivered','cancelled'];
const STATUS_RU = { pending: 'Ожидает', confirmed: 'Подтверждён', shipped: 'Доставляется', delivered: 'Доставлен', cancelled: 'Отменён' };

export default function Admin() {
  const [tab, setTab] = useState('products');

  return (
    <div className="page">
      <div className="page__head"><h2 className="page__title">Панель администратора</h2></div>
      <div style={{ display: 'flex', gap: 4, marginBottom: 24, background: 'var(--bg)', padding: 4, borderRadius: 8, width: 'fit-content' }}>
        {['products','orders','users'].map(t => (
          <button key={t} onClick={() => setTab(t)}
            style={{ padding: '7px 16px', borderRadius: 6, border: 'none', cursor: 'pointer', fontSize: 14, fontWeight: 600,
              background: tab === t ? 'var(--primaryBg)' : 'transparent',
              color: tab === t ? 'var(--text)' : 'var(--muted)' }}>
            {t === 'products' ? 'Товары' : t === 'orders' ? 'Заказы' : 'Пользователи'}
          </button>
        ))}
      </div>
      {tab === 'products' && <ProductsTab />}
      {tab === 'orders'   && <OrdersTab />}
      {tab === 'users'    && <UsersTab />}
    </div>
  );
}

function ProductsTab() {
  const [products, setProducts] = useState([]);
  const [modal, setModal]       = useState(null);
  const [form,  setForm]        = useState({ title: '', category: '', description: '', price: '', stock: '' });
  const [error, setError]       = useState('');

  async function load() {
    const { data } = await api.get('/products');
    setProducts(data);
  }
  useEffect(() => { load(); }, []);

  function openModal(p = null) {
    setError('');
    setForm(p ? { title: p.title, category: p.category, description: p.description || '', price: p.price, stock: p.stock } : { title: '', category: '', description: '', price: '', stock: '' });
    setModal(p ? p.id : 'new');
  }

  async function save(e) {
    e.preventDefault(); setError('');
    try {
      if (modal === 'new') await api.post('/products', form);
      else await api.put(`/products/${modal}`, form);
      setModal(null); load();
    } catch (err) { setError(err.response?.data?.error || 'Ошибка'); }
  }

  async function del(id) {
    if (!confirm('Удалить товар?')) return;
    await api.delete(`/products/${id}`);
    load();
  }

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
        <button className="btn btn--primary" onClick={() => openModal()}>+ Добавить товар</button>
      </div>
      <div className="grid">
        {products.map(p => (
          <div key={p.id} className="card">
            <span className="card__tag">{p.category}</span>
            <p className="card__title">{p.title}</p>
            <p className="card__desc">{p.description}</p>
            <p className="card__price">{Number(p.price).toLocaleString('ru-RU')} ₽</p>
            <p className="card__stock">Склад: {p.stock} шт.</p>
            <div className="card__actions">
              <button className="btn btn--ghost btn--sm" onClick={() => openModal(p)}>Изменить</button>
              <button className="btn btn--danger btn--sm" onClick={() => del(p.id)}>Удалить</button>
            </div>
          </div>
        ))}
      </div>

      {modal !== null && (
        <div className="modal">
          <div className="modal__overlay" onClick={() => setModal(null)} />
          <div className="modal__box">
            <h3 className="modal__title">{modal === 'new' ? 'Новый товар' : 'Изменить товар'}</h3>
            <form className="form" onSubmit={save}>
              {['title','category','description'].map(k => (
                <div key={k} className="field">
                  <label>{k}</label>
                  <input value={form[k]} onChange={e => setForm(f => ({ ...f, [k]: e.target.value }))} required={k !== 'description'} />
                </div>
              ))}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div className="field"><label>Цена (₽)</label><input type="number" value={form.price} onChange={e => setForm(f => ({ ...f, price: e.target.value }))} required /></div>
                <div className="field"><label>Склад</label><input type="number" value={form.stock} onChange={e => setForm(f => ({ ...f, stock: e.target.value }))} /></div>
              </div>
              {error && <div className="error">{error}</div>}
              <div className="modal__actions">
                <button type="button" className="btn btn--ghost" onClick={() => setModal(null)}>Отмена</button>
                <button type="submit" className="btn btn--primary">Сохранить</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}

function OrdersTab() {
  const [orders, setOrders] = useState([]);

  async function load() { const { data } = await api.get('/orders'); setOrders(data); }
  useEffect(() => { load(); }, []);

  async function updateStatus(id, status) {
    await api.put(`/orders/${id}/status`, { status });
    load();
  }

  return (
    <div className="table-wrap">
      <table className="table">
        <thead><tr><th>ID</th><th>Пользователь</th><th>Сумма</th><th>Статус</th><th>Дата</th><th>Действие</th></tr></thead>
        <tbody>
          {orders.map(o => (
            <tr key={o.id}>
              <td>#{o.id}</td>
              <td style={{ fontSize: 12 }}>ID:{o.UserId}</td>
              <td style={{ fontWeight: 700, color: 'var(--success)' }}>{Number(o.total).toLocaleString('ru-RU')} ₽</td>
              <td><span className={`badge badge--${o.status}`}>{STATUS_RU[o.status] || o.status}</span></td>
              <td style={{ fontSize: 12, color: 'var(--muted)' }}>{new Date(o.created_at || o.createdAt).toLocaleDateString('ru-RU')}</td>
              <td>
                <select value={o.status} onChange={e => updateStatus(o.id, e.target.value)}
                  style={{ background: 'var(--bg)', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: 6, padding: '4px 8px', fontSize: 12 }}>
                  {ORDER_STATUSES.map(s => <option key={s} value={s}>{STATUS_RU[s]}</option>)}
                </select>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function UsersTab() {
  const [users, setUsers] = useState([]);

  async function load() { const { data } = await api.get('/users'); setUsers(data); }
  useEffect(() => { load(); }, []);

  async function toggle(id, blocked) {
    await api.put(`/users/${id}`, { blocked: !blocked });
    load();
  }
  async function changeRole(id, role) {
    await api.put(`/users/${id}`, { role });
    load();
  }

  return (
    <div className="table-wrap">
      <table className="table">
        <thead><tr><th>ID</th><th>Email</th><th>Имя</th><th>Роль</th><th>Статус</th><th>Действия</th></tr></thead>
        <tbody>
          {users.map(u => (
            <tr key={u.id}>
              <td>{u.id}</td>
              <td>{u.email}</td>
              <td>{u.first_name} {u.last_name}</td>
              <td><span className={`badge badge--${u.role}`}>{u.role}</span></td>
              <td><span className={`badge badge--${u.blocked ? 'blocked' : 'ok'}`}>{u.blocked ? 'Заблокирован' : 'Активен'}</span></td>
              <td>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button className={`btn btn--sm ${u.blocked ? 'btn--ghost' : 'btn--danger'}`} onClick={() => toggle(u.id, u.blocked)}>
                    {u.blocked ? 'Разблок' : 'Блок'}
                  </button>
                  <select value={u.role} onChange={e => changeRole(u.id, e.target.value)}
                    style={{ background: 'var(--bg)', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: 6, padding: '4px 8px', fontSize: 12 }}>
                    <option value="customer">customer</option>
                    <option value="admin">admin</option>
                  </select>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

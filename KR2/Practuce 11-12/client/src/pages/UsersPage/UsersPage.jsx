import React, { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { api } from '../../api';
import './UsersPage.scss';

export default function UsersPage() {
  const navigate = useNavigate();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingUser, setEditingUser] = useState(null);
  const [editForm, setEditForm] = useState({ first_name: '', last_name: '', role: 'user' });

  useEffect(() => { loadUsers(); }, []);

  const loadUsers = async () => {
    try {
      setLoading(true);
      const res = await api.getUsers();
      setUsers(res.data);
    } catch { alert('Ошибка загрузки пользователей'); }
    finally { setLoading(false); }
  };

  const handleLogout = () => {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    navigate('/login');
  };

  const openEdit = (user) => {
    setEditingUser(user);
    setEditForm({ first_name: user.first_name, last_name: user.last_name, role: user.role });
  };

  const handleUpdate = async (e) => {
    e.preventDefault();
    try {
      const res = await api.updateUser(editingUser.id, editForm);
      setUsers(prev => prev.map(u => u.id === editingUser.id ? res.data : u));
      setEditingUser(null);
    } catch { alert('Ошибка обновления'); }
  };

  const handleBlock = async (id) => {
    if (!window.confirm('Заблокировать пользователя?')) return;
    try {
      await api.deleteUser(id);
      setUsers(prev => prev.map(u => u.id === id ? { ...u, blocked: true } : u));
    } catch { alert('Ошибка блокировки'); }
  };

  return (
    <div className="page">
      <header className="header">
        <div className="header__inner">
          <div className="brand">⚡ TechStore</div>
          <div className="header__right">
            <Link to="/products" className="btn">Товары</Link>
            <button className="btn btn--danger" onClick={handleLogout}>Выйти</button>
          </div>
        </div>
      </header>

      <main className="main">
        <div className="container">
          <div className="toolbar">
            <h1 className="title">Пользователи</h1>
          </div>

          {loading ? <div className="empty">Загрузка...</div> : (
            <div className="usersList">
              {users.map(u => (
                <div key={u.id} className={`userRow${u.blocked ? ' userRow--blocked' : ''}`}>
                  <div className="userRow__info">
                    <div className="userRow__name">{u.first_name} {u.last_name}</div>
                    <div className="userRow__email">{u.email}</div>
                    <div className="userRow__meta">
                      <span className={`roleBadge roleBadge--${u.role}`}>{u.role}</span>
                      {u.blocked && <span className="blockedBadge">Заблокирован</span>}
                    </div>
                  </div>
                  <div className="userRow__actions">
                    {!u.blocked && (
                      <>
                        <button className="btn" onClick={() => openEdit(u)}>Изменить</button>
                        <button className="btn btn--danger" onClick={() => handleBlock(u.id)}>Заблокировать</button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>

      {editingUser && (
        <div className="backdrop" onMouseDown={() => setEditingUser(null)}>
          <div className="modal" onMouseDown={e => e.stopPropagation()}>
            <div className="modal__header">
              <div className="modal__title">Редактирование пользователя</div>
              <button className="iconBtn" onClick={() => setEditingUser(null)}>✕</button>
            </div>
            <form className="form" onSubmit={handleUpdate}>
              <label className="label">
                Имя
                <input className="input" value={editForm.first_name}
                  onChange={e => setEditForm(p => ({ ...p, first_name: e.target.value }))} />
              </label>
              <label className="label">
                Фамилия
                <input className="input" value={editForm.last_name}
                  onChange={e => setEditForm(p => ({ ...p, last_name: e.target.value }))} />
              </label>
              <label className="label">
                Роль
                <select className="input" value={editForm.role}
                  onChange={e => setEditForm(p => ({ ...p, role: e.target.value }))}>
                  <option value="user">user</option>
                  <option value="seller">seller</option>
                  <option value="admin">admin</option>
                </select>
              </label>
              <div className="modal__footer">
                <button type="button" className="btn" onClick={() => setEditingUser(null)}>Отмена</button>
                <button type="submit" className="btn btn--primary">Сохранить</button>
              </div>
            </form>
          </div>
        </div>
      )}

      <footer className="footer">
        <div className="footer__inner">© {new Date().getFullYear()} TechStore</div>
      </footer>
    </div>
  );
}
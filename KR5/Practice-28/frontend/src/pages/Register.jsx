import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../api/index.js';

export default function Register() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: '', first_name: '', last_name: '', password: '', role: 'customer' });
  const [error, setError] = useState('');

  function set(k) { return e => setForm(f => ({ ...f, [k]: e.target.value })); }

  async function submit(e) {
    e.preventDefault(); setError('');
    try {
      await api.post('/auth/register', form);
      const { data } = await api.post('/auth/login', { email: form.email, password: form.password });
      localStorage.setItem('accessToken', data.accessToken);
      localStorage.setItem('refreshToken', data.refreshToken);
      const me = await api.get('/auth/me', { headers: { Authorization: `Bearer ${data.accessToken}` } });
      localStorage.setItem('userRole', me.data.role);
      localStorage.setItem('userEmail', me.data.email);
      navigate('/');
    } catch (err) {
      setError(err.response?.data?.error || 'Ошибка регистрации');
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <h2 className="auth-card__title">Регистрация</h2>
        <p className="auth-card__sub">TechStore E-commerce</p>
        <form className="form" onSubmit={submit}>
          <div className="field"><label>Имя</label><input value={form.first_name} onChange={set('first_name')} placeholder="Иван" required /></div>
          <div className="field"><label>Фамилия</label><input value={form.last_name} onChange={set('last_name')} placeholder="Иванов" required /></div>
          <div className="field"><label>Email</label><input type="email" value={form.email} onChange={set('email')} placeholder="user@test.com" required /></div>
          <div className="field"><label>Пароль</label><input type="password" value={form.password} onChange={set('password')} placeholder="pass123" required /></div>
          <div className="field">
            <label>Роль</label>
            <select value={form.role} onChange={set('role')}>
              <option value="customer">customer</option>
              <option value="admin">admin</option>
            </select>
          </div>
          {error && <div className="error">{error}</div>}
          <button type="submit" className="btn btn--primary btn--full">Зарегистрироваться</button>
          <p style={{ textAlign: 'center', fontSize: 13, color: 'var(--muted)' }}>
            Уже есть аккаунт? <Link to="/login" className="link">Войти</Link>
          </p>
        </form>
      </div>
    </div>
  );
}

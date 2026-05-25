import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../api/index.js';

export default function Login() {
  const navigate = useNavigate();
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [error, setError]       = useState('');

  async function submit(e) {
    e.preventDefault();
    setError('');
    try {
      const { data } = await api.post('/auth/login', { email, password });
      localStorage.setItem('accessToken', data.accessToken);
      localStorage.setItem('refreshToken', data.refreshToken);
      // Fetch user info
      const me = await api.get('/auth/me', { headers: { Authorization: `Bearer ${data.accessToken}` } });
      localStorage.setItem('userRole', me.data.role);
      localStorage.setItem('userEmail', me.data.email);
      navigate('/');
    } catch (err) {
      setError(err.response?.data?.error || 'Ошибка входа');
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <h2 className="auth-card__title">Вход в TechStore</h2>
        <p className="auth-card__sub">Practice 28 — E-commerce</p>
        <form className="form" onSubmit={submit}>
          <div className="field">
            <label>Email</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="admin@techstore.com" required />
          </div>
          <div className="field">
            <label>Пароль</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="admin123" required />
          </div>
          {error && <div className="error">{error}</div>}
          <button type="submit" className="btn btn--primary btn--full">Войти</button>
          <p style={{ textAlign: 'center', fontSize: 13, color: 'var(--muted)' }}>
            Нет аккаунта? <Link to="/register" className="link">Зарегистрироваться</Link>
          </p>
        </form>
        <div style={{ marginTop: 20, padding: '14px', background: 'var(--bg)', borderRadius: 8, fontSize: 12, color: 'var(--muted)' }}>
          <strong style={{ color: 'var(--text)' }}>По умолчанию:</strong><br />
          admin@techstore.com / admin123
        </div>
      </div>
    </div>
  );
}

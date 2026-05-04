import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { api } from '../../api';
import './RegisterPage.scss';

export default function RegisterPage() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: '', first_name: '', last_name: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await api.register(form);
      // После регистрации сразу логиним
      const res = await api.login({ email: form.email, password: form.password });
      localStorage.setItem('accessToken', res.data.accessToken);
      localStorage.setItem('refreshToken', res.data.refreshToken);
      navigate('/products');
    } catch (err) {
      setError(err.response?.data?.error || 'Ошибка регистрации');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="authPage">
      <div className="authCard">
        <div className="authCard__title">⚡ TechStore</div>
        <div className="authCard__subtitle">Регистрация</div>

        {error && <div className="authCard__error">{error}</div>}

        <form className="authForm" onSubmit={handleSubmit}>
          <label className="label">
            Имя
            <input className="input" name="first_name" value={form.first_name}
              onChange={handleChange} placeholder="Иван" autoFocus />
          </label>
          <label className="label">
            Фамилия
            <input className="input" name="last_name" value={form.last_name}
              onChange={handleChange} placeholder="Петров" />
          </label>
          <label className="label">
            Email
            <input className="input" name="email" type="email" value={form.email}
              onChange={handleChange} placeholder="ivan@mail.ru" />
          </label>
          <label className="label">
            Пароль
            <input className="input" name="password" type="password" value={form.password}
              onChange={handleChange} placeholder="••••••••" />
          </label>
          <button className="btn btn--primary" type="submit" disabled={loading}>
            {loading ? 'Регистрация...' : 'Зарегистрироваться'}
          </button>
        </form>

        <div className="authCard__footer">
          Уже есть аккаунт? <Link to="/login">Войти</Link>
        </div>
      </div>
    </div>
  );
}
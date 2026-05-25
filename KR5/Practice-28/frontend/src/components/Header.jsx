import { NavLink, useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import api from '../api/index.js';

export default function Header() {
  const navigate = useNavigate();
  const isLoggedIn = !!localStorage.getItem('accessToken');
  const role = localStorage.getItem('userRole');
  const email = localStorage.getItem('userEmail');
  const [cartCount, setCartCount] = useState(0);

  useEffect(() => {
    if (!isLoggedIn) return;
    api.get('/cart').then(r => setCartCount(r.data.items.length)).catch(() => {});
  }, [isLoggedIn]);

  function logout() {
    localStorage.clear();
    navigate('/login');
  }

  return (
    <header className="header">
      <NavLink to="/" className="header__brand">
        <span style={{ fontSize: 22 }}>🛒</span>
        <span className="header__logo">TechStore</span>
        <span className="header__badge">E-commerce KR5</span>
      </NavLink>

      <nav className="nav">
        <NavLink to="/" end className={({ isActive }) => 'nav__link' + (isActive ? ' active' : '')}>Каталог</NavLink>
        {isLoggedIn && (
          <>
            <NavLink to="/cart" className={({ isActive }) => 'nav__link' + (isActive ? ' active' : '')}>
              Корзина {cartCount > 0 && <span className="cart-count">{cartCount}</span>}
            </NavLink>
            <NavLink to="/orders" className={({ isActive }) => 'nav__link' + (isActive ? ' active' : '')}>Заказы</NavLink>
          </>
        )}
        {role === 'admin' && (
          <NavLink to="/admin" className={({ isActive }) => 'nav__link' + (isActive ? ' active' : '')}>Админ</NavLink>
        )}
      </nav>

      <div className="header__user">
        {isLoggedIn ? (
          <>
            <span className="user-badge">{email} [{role}]</span>
            <button className="btn btn--ghost btn--sm" onClick={logout}>Выйти</button>
          </>
        ) : (
          <>
            <NavLink to="/login"    className="btn btn--ghost btn--sm">Войти</NavLink>
            <NavLink to="/register" className="btn btn--primary btn--sm">Регистрация</NavLink>
          </>
        )}
      </div>
    </header>
  );
}

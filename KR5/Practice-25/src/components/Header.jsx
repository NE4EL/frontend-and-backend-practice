import { NavLink } from 'react-router-dom';

export default function Header() {
  return (
    <header className="header">
      <div className="header__brand">
        <span style={{ fontSize: 22 }}>⚡</span>
        <span className="header__logo">TechStore</span>
        <span className="header__badge">Vite + React</span>
      </div>
      <nav className="nav">
        <NavLink to="/"        className={({ isActive }) => 'nav__link' + (isActive ? ' active' : '')}>Главная</NavLink>
        <NavLink to="/catalog" className={({ isActive }) => 'nav__link' + (isActive ? ' active' : '')}>Каталог</NavLink>
        <NavLink to="/about"   className={({ isActive }) => 'nav__link' + (isActive ? ' active' : '')}>О проекте</NavLink>
      </nav>
    </header>
  );
}

import { Link } from 'react-router-dom';

export default function Home() {
  return (
    <div>
      <div className="hero">
        <h1 className="hero__title">Tech<span>Store</span></h1>
        <p className="hero__sub">
          Практика 25 — демонстрация инструментов сборки: Vite, code splitting, lazy loading
        </p>
        <div className="hero__actions">
          <Link to="/catalog" className="btn btn--primary">Открыть каталог</Link>
          <Link to="/about"   className="btn btn--ghost">О проекте</Link>
        </div>
      </div>

      <div className="page">
        <div className="stats">
          <div className="stat">
            <div className="stat__val">3</div>
            <div className="stat__label">маршрута (Routes)</div>
          </div>
          <div className="stat">
            <div className="stat__val">2</div>
            <div className="stat__label">lazy-loaded страницы</div>
          </div>
          <div className="stat">
            <div className="stat__val">4</div>
            <div className="stat__label">чанка в бандле</div>
          </div>
          <div className="stat">
            <div className="stat__val">0ms</div>
            <div className="stat__label">холодный старт Vite</div>
          </div>
        </div>

        <div className="features">
          <div className="feature">
            <div className="feature__icon">⚡</div>
            <div className="feature__title">Vite — мгновенный старт</div>
            <div className="feature__desc">
              Vite использует нативные ES-модули браузера в dev-режиме.
              Нет сборки при старте — страница открывается мгновенно.
            </div>
          </div>
          <div className="feature">
            <div className="feature__icon">✂️</div>
            <div className="feature__title">Code Splitting</div>
            <div className="feature__desc">
              Каталог и страница «О проекте» загружаются через <code>React.lazy()</code>{' '}
              + <code>Suspense</code>. Каждый маршрут — отдельный чанк.
            </div>
          </div>
          <div className="feature">
            <div className="feature__icon">🌳</div>
            <div className="feature__title">Tree Shaking</div>
            <div className="feature__desc">
              Rollup (движок Vite) автоматически удаляет мёртвый код.
              В бандл попадает только то, что реально используется.
            </div>
          </div>
          <div className="feature">
            <div className="feature__icon">📊</div>
            <div className="feature__title">Bundle Analyzer</div>
            <div className="feature__desc">
              После <code>npm run build</code> генерируется{' '}
              <code>dist/stats.html</code> с визуализацией структуры бандла.
            </div>
          </div>
          <div className="feature">
            <div className="feature__icon">🔗</div>
            <div className="feature__title">Связь с KR2</div>
            <div className="feature__desc">
              Dev-сервер проксирует <code>/api/*</code> на KR2 TechStore (порт 3000).
              Каталог показывает реальные товары если KR2 запущен.
            </div>
          </div>
          <div className="feature">
            <div className="feature__icon">📦</div>
            <div className="feature__title">Manual Chunks</div>
            <div className="feature__desc">
              React и react-dom вынесены в отдельный vendor-чанк.
              React Router — в router-чанк. Кэш браузера работает эффективнее.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function About() {
  return (
    <div className="page">
      <h2 className="section-title">О проекте — Practice 25</h2>

      <div className="about-grid">
        <div className="about-card">
          <div className="about-card__title">⚡ Почему Vite?</div>
          <ul className="about-card__list">
            <li>Мгновенный холодный старт через нативные ES-модули</li>
            <li>Instant HMR — обновление без перезагрузки страницы</li>
            <li>Сборка через Rollup с оптимизацией для production</li>
            <li>Поддержка TypeScript, JSX, CSS, SASS из коробки</li>
            <li>Плагины: React, Vue, Svelte и другие</li>
          </ul>
        </div>

        <div className="about-card">
          <div className="about-card__title">✂️ Code Splitting (этот проект)</div>
          <ul className="about-card__list">
            <li><code>React.lazy(() =&gt; import('./pages/Catalog'))</code></li>
            <li><code>React.lazy(() =&gt; import('./pages/About'))</code></li>
            <li>Оба маршрута — отдельные JS-чанки</li>
            <li><code>Suspense fallback</code> показывает спиннер при загрузке</li>
            <li>Браузер подгружает чанк только при переходе</li>
          </ul>
        </div>

        <div className="about-card">
          <div className="about-card__title">📊 Bundle Analyzer</div>
          <ul className="about-card__list">
            <li>Плагин: <code>rollup-plugin-visualizer</code></li>
            <li>Генерирует <code>dist/stats.html</code> после сборки</li>
            <li>Показывает размер каждого модуля в treemap</li>
            <li>Помогает найти тяжёлые зависимости</li>
            <li>Поддержка gzip и brotli размеров</li>
          </ul>
        </div>

        <div className="about-card">
          <div className="about-card__title">🔗 Связь с KR2</div>
          <ul className="about-card__list">
            <li>Proxy в vite.config.js: <code>/api → localhost:3000</code></li>
            <li>KR2 TechStore API: Express + JWT + RBAC</li>
            <li>Каталог получает реальные товары из KR2</li>
            <li>Если KR2 не запущен — demo-режим с mock-данными</li>
            <li>P28 — полное расширение KR2 с корзиной и заказами</li>
          </ul>
        </div>
      </div>

      <h3 className="section-title" style={{ marginBottom: 16 }}>Структура бандла</h3>
      <div className="chunk-diagram">
        <div className="chunk chunk--vendor">
          vendor.[hash].js — React + ReactDOM <span className="chunk__size">~140 KB</span>
        </div>
        <div className="chunk chunk--vendor">
          router.[hash].js — React Router DOM <span className="chunk__size">~30 KB</span>
        </div>
        <div className="chunk chunk--main">
          index.[hash].js — App + Header + Loader <span className="chunk__size">~5 KB</span>
        </div>
        <div className="chunk chunk--page">
          Catalog.[hash].js — lazy chunk <span className="chunk__size">~3 KB</span>
        </div>
        <div className="chunk chunk--page">
          About.[hash].js — lazy chunk <span className="chunk__size">~2 KB</span>
        </div>
      </div>

      <div className="connection-info" style={{ marginTop: 24 }}>
        <strong>Запуск:</strong> <code>npm install &amp;&amp; npm run dev</code> — dev сервер на порту 5173<br />
        <strong>Сборка:</strong> <code>npm run build</code> — production бандл + <code>dist/stats.html</code><br />
        <strong>KR2 API:</strong> Запусти KR2 (<code>cd KR2/Practuce\ 11-12/server &amp;&amp; node app.js</code>),
        тогда каталог покажет реальные данные из PostgreSQL/MongoDB.
      </div>
    </div>
  );
}

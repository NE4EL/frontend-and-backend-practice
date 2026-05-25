import { useState, useEffect } from 'react';

const DEMO_PRODUCTS = [
  { id: 1, title: 'iPhone 15 Pro',    category: 'Смартфоны',  description: 'Apple iPhone 15 Pro 256GB',         price: 89990 },
  { id: 2, title: 'MacBook Air M3',   category: 'Ноутбуки',   description: 'Apple MacBook Air 13" M3 256GB',   price: 119990 },
  { id: 3, title: 'Sony WH-1000XM5', category: 'Наушники',   description: 'Беспроводные наушники с ANC',       price: 29990 },
  { id: 4, title: 'iPad Pro 13"',     category: 'Планшеты',   description: 'Apple iPad Pro 13" M4 256GB Wi-Fi',price: 109990 },
  { id: 5, title: 'Samsung 4K TV',    category: 'Телевизоры', description: 'Samsung QLED 55" 4K Smart TV',      price: 79990 },
];

export default function Catalog() {
  const [products, setProducts] = useState([]);
  const [source, setSource]     = useState('');
  const [loading, setLoading]   = useState(true);

  useEffect(() => {
    fetch('/api/products')
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(data => {
        setProducts(Array.isArray(data) ? data : DEMO_PRODUCTS);
        setSource('live');
      })
      .catch(() => {
        setProducts(DEMO_PRODUCTS);
        setSource('demo');
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="loader"><div className="loader__spinner" />Загрузка товаров...</div>;

  return (
    <div className="page">
      <h2 className="section-title">Каталог товаров</h2>

      {source === 'live' ? (
        <div className="source-badge source-badge--live">🟢 Данные из KR2 TechStore API (порт 3000)</div>
      ) : (
        <div className="source-badge source-badge--demo">⚪ Demo-режим (KR2 не запущен)</div>
      )}

      <div className="grid">
        {products.map(p => (
          <div key={p.id} className="card">
            <span className="card__tag">{p.category}</span>
            <p className="card__title">{p.title}</p>
            <p className="card__desc">{p.description}</p>
            <p className="card__price">{Number(p.price).toLocaleString('ru-RU')} ₽</p>
          </div>
        ))}
      </div>
    </div>
  );
}

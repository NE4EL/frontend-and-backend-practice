import React from 'react';

export default function ProductItem({ product, onEdit, onDelete }) {
  const { id, name, category, description, price, stock, rating } = product;
  const lowStock = stock <= 3;

  return (
    <div className="card">
      <div className="card__header">
        <div className="card__name">{name}</div>
        <div className="card__category">{category}</div>
      </div>
      <div className="card__desc">{description}</div>
      {rating != null && (
        <div className="card__rating">{'★'.repeat(Math.round(rating))}{'☆'.repeat(5 - Math.round(rating))} {rating}</div>
      )}
      <div className="card__meta">
        <div className="card__price">{price.toLocaleString('ru-RU')} ₽</div>
        <div className={`card__stock${lowStock ? ' card__stock--low' : ''}`}>
          {lowStock ? '⚠️ ' : '✓ '}На складе: {stock} шт.
        </div>
      </div>
      <div className="card__actions">
        <button className="btn" onClick={() => onEdit(product)}>Редактировать</button>
        <button className="btn btn--danger" onClick={() => onDelete(id)}>Удалить</button>
      </div>
    </div>
  );
}
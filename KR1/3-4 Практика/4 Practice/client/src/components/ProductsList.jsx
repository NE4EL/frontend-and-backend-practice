import React from 'react';
import ProductItem from './ProductItem';

export default function ProductsList({ products, onEdit, onDelete }) {
  if (!products.length) {
    return <div className="empty">Товаров не найдено</div>;
  }
  return (
    <div className="grid">
      {products.map(p => (
        <ProductItem key={p.id} product={p} onEdit={onEdit} onDelete={onDelete} />
      ))}
    </div>
  );
}
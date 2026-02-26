import React, { useEffect, useState } from 'react';

export default function ProductModal({ open, mode, initialProduct, onClose, onSubmit }) {
  const [name, setName] = useState('');
  const [category, setCategory] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [stock, setStock] = useState('');
  const [rating, setRating] = useState('');

  useEffect(() => {
    if (!open) return;
    setName(initialProduct?.name ?? '');
    setCategory(initialProduct?.category ?? '');
    setDescription(initialProduct?.description ?? '');
    setPrice(initialProduct?.price != null ? String(initialProduct.price) : '');
    setStock(initialProduct?.stock != null ? String(initialProduct.stock) : '');
    setRating(initialProduct?.rating != null ? String(initialProduct.rating) : '');
  }, [open, initialProduct]);

  if (!open) return null;

  const title = mode === 'edit' ? 'Редактирование товара' : 'Добавление товара';

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!name.trim()) return alert('Введите название');
    if (!category.trim()) return alert('Введите категорию');
    if (!description.trim()) return alert('Введите описание');
    const parsedPrice = Number(price);
    const parsedStock = Number(stock);
    if (!Number.isFinite(parsedPrice) || parsedPrice < 0) return alert('Введите корректную цену');
    if (!Number.isInteger(parsedStock) || parsedStock < 0) return alert('Введите корректное количество');
    const parsedRating = rating !== '' ? Number(rating) : null;
    if (parsedRating !== null && (parsedRating < 0 || parsedRating > 5)) return alert('Рейтинг от 0 до 5');

    onSubmit({
      id: initialProduct?.id,
      name: name.trim(),
      category: category.trim(),
      description: description.trim(),
      price: parsedPrice,
      stock: parsedStock,
      rating: parsedRating,
    });
  };

  return (
    <div className="backdrop" onMouseDown={onClose}>
      <div className="modal" onMouseDown={e => e.stopPropagation()} role="dialog" aria-modal="true">
        <div className="modal__header">
          <div className="modal__title">{title}</div>
          <button className="iconBtn" onClick={onClose}>✕</button>
        </div>
        <form className="form" onSubmit={handleSubmit}>
          <label className="label">
            Название
            <input className="input" value={name} onChange={e => setName(e.target.value)} placeholder="Например, iPhone 15" autoFocus />
          </label>
          <label className="label">
            Категория
            <input className="input" value={category} onChange={e => setCategory(e.target.value)} placeholder="Например, Смартфоны" />
          </label>
          <label className="label">
            Описание
            <textarea className="textarea" value={description} onChange={e => setDescription(e.target.value)} placeholder="Описание товара..." />
          </label>
          <div className="formRow">
            <label className="label">
              Цена (₽)
              <input className="input" value={price} onChange={e => setPrice(e.target.value)} placeholder="0" inputMode="numeric" />
            </label>
            <label className="label">
              На складе (шт.)
              <input className="input" value={stock} onChange={e => setStock(e.target.value)} placeholder="0" inputMode="numeric" />
            </label>
          </div>
          <label className="label">
            Рейтинг (0–5, необязательно)
            <input className="input" value={rating} onChange={e => setRating(e.target.value)} placeholder="Например, 4.8" inputMode="decimal" />
          </label>
          <div className="modal__footer">
            <button type="button" className="btn" onClick={onClose}>Отмена</button>
            <button type="submit" className="btn btn--primary">{mode === 'edit' ? 'Сохранить' : 'Добавить'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}
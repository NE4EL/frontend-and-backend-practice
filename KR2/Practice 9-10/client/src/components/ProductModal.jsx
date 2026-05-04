import React, { useEffect, useState } from 'react';

export default function ProductModal({ open, mode, initialProduct, onClose, onSubmit }) {
  const [form, setForm] = useState({ title: '', category: '', description: '', price: '' });

  useEffect(() => {
    if (!open) return;
    setForm({
      title: initialProduct?.title ?? '',
      category: initialProduct?.category ?? '',
      description: initialProduct?.description ?? '',
      price: initialProduct?.price != null ? String(initialProduct.price) : '',
    });
  }, [open, initialProduct]);

  if (!open) return null;

  const handleChange = (e) => {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.title.trim()) return alert('Введите название');
    if (!form.category.trim()) return alert('Введите категорию');
    if (!form.description.trim()) return alert('Введите описание');
    const price = Number(form.price);
    if (!Number.isFinite(price) || price < 0) return alert('Введите корректную цену');
    onSubmit({ id: initialProduct?.id, ...form, price });
  };

  return (
    <div className="backdrop" onMouseDown={onClose}>
      <div className="modal" onMouseDown={e => e.stopPropagation()}>
        <div className="modal__header">
          <div className="modal__title">
            {mode === 'edit' ? 'Редактирование товара' : 'Добавление товара'}
          </div>
          <button className="iconBtn" onClick={onClose}>✕</button>
        </div>
        <form className="form" onSubmit={handleSubmit}>
          <label className="label">
            Название
            <input className="input" name="title" value={form.title}
              onChange={handleChange} placeholder="iPhone 15 Pro" autoFocus />
          </label>
          <label className="label">
            Категория
            <input className="input" name="category" value={form.category}
              onChange={handleChange} placeholder="Смартфоны" />
          </label>
          <label className="label">
            Описание
            <textarea className="textarea" name="description" value={form.description}
              onChange={handleChange} placeholder="Описание товара..." />
          </label>
          <label className="label">
            Цена (₽)
            <input className="input" name="price" value={form.price}
              onChange={handleChange} placeholder="89990" inputMode="numeric" />
          </label>
          <div className="modal__footer">
            <button type="button" className="btn" onClick={onClose}>Отмена</button>
            <button type="submit" className="btn btn--primary">
              {mode === 'edit' ? 'Сохранить' : 'Добавить'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
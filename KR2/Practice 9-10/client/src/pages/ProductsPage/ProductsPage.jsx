import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../api';
import ProductModal from '../../components/ProductModal';
import './ProductsPage.scss';

export default function ProductsPage() {
  const navigate = useNavigate();
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState('create');
  const [editingProduct, setEditingProduct] = useState(null);
  const [detailProduct, setDetailProduct] = useState(null);

  useEffect(() => {
    loadAll();
  }, []);

  const loadAll = async () => {
    try {
      setLoading(true);
      const [productsRes, meRes] = await Promise.all([
        api.getProducts(),
        api.me(),
      ]);
      setProducts(productsRes.data);
      setUser(meRes.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    navigate('/login');
  };

  const openCreate = () => {
    setModalMode('create');
    setEditingProduct(null);
    setModalOpen(true);
  };

  const openEdit = (product) => {
    setModalMode('edit');
    setEditingProduct(product);
    setDetailProduct(null);
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setEditingProduct(null);
  };

  const handleDetail = async (id) => {
    try {
      const res = await api.getProductById(id);
      setDetailProduct(res.data);
    } catch (err) {
      alert('Ошибка загрузки товара');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Удалить товар?')) return;
    try {
      await api.deleteProduct(id);
      setProducts(prev => prev.filter(p => p.id !== id));
      if (detailProduct?.id === id) setDetailProduct(null);
    } catch (err) {
      alert('Ошибка удаления');
    }
  };

  const handleSubmitModal = async (payload) => {
    try {
      if (modalMode === 'create') {
        const res = await api.createProduct(payload);
        setProducts(prev => [...prev, res.data]);
      } else {
        const res = await api.updateProduct(payload.id, payload);
        setProducts(prev => prev.map(p => p.id === payload.id ? res.data : p));
        if (detailProduct?.id === payload.id) setDetailProduct(res.data);
      }
      closeModal();
    } catch (err) {
      alert('Ошибка сохранения');
    }
  };

  return (
    <div className="page">
      <header className="header">
        <div className="header__inner">
          <div className="brand">⚡ TechStore</div>
          <div className="header__right">
            {user && (
              <span className="userInfo">
                {user.first_name} {user.last_name}
              </span>
            )}
            <button className="btn btn--danger" onClick={handleLogout}>Выйти</button>
          </div>
        </div>
      </header>

      <main className="main">
        <div className="container">

          {/* Детальный просмотр */}
          {detailProduct && (
            <div className="detail">
              <div className="detail__header">
                <h2 className="detail__title">{detailProduct.title}</h2>
                <button className="iconBtn" onClick={() => setDetailProduct(null)}>✕</button>
              </div>
              <div className="detail__category">{detailProduct.category}</div>
              <div className="detail__desc">{detailProduct.description}</div>
              <div className="detail__price">{Number(detailProduct.price).toLocaleString('ru-RU')} ₽</div>
              <div className="detail__actions">
                <button className="btn" onClick={() => openEdit(detailProduct)}>Редактировать</button>
                <button className="btn btn--danger" onClick={() => handleDelete(detailProduct.id)}>Удалить</button>
              </div>
            </div>
          )}

          <div className="toolbar">
            <h1 className="title">Товары</h1>
            <button className="btn btn--primary" onClick={openCreate}>+ Добавить</button>
          </div>

          {loading ? (
            <div className="empty">Загрузка...</div>
          ) : products.length === 0 ? (
            <div className="empty">Товаров пока нет</div>
          ) : (
            <div className="grid">
              {products.map(p => (
                <div key={p.id} className="card">
                  <div className="card__category">{p.category}</div>
                  <div className="card__title">{p.title}</div>
                  <div className="card__desc">{p.description}</div>
                  <div className="card__price">{Number(p.price).toLocaleString('ru-RU')} ₽</div>
                  <div className="card__actions">
                    <button className="btn" onClick={() => handleDetail(p.id)}>Подробнее</button>
                    <button className="btn" onClick={() => openEdit(p)}>Изменить</button>
                    <button className="btn btn--danger" onClick={() => handleDelete(p.id)}>Удалить</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>

      <footer className="footer">
        <div className="footer__inner">© {new Date().getFullYear()} TechStore</div>
      </footer>

      <ProductModal
        open={modalOpen}
        mode={modalMode}
        initialProduct={editingProduct}
        onClose={closeModal}
        onSubmit={handleSubmitModal}
      />
    </div>
  );
}
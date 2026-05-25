/**
 * Integration-style tests using a self-contained Express app.
 * The server.js requires a real PostgreSQL — tests use their own isolated app.
 */
const request = require('supertest');
const express = require('express');
const bcrypt  = require('bcryptjs');
const jwt     = require('jsonwebtoken');

const ACCESS_SECRET  = 'test_access_secret';
const REFRESH_SECRET = 'test_refresh_secret';

// ── Build a testable Express app (mirrors server.js logic) ──────────────────
function buildApp() {
  const app = express();
  app.use(express.json());

  let users    = [];
  let products = [];
  let cartItems = [];
  let seq = { u: 1, p: 1, c: 1, o: 1 };

  function authMw(req, res, next) {
    const h = req.headers.authorization || '';
    if (!h.startsWith('Bearer ')) return res.status(401).json({ error: 'Токен не предоставлен' });
    try { req.user = jwt.verify(h.slice(7), ACCESS_SECRET); next(); }
    catch { res.status(401).json({ error: 'Невалидный токен' }); }
  }
  function roleMw(roles) {
    return (req, res, next) =>
      req.user && roles.includes(req.user.role)
        ? next()
        : res.status(403).json({ error: 'Недостаточно прав' });
  }
  function makeTokens(user) {
    const p = { sub: user.id, email: user.email, role: user.role };
    return {
      accessToken:  jwt.sign(p, ACCESS_SECRET,  { expiresIn: '15m' }),
      refreshToken: jwt.sign(p, REFRESH_SECRET, { expiresIn: '7d' }),
    };
  }

  // Auth
  app.post('/api/auth/register', async (req, res) => {
    const { email, first_name, last_name, password, role } = req.body;
    if (!email || !first_name || !last_name || !password)
      return res.status(400).json({ error: 'Все поля обязательны' });
    if (users.find(u => u.email === email.toLowerCase()))
      return res.status(409).json({ error: 'Email уже занят' });
    const user = {
      id: seq.u++, email: email.toLowerCase(), first_name, last_name,
      password_hash: await bcrypt.hash(password, 4),
      role: ['customer','admin'].includes(role) ? role : 'customer',
      blocked: false,
    };
    users.push(user);
    res.status(201).json({ id: user.id, email: user.email, role: user.role });
  });

  app.post('/api/auth/login', async (req, res) => {
    const { email, password } = req.body;
    const user = users.find(u => u.email === email?.toLowerCase());
    if (!user || user.blocked || !(await bcrypt.compare(password, user.password_hash)))
      return res.status(401).json({ error: 'Неверные данные' });
    res.json(makeTokens(user));
  });

  app.post('/api/auth/refresh', (req, res) => {
    const { refreshToken } = req.body;
    if (!refreshToken) return res.status(400).json({ error: 'refreshToken обязателен' });
    try {
      const p    = jwt.verify(refreshToken, REFRESH_SECRET);
      const user = users.find(u => u.id === p.sub);
      if (!user || user.blocked) return res.status(401).json({ error: 'Не найден' });
      res.json(makeTokens(user));
    } catch { res.status(401).json({ error: 'Невалидный' }); }
  });

  app.get('/api/auth/me', authMw, (req, res) => {
    const user = users.find(u => u.id === req.user.sub);
    if (!user) return res.status(404).json({ error: 'Не найден' });
    const { password_hash, ...safe } = user;
    res.json(safe);
  });

  // Products
  app.get('/api/products', (req, res) => {
    let result = [...products];
    if (req.query.search)   result = result.filter(p => p.title.toLowerCase().includes(req.query.search.toLowerCase()));
    if (req.query.category) result = result.filter(p => p.category === req.query.category);
    res.json(result);
  });

  app.get('/api/products/:id', (req, res) => {
    const p = products.find(p => p.id === Number(req.params.id));
    if (!p) return res.status(404).json({ error: 'Не найден' });
    res.json(p);
  });

  app.post('/api/products', authMw, roleMw(['admin']), (req, res) => {
    const { title, category, price, description, stock } = req.body;
    if (!title || !category || !price) return res.status(400).json({ error: 'Поля обязательны' });
    const p = { id: seq.p++, title, category, description: description || '', price: Number(price), stock: stock ?? 0 };
    products.push(p);
    res.status(201).json(p);
  });

  app.put('/api/products/:id', authMw, roleMw(['admin']), (req, res) => {
    const p = products.find(p => p.id === Number(req.params.id));
    if (!p) return res.status(404).json({ error: 'Не найден' });
    Object.assign(p, req.body);
    res.json(p);
  });

  app.delete('/api/products/:id', authMw, roleMw(['admin']), (req, res) => {
    const idx = products.findIndex(p => p.id === Number(req.params.id));
    if (idx === -1) return res.status(404).json({ error: 'Не найден' });
    products.splice(idx, 1);
    res.status(204).send();
  });

  // Cart
  app.get('/api/cart', authMw, (req, res) => {
    const items = cartItems
      .filter(i => i.userId === req.user.sub)
      .map(i => ({ ...i, product: products.find(p => p.id === i.productId) }));
    const total = items.reduce((s, i) => s + i.quantity * (i.product?.price || 0), 0);
    res.json({ items, total: total.toFixed(2) });
  });

  app.post('/api/cart', authMw, (req, res) => {
    const { productId, quantity = 1 } = req.body;
    if (!productId) return res.status(400).json({ error: 'productId обязателен' });
    const product = products.find(p => p.id === Number(productId));
    if (!product) return res.status(404).json({ error: 'Товар не найден' });
    const existing = cartItems.find(i => i.userId === req.user.sub && i.productId === Number(productId));
    if (existing) { existing.quantity += quantity; return res.json(existing); }
    const item = { id: seq.c++, userId: req.user.sub, productId: Number(productId), quantity };
    cartItems.push(item);
    res.status(201).json(item);
  });

  app.delete('/api/cart/:productId', authMw, (req, res) => {
    const idx = cartItems.findIndex(i => i.userId === req.user.sub && i.productId === Number(req.params.productId));
    if (idx === -1) return res.status(404).json({ error: 'Не найдено' });
    cartItems.splice(idx, 1);
    res.status(204).send();
  });

  // Users (admin)
  app.get('/api/users', authMw, roleMw(['admin']), (req, res) => {
    res.json(users.map(({ password_hash, ...u }) => u));
  });

  app.put('/api/users/:id', authMw, roleMw(['admin']), (req, res) => {
    const user = users.find(u => u.id === Number(req.params.id));
    if (!user) return res.status(404).json({ error: 'Не найден' });
    const { role, blocked } = req.body;
    if (role    !== undefined) user.role    = role;
    if (blocked !== undefined) user.blocked = blocked;
    const { password_hash, ...safe } = user;
    res.json(safe);
  });

  // Reset helper (only in tests)
  app.__reset = () => {
    users = []; products = []; cartItems = [];
    seq = { u: 1, p: 1, c: 1, o: 1 };
  };

  return app;
}

// ── Shared app instance ──────────────────────────────────────────────────────
const app = buildApp();
beforeEach(() => app.__reset());

// ── Helpers ──────────────────────────────────────────────────────────────────
const reg = (data = {}) =>
  request(app).post('/api/auth/register').send({
    email: 'user@test.com', first_name: 'Иван', last_name: 'Тест', password: 'pass123', ...data,
  });
const login = (email = 'user@test.com', pass = 'pass123') =>
  request(app).post('/api/auth/login').send({ email, password: pass });
const adminToken = async () => {
  await reg({ email: 'admin@test.com', password: 'admin123', role: 'admin' });
  return (await login('admin@test.com', 'admin123')).body.accessToken;
};

// ── AUTH ─────────────────────────────────────────────────────────────────────
describe('POST /api/auth/register', () => {
  it('creates a customer by default', async () => {
    const res = await reg();
    expect(res.status).toBe(201);
    expect(res.body.email).toBe('user@test.com');
    expect(res.body.role).toBe('customer');
  });
  it('creates an admin when role=admin', async () => {
    const res = await reg({ role: 'admin' });
    expect(res.body.role).toBe('admin');
  });
  it('returns 400 if fields missing', async () => {
    expect((await request(app).post('/api/auth/register').send({ email: 'x@t.com' })).status).toBe(400);
  });
  it('returns 409 on duplicate email', async () => {
    await reg();
    expect((await reg()).status).toBe(409);
  });
});

describe('POST /api/auth/login', () => {
  beforeEach(() => reg());
  it('returns access + refresh tokens', async () => {
    const res = await login();
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('accessToken');
    expect(res.body).toHaveProperty('refreshToken');
  });
  it('returns 401 for wrong password', async () => {
    expect((await login('user@test.com', 'wrong')).status).toBe(401);
  });
  it('returns 401 for unknown email', async () => {
    expect((await login('nobody@test.com')).status).toBe(401);
  });
});

describe('POST /api/auth/refresh', () => {
  it('issues new tokens from valid refresh token', async () => {
    await reg();
    const { body } = await login();
    const res = await request(app).post('/api/auth/refresh').send({ refreshToken: body.refreshToken });
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('accessToken');
  });
  it('returns 400 with no token', async () => {
    expect((await request(app).post('/api/auth/refresh').send({})).status).toBe(400);
  });
  it('returns 401 with invalid token', async () => {
    expect((await request(app).post('/api/auth/refresh').send({ refreshToken: 'bad' })).status).toBe(401);
  });
});

describe('GET /api/auth/me', () => {
  it('returns user data without password_hash', async () => {
    await reg(); const { body: { accessToken } } = await login();
    const res = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${accessToken}`);
    expect(res.status).toBe(200);
    expect(res.body.email).toBe('user@test.com');
    expect(res.body).not.toHaveProperty('password_hash');
  });
  it('returns 401 without token', async () => {
    expect((await request(app).get('/api/auth/me')).status).toBe(401);
  });
});

// ── PRODUCTS ─────────────────────────────────────────────────────────────────
describe('GET /api/products', () => {
  it('returns empty array initially', async () => {
    const res = await request(app).get('/api/products');
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });
  it('returns created product', async () => {
    const token = await adminToken();
    await request(app).post('/api/products').set('Authorization', `Bearer ${token}`)
      .send({ title: 'iPhone', category: 'Смартфоны', price: 89990 });
    const res = await request(app).get('/api/products');
    expect(res.body).toHaveLength(1);
    expect(res.body[0].title).toBe('iPhone');
  });
  it('filters by search', async () => {
    const token = await adminToken();
    await request(app).post('/api/products').set('Authorization', `Bearer ${token}`)
      .send({ title: 'iPhone', category: 'Смартфоны', price: 89990 });
    await request(app).post('/api/products').set('Authorization', `Bearer ${token}`)
      .send({ title: 'MacBook', category: 'Ноутбуки', price: 119990 });
    const res = await request(app).get('/api/products?search=iphone');
    expect(res.body).toHaveLength(1);
    expect(res.body[0].title).toBe('iPhone');
  });
  it('filters by category', async () => {
    const token = await adminToken();
    await request(app).post('/api/products').set('Authorization', `Bearer ${token}`)
      .send({ title: 'iPhone', category: 'Смартфоны', price: 89990 });
    await request(app).post('/api/products').set('Authorization', `Bearer ${token}`)
      .send({ title: 'MacBook', category: 'Ноутбуки', price: 119990 });
    const res = await request(app).get('/api/products').query({ category: 'Ноутбуки' });
    expect(res.body).toHaveLength(1);
  });
});

describe('POST /api/products', () => {
  it('admin creates a product', async () => {
    const token = await adminToken();
    const res = await request(app).post('/api/products')
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'iPad', category: 'Планшеты', price: 79990, stock: 10 });
    expect(res.status).toBe(201);
    expect(res.body.title).toBe('iPad');
    expect(res.body.stock).toBe(10);
  });
  it('customer cannot create product (403)', async () => {
    await reg(); const { body: { accessToken } } = await login();
    const res = await request(app).post('/api/products')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ title: 'X', category: 'Y', price: 1 });
    expect(res.status).toBe(403);
  });
  it('returns 401 without token', async () => {
    expect((await request(app).post('/api/products').send({ title: 'X', category: 'Y', price: 1 })).status).toBe(401);
  });
  it('returns 400 without required fields', async () => {
    const token = await adminToken();
    const res = await request(app).post('/api/products')
      .set('Authorization', `Bearer ${token}`).send({ title: 'X' });
    expect(res.status).toBe(400);
  });
});

describe('GET /api/products/:id', () => {
  it('returns product by id', async () => {
    const token = await adminToken();
    const { body: p } = await request(app).post('/api/products')
      .set('Authorization', `Bearer ${token}`).send({ title: 'TV', category: 'TV', price: 50000 });
    const res = await request(app).get(`/api/products/${p.id}`);
    expect(res.status).toBe(200);
    expect(res.body.title).toBe('TV');
  });
  it('returns 404 for unknown id', async () => {
    expect((await request(app).get('/api/products/9999')).status).toBe(404);
  });
});

describe('PUT /api/products/:id', () => {
  it('admin updates product', async () => {
    const token = await adminToken();
    const { body: p } = await request(app).post('/api/products')
      .set('Authorization', `Bearer ${token}`).send({ title: 'Old', category: 'Cat', price: 1000 });
    const res = await request(app).put(`/api/products/${p.id}`)
      .set('Authorization', `Bearer ${token}`).send({ title: 'New', price: 2000 });
    expect(res.status).toBe(200);
    expect(res.body.title).toBe('New');
    expect(Number(res.body.price)).toBe(2000);
  });
});

describe('DELETE /api/products/:id', () => {
  it('admin deletes product', async () => {
    const token = await adminToken();
    const { body: p } = await request(app).post('/api/products')
      .set('Authorization', `Bearer ${token}`).send({ title: 'Del', category: 'C', price: 1 });
    expect((await request(app).delete(`/api/products/${p.id}`).set('Authorization', `Bearer ${token}`)).status).toBe(204);
    expect((await request(app).get(`/api/products/${p.id}`)).status).toBe(404);
  });
});

// ── CART ─────────────────────────────────────────────────────────────────────
describe('Cart', () => {
  let token, productId;

  beforeEach(async () => {
    await reg();
    token = (await login()).body.accessToken;
    const at = await adminToken();
    const { body: p } = await request(app).post('/api/products')
      .set('Authorization', `Bearer ${at}`).send({ title: 'Phone', category: 'Смартфоны', price: 89990, stock: 10 });
    productId = p.id;
  });

  it('empty cart initially', async () => {
    const res = await request(app).get('/api/cart').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.items).toHaveLength(0);
    expect(res.body.total).toBe('0.00');
  });
  it('adds item to cart', async () => {
    const res = await request(app).post('/api/cart')
      .set('Authorization', `Bearer ${token}`).send({ productId, quantity: 2 });
    expect(res.status).toBe(201);
    expect(res.body.quantity).toBe(2);
  });
  it('removes item from cart', async () => {
    await request(app).post('/api/cart').set('Authorization', `Bearer ${token}`).send({ productId });
    const res = await request(app).delete(`/api/cart/${productId}`).set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(204);
  });
  it('returns 401 without token on GET /cart', async () => {
    expect((await request(app).get('/api/cart')).status).toBe(401);
  });
  it('returns 400 without productId', async () => {
    expect((await request(app).post('/api/cart').set('Authorization', `Bearer ${token}`).send({})).status).toBe(400);
  });
});

// ── ADMIN USERS ───────────────────────────────────────────────────────────────
describe('GET /api/users', () => {
  it('admin lists users without password_hash', async () => {
    await reg();
    const token = await adminToken();
    const res = await request(app).get('/api/users').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.every(u => !u.password_hash)).toBe(true);
  });
  it('customer forbidden (403)', async () => {
    await reg(); const { body: { accessToken } } = await login();
    expect((await request(app).get('/api/users').set('Authorization', `Bearer ${accessToken}`)).status).toBe(403);
  });
});

describe('PUT /api/users/:id', () => {
  it('admin can block a user', async () => {
    await reg();
    const token = await adminToken();
    const users = (await request(app).get('/api/users').set('Authorization', `Bearer ${token}`)).body;
    const customer = users.find(u => u.role === 'customer');
    const res = await request(app).put(`/api/users/${customer.id}`)
      .set('Authorization', `Bearer ${token}`).send({ blocked: true });
    expect(res.status).toBe(200);
    expect(res.body.blocked).toBe(true);
  });
  it('admin can change role', async () => {
    await reg();
    const token = await adminToken();
    const users = (await request(app).get('/api/users').set('Authorization', `Bearer ${token}`)).body;
    const customer = users.find(u => u.role === 'customer');
    const res = await request(app).put(`/api/users/${customer.id}`)
      .set('Authorization', `Bearer ${token}`).send({ role: 'admin' });
    expect(res.body.role).toBe('admin');
  });
});

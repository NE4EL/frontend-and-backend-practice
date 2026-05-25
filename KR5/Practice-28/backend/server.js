const express    = require('express');
const bcrypt     = require('bcryptjs');
const jwt        = require('jsonwebtoken');
const { Sequelize, DataTypes, Op } = require('sequelize');
const swaggerJsdoc = require('swagger-jsdoc');
const swaggerUi    = require('swagger-ui-express');
const path = require('path');

const app = express();
app.use(express.json());

// Serve built frontend
app.use(express.static(path.join(__dirname, '../frontend/dist')));

const PORT          = process.env.PORT           || 3000;
const ACCESS_SECRET = process.env.ACCESS_SECRET  || 'techstore_access_secret_kr5';
const REFRESH_SECRET= process.env.REFRESH_SECRET || 'techstore_refresh_secret_kr5';

// ===== DATABASE =====
const sequelize = new Sequelize(
  process.env.DB_NAME || 'kr5_techstore',
  process.env.DB_USER || process.env.USER || 'postgres',
  process.env.DB_PASS || '',
  {
    host:    process.env.DB_HOST || 'localhost',
    dialect: process.env.DB_DIALECT || 'postgres',
    logging: false,
  }
);

// ===== MODELS =====
const User = sequelize.define('User', {
  email:          { type: DataTypes.STRING, unique: true, allowNull: false },
  first_name:     { type: DataTypes.STRING, allowNull: false },
  last_name:      { type: DataTypes.STRING, allowNull: false },
  password_hash:  { type: DataTypes.STRING, allowNull: false },
  role:           { type: DataTypes.ENUM('customer', 'admin'), defaultValue: 'customer' },
  blocked:        { type: DataTypes.BOOLEAN, defaultValue: false },
}, { underscored: true });

const Product = sequelize.define('Product', {
  title:       { type: DataTypes.STRING, allowNull: false },
  category:    { type: DataTypes.STRING, allowNull: false },
  description: { type: DataTypes.TEXT },
  price:       { type: DataTypes.DECIMAL(10, 2), allowNull: false },
  stock:       { type: DataTypes.INTEGER, defaultValue: 0 },
}, { underscored: true });

const CartItem = sequelize.define('CartItem', {
  quantity: { type: DataTypes.INTEGER, defaultValue: 1 },
}, { underscored: true });

const Order = sequelize.define('Order', {
  total:  { type: DataTypes.DECIMAL(10, 2), allowNull: false },
  status: { type: DataTypes.ENUM('pending', 'confirmed', 'shipped', 'delivered', 'cancelled'), defaultValue: 'pending' },
}, { underscored: true });

const OrderItem = sequelize.define('OrderItem', {
  quantity:  { type: DataTypes.INTEGER, allowNull: false },
  unit_price: { type: DataTypes.DECIMAL(10, 2), allowNull: false },
}, { underscored: true });

// Associations
User.hasMany(CartItem);    CartItem.belongsTo(User);
Product.hasMany(CartItem); CartItem.belongsTo(Product);
User.hasMany(Order);       Order.belongsTo(User);
Order.hasMany(OrderItem);  OrderItem.belongsTo(Order);
Product.hasMany(OrderItem);OrderItem.belongsTo(Product);

// ===== MIDDLEWARE =====
function authMiddleware(req, res, next) {
  const header = req.headers.authorization || '';
  if (!header.startsWith('Bearer ')) return res.status(401).json({ error: 'Токен не предоставлен' });
  try {
    req.user = jwt.verify(header.slice(7), ACCESS_SECRET);
    next();
  } catch {
    res.status(401).json({ error: 'Невалидный или истёкший токен' });
  }
}

function roleMiddleware(roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role))
      return res.status(403).json({ error: 'Недостаточно прав' });
    next();
  };
}

function makeTokens(user) {
  const payload = { sub: user.id, email: user.email, role: user.role };
  return {
    accessToken:  jwt.sign(payload, ACCESS_SECRET,  { expiresIn: '15m' }),
    refreshToken: jwt.sign(payload, REFRESH_SECRET, { expiresIn: '7d' }),
  };
}

// ===== SWAGGER =====
const swaggerSpec = swaggerJsdoc({
  definition: {
    openapi: '3.0.0',
    info: { title: 'TechStore E-commerce API — Practice 28', version: '1.0.0',
      description: 'Финальный проект KR5: E-commerce с корзиной, заказами, JWT + RBAC (customer/admin). Расширение TechStore из KR2.' },
    servers: [{ url: `http://localhost:${PORT}` }],
    components: {
      securitySchemes: { bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' } },
    },
  },
  apis: ['./server.js'],
});
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// ===== AUTH =====
/**
 * @swagger
 * /api/auth/register:
 *   post:
 *     summary: Регистрация
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, first_name, last_name, password]
 *             properties:
 *               email: { type: string, example: "user@test.com" }
 *               first_name: { type: string, example: "Иван" }
 *               last_name:  { type: string, example: "Иванов" }
 *               password:   { type: string, example: "pass123" }
 *               role:       { type: string, enum: [customer, admin], example: "customer" }
 *     responses:
 *       201: { description: Пользователь создан }
 *       409: { description: Email занят }
 */
app.post('/api/auth/register', async (req, res) => {
  try {
    const { email, first_name, last_name, password, role } = req.body;
    if (!email || !first_name || !last_name || !password)
      return res.status(400).json({ error: 'Все поля обязательны' });
    const exists = await User.findOne({ where: { email: email.toLowerCase() } });
    if (exists) return res.status(409).json({ error: 'Email уже занят' });
    const password_hash = await bcrypt.hash(password, 10);
    const user = await User.create({
      email: email.toLowerCase(), first_name, last_name, password_hash,
      role: ['customer','admin'].includes(role) ? role : 'customer',
    });
    res.status(201).json({ id: user.id, email: user.email, role: user.role });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * @swagger
 * /api/auth/login:
 *   post:
 *     summary: Вход
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password]
 *             properties:
 *               email: { type: string, example: "admin@test.com" }
 *               password: { type: string, example: "admin123" }
 *     responses:
 *       200: { description: "{ accessToken, refreshToken }" }
 *       401: { description: Неверные данные }
 */
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ where: { email: email?.toLowerCase() } });
    if (!user || user.blocked || !(await bcrypt.compare(password, user.password_hash)))
      return res.status(401).json({ error: 'Неверные данные или аккаунт заблокирован' });
    res.json(makeTokens(user));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/auth/refresh', async (req, res) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) return res.status(400).json({ error: 'refreshToken обязателен' });
    const payload = jwt.verify(refreshToken, REFRESH_SECRET);
    const user    = await User.findByPk(payload.sub);
    if (!user || user.blocked) return res.status(401).json({ error: 'Пользователь не найден' });
    res.json(makeTokens(user));
  } catch {
    res.status(401).json({ error: 'Невалидный refreshToken' });
  }
});

app.get('/api/auth/me', authMiddleware, async (req, res) => {
  const user = await User.findByPk(req.user.sub, { attributes: { exclude: ['password_hash'] } });
  if (!user) return res.status(404).json({ error: 'Не найден' });
  res.json(user);
});

// ===== PRODUCTS =====
/**
 * @swagger
 * /api/products:
 *   get:
 *     summary: Список товаров (с фильтрами)
 *     tags: [Products]
 *     parameters:
 *       - in: query
 *         name: search
 *         schema: { type: string }
 *       - in: query
 *         name: category
 *         schema: { type: string }
 *     responses:
 *       200: { description: Список товаров }
 */
app.get('/api/products', async (req, res) => {
  try {
    const where = {};
    if (req.query.search) {
      where[Op.or] = [
        { title:       { [Op.iLike]: `%${req.query.search}%` } },
        { description: { [Op.iLike]: `%${req.query.search}%` } },
      ];
    }
    if (req.query.category) where.category = req.query.category;
    const products = await Product.findAll({ where, order: [['id', 'ASC']] });
    res.json(products);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/products/:id', async (req, res) => {
  const p = await Product.findByPk(req.params.id);
  if (!p) return res.status(404).json({ error: 'Товар не найден' });
  res.json(p);
});

app.post('/api/products', authMiddleware, roleMiddleware(['admin']), async (req, res) => {
  try {
    const { title, category, description, price, stock } = req.body;
    if (!title || !category || !price) return res.status(400).json({ error: 'title, category, price обязательны' });
    const p = await Product.create({ title, category, description, price, stock: stock ?? 0 });
    res.status(201).json(p);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/products/:id', authMiddleware, roleMiddleware(['admin']), async (req, res) => {
  try {
    const p = await Product.findByPk(req.params.id);
    if (!p) return res.status(404).json({ error: 'Товар не найден' });
    await p.update(req.body);
    res.json(p);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/products/:id', authMiddleware, roleMiddleware(['admin']), async (req, res) => {
  const p = await Product.findByPk(req.params.id);
  if (!p) return res.status(404).json({ error: 'Товар не найден' });
  await p.destroy();
  res.status(204).send();
});

// ===== CART =====
app.get('/api/cart', authMiddleware, async (req, res) => {
  const items = await CartItem.findAll({
    where: { UserId: req.user.sub },
    include: [{ model: Product, attributes: ['id','title','category','price','stock'] }],
  });
  const total = items.reduce((s, i) => s + i.quantity * parseFloat(i.Product.price), 0);
  res.json({ items, total: total.toFixed(2) });
});

app.post('/api/cart', authMiddleware, async (req, res) => {
  try {
    const { productId, quantity = 1 } = req.body;
    if (!productId) return res.status(400).json({ error: 'productId обязателен' });
    const product = await Product.findByPk(productId);
    if (!product) return res.status(404).json({ error: 'Товар не найден' });
    if (product.stock < quantity) return res.status(400).json({ error: 'Недостаточно товара на складе' });

    const [item, created] = await CartItem.findOrCreate({
      where: { UserId: req.user.sub, ProductId: productId },
      defaults: { quantity },
    });
    if (!created) await item.update({ quantity: item.quantity + quantity });
    res.status(created ? 201 : 200).json(item);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/cart/:productId', authMiddleware, async (req, res) => {
  const item = await CartItem.findOne({ where: { UserId: req.user.sub, ProductId: req.params.productId } });
  if (!item) return res.status(404).json({ error: 'Не найдено в корзине' });
  const qty = Number(req.body.quantity);
  if (qty <= 0) { await item.destroy(); return res.status(204).send(); }
  await item.update({ quantity: qty });
  res.json(item);
});

app.delete('/api/cart/:productId', authMiddleware, async (req, res) => {
  const item = await CartItem.findOne({ where: { UserId: req.user.sub, ProductId: req.params.productId } });
  if (!item) return res.status(404).json({ error: 'Не найдено в корзине' });
  await item.destroy();
  res.status(204).send();
});

// ===== ORDERS =====
app.get('/api/orders', authMiddleware, async (req, res) => {
  const where = req.user.role === 'admin' ? {} : { UserId: req.user.sub };
  const orders = await Order.findAll({
    where,
    include: [{ model: OrderItem, include: [{ model: Product, attributes: ['id','title','category'] }] }],
    order: [['created_at', 'DESC']],
  });
  res.json(orders);
});

app.post('/api/orders', authMiddleware, async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const cartItems = await CartItem.findAll({
      where: { UserId: req.user.sub },
      include: [Product],
      transaction: t,
    });
    if (!cartItems.length) { await t.rollback(); return res.status(400).json({ error: 'Корзина пуста' }); }

    let total = 0;
    for (const item of cartItems) {
      if (item.Product.stock < item.quantity) {
        await t.rollback();
        return res.status(400).json({ error: `Недостаточно товара: ${item.Product.title}` });
      }
      total += item.quantity * parseFloat(item.Product.price);
    }

    const order = await Order.create({ UserId: req.user.sub, total }, { transaction: t });

    for (const item of cartItems) {
      await OrderItem.create({
        OrderId: order.id, ProductId: item.ProductId,
        quantity: item.quantity, unit_price: item.Product.price,
      }, { transaction: t });
      await item.Product.update({ stock: item.Product.stock - item.quantity }, { transaction: t });
    }

    await CartItem.destroy({ where: { UserId: req.user.sub }, transaction: t });
    await t.commit();

    const full = await Order.findByPk(order.id, {
      include: [{ model: OrderItem, include: [{ model: Product, attributes: ['id','title'] }] }],
    });
    res.status(201).json(full);
  } catch (err) {
    await t.rollback();
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/orders/:id/status', authMiddleware, roleMiddleware(['admin']), async (req, res) => {
  const order = await Order.findByPk(req.params.id);
  if (!order) return res.status(404).json({ error: 'Заказ не найден' });
  await order.update({ status: req.body.status });
  res.json(order);
});

// ===== ADMIN: USERS =====
app.get('/api/users', authMiddleware, roleMiddleware(['admin']), async (req, res) => {
  const users = await User.findAll({ attributes: { exclude: ['password_hash'] }, order: [['id','ASC']] });
  res.json(users);
});

app.put('/api/users/:id', authMiddleware, roleMiddleware(['admin']), async (req, res) => {
  const user = await User.findByPk(req.params.id);
  if (!user) return res.status(404).json({ error: 'Не найден' });
  const { role, blocked } = req.body;
  if (role    !== undefined) user.role    = role;
  if (blocked !== undefined) user.blocked = blocked;
  await user.save();
  res.json({ id: user.id, email: user.email, role: user.role, blocked: user.blocked });
});

// Catch-all for SPA routing
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/dist/index.html'));
});

// ===== INIT =====
async function init() {
  await sequelize.authenticate();
  await sequelize.sync({ alter: false, force: false });

  const adminExists = await User.findOne({ where: { role: 'admin' } });
  if (!adminExists) {
    await User.create({
      email: 'admin@techstore.com', first_name: 'Admin', last_name: 'TechStore',
      password_hash: await bcrypt.hash('admin123', 10), role: 'admin',
    });
    console.log('Создан admin@techstore.com / admin123');
  }

  const count = await Product.count();
  if (count === 0) {
    await Product.bulkCreate([
      { title: 'iPhone 15 Pro',    category: 'Смартфоны',  description: 'Apple iPhone 15 Pro 256GB',         price: 89990, stock: 50 },
      { title: 'MacBook Air M3',   category: 'Ноутбуки',   description: 'Apple MacBook Air 13" M3 256GB',   price: 119990, stock: 30 },
      { title: 'Sony WH-1000XM5', category: 'Наушники',   description: 'Беспроводные наушники с ANC',       price: 29990, stock: 100 },
      { title: 'iPad Pro 13"',     category: 'Планшеты',   description: 'Apple iPad Pro 13" M4 256GB Wi-Fi',price: 109990, stock: 25 },
      { title: 'Samsung 4K TV',    category: 'Телевизоры', description: 'Samsung QLED 55" 4K Smart TV',      price: 79990, stock: 15 },
    ]);
    console.log('Стартовые товары добавлены');
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`TechStore E-commerce API запущен на порту ${PORT}`);
    console.log(`  Swagger: http://localhost:${PORT}/api-docs`);
    console.log(`  Фронтенд: http://localhost:${PORT}/`);
  });
}

init().catch(err => { console.error('Ошибка запуска:', err.message); process.exit(1); });

module.exports = { app, sequelize };

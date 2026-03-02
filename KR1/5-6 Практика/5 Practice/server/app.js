const express = require('express');
const { nanoid } = require('nanoid');
const cors = require('cors');
const swaggerJsdoc = require('swagger-jsdoc');
const swaggerUi = require('swagger-ui-express');

const app = express();
const port = 3000;

app.use(express.json());

app.use(cors({
  origin: 'http://localhost:3001',
  methods: ['GET', 'POST', 'PATCH', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

app.use((req, res, next) => {
  res.on('finish', () => {
    console.log(`[${new Date().toISOString()}] [${req.method}] ${res.statusCode} ${req.path}`);
    if (['POST', 'PUT', 'PATCH'].includes(req.method)) {
      console.log('Body:', req.body);
    }
  });
  next();
});

let products = [
  { id: nanoid(6), name: 'iPhone 15 Pro', category: 'Смартфоны', description: 'Apple iPhone 15 Pro 256GB, титановый корпус, камера 48 Мп', price: 89990, stock: 15, rating: 4.9, image: 'https://images.unsplash.com/photo-1695048133142-1a20484d2569?w=400&q=80' },
  { id: nanoid(6), name: 'Samsung Galaxy S24', category: 'Смартфоны', description: 'Samsung Galaxy S24 128GB, AMOLED дисплей, Snapdragon 8 Gen 3', price: 74990, stock: 20, rating: 4.7, image: 'https://images.unsplash.com/photo-1610945415295-d9bbf067e59c?w=400&q=80' },
  { id: nanoid(6), name: 'MacBook Air M3', category: 'Ноутбуки', description: 'Apple MacBook Air 13" M3, 8GB RAM, 256GB SSD', price: 119990, stock: 8, rating: 4.8, image: 'https://images.unsplash.com/photo-1517336714731-489689fd1ca8?w=400&q=80' },
  { id: nanoid(6), name: 'ASUS ROG Zephyrus G14', category: 'Ноутбуки', description: 'Игровой ноутбук, AMD Ryzen 9, RTX 4060, 16GB RAM', price: 109990, stock: 5, rating: 4.6, image: 'https://images.unsplash.com/photo-1603302576837-37561b2e2302?w=400&q=80' },
  { id: nanoid(6), name: 'Sony WH-1000XM5', category: 'Наушники', description: 'Беспроводные наушники с ANC, до 30 часов работы', price: 29990, stock: 30, rating: 4.8, image: 'https://images.unsplash.com/photo-1618366712010-f4ae9c647dcb?w=400&q=80' },
  { id: nanoid(6), name: 'AirPods Pro 2', category: 'Наушники', description: 'Apple AirPods Pro 2-го поколения, активное шумоподавление', price: 24990, stock: 25, rating: 4.7, image: 'https://images.unsplash.com/photo-1606841837239-c5a1a4a07af7?w=400&q=80' },
  { id: nanoid(6), name: 'iPad Air M2', category: 'Планшеты', description: 'Apple iPad Air 11" M2, 128GB, Wi-Fi', price: 69990, stock: 12, rating: 4.8, image: 'https://images.unsplash.com/photo-1544244015-0df4b3ffc6b0?w=400&q=80' },
  { id: nanoid(6), name: 'Samsung Galaxy Tab S9', category: 'Планшеты', description: 'Samsung Galaxy Tab S9, 256GB, AMOLED 11"', price: 59990, stock: 10, rating: 4.5, image: 'https://images.unsplash.com/photo-1561154464-82e9adf32764?w=400&q=80' },
  { id: nanoid(6), name: 'Apple Watch Series 9', category: 'Умные часы', description: 'Apple Watch Series 9 45mm, GPS, корпус из алюминия', price: 39990, stock: 18, rating: 4.7, image: 'https://images.unsplash.com/photo-1546868871-7041f2a55e12?w=400&q=80' },
  { id: nanoid(6), name: 'Sony PlayStation 5', category: 'Игровые консоли', description: 'Sony PS5 с дисководом, 825GB SSD, 4K HDR', price: 54990, stock: 3, rating: 4.9, image: 'https://images.unsplash.com/photo-1607853202273-797f1c22a38e?w=400&q=80' },
  { id: nanoid(6), name: 'Xiaomi 14', category: 'Смартфоны', description: 'Xiaomi 14 256GB, Leica камера, Snapdragon 8 Gen 3', price: 64990, stock: 14, rating: 4.6, image: 'https://images.unsplash.com/photo-1598327105666-5b89351aff97?w=400&q=80' },
];

// ===== SWAGGER SETUP =====
const swaggerOptions = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'API интернет-магазина',
      version: '1.0.0',
      description: 'API для управления товарами интернет-магазина электроники',
    },
    servers: [
      {
        url: `http://localhost:${port}`,
        description: 'Локальный сервер',
      },
    ],
  },
  apis: ['./app.js'],
};

const swaggerSpec = swaggerJsdoc(swaggerOptions);
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

/**
 * @swagger
 * components:
 *   schemas:
 *     Product:
 *       type: object
 *       required:
 *         - name
 *         - category
 *         - description
 *         - price
 *         - stock
 *       properties:
 *         id:
 *           type: string
 *           description: Автоматически сгенерированный уникальный ID товара
 *         name:
 *           type: string
 *           description: Название товара
 *         category:
 *           type: string
 *           description: Категория товара
 *         description:
 *           type: string
 *           description: Описание товара
 *         price:
 *           type: number
 *           description: Цена товара в рублях
 *         stock:
 *           type: integer
 *           description: Количество товара на складе
 *         rating:
 *           type: number
 *           description: Рейтинг товара от 0 до 5
 *           nullable: true
 *         image:
 *           type: string
 *           description: URL изображения товара
 *           nullable: true
 *       example:
 *         id: "abc123"
 *         name: "iPhone 15 Pro"
 *         category: "Смартфоны"
 *         description: "Apple iPhone 15 Pro 256GB"
 *         price: 89990
 *         stock: 15
 *         rating: 4.9
 *         image: "https://images.unsplash.com/photo-1695048133142-1a20484d2569?w=400&q=80"
 */

function findProductOr404(id, res) {
  const product = products.find(p => p.id === id);
  if (!product) {
    res.status(404).json({ error: 'Product not found' });
    return null;
  }
  return product;
}

/**
 * @swagger
 * /api/products:
 *   get:
 *     summary: Возвращает список всех товаров
 *     tags: [Products]
 *     responses:
 *       200:
 *         description: Список всех товаров
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Product'
 */
app.get('/api/products', (req, res) => {
  res.json(products);
});

/**
 * @swagger
 * /api/products/{id}:
 *   get:
 *     summary: Получает товар по ID
 *     tags: [Products]
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: string
 *         required: true
 *         description: ID товара
 *     responses:
 *       200:
 *         description: Данные товара
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Product'
 *       404:
 *         description: Товар не найден
 */
app.get('/api/products/:id', (req, res) => {
  const product = findProductOr404(req.params.id, res);
  if (!product) return;
  res.json(product);
});

/**
 * @swagger
 * /api/products:
 *   post:
 *     summary: Создаёт новый товар
 *     tags: [Products]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - category
 *               - description
 *               - price
 *               - stock
 *             properties:
 *               name:
 *                 type: string
 *               category:
 *                 type: string
 *               description:
 *                 type: string
 *               price:
 *                 type: number
 *               stock:
 *                 type: integer
 *               rating:
 *                 type: number
 *                 nullable: true
 *     responses:
 *       201:
 *         description: Товар успешно создан
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Product'
 *       400:
 *         description: Отсутствуют обязательные поля
 */
app.post('/api/products', (req, res) => {
  const { name, category, description, price, stock, rating } = req.body;
  if (!name || !category || !description || price === undefined || stock === undefined) {
    return res.status(400).json({ error: 'Missing required fields' });
  }
  const newProduct = {
    id: nanoid(6),
    name: name.trim(),
    category: category.trim(),
    description: description.trim(),
    price: Number(price),
    stock: Number(stock),
    rating: rating !== undefined ? Number(rating) : null,
  };
  products.push(newProduct);
  res.status(201).json(newProduct);
});

/**
 * @swagger
 * /api/products/{id}:
 *   patch:
 *     summary: Обновляет данные товара
 *     tags: [Products]
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: string
 *         required: true
 *         description: ID товара
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               category:
 *                 type: string
 *               description:
 *                 type: string
 *               price:
 *                 type: number
 *               stock:
 *                 type: integer
 *               rating:
 *                 type: number
 *                 nullable: true
 *     responses:
 *       200:
 *         description: Обновлённый товар
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Product'
 *       404:
 *         description: Товар не найден
 */
app.patch('/api/products/:id', (req, res) => {
  const product = findProductOr404(req.params.id, res);
  if (!product) return;

  const { name, category, description, price, stock, rating } = req.body;
  if (name !== undefined) product.name = name.trim();
  if (category !== undefined) product.category = category.trim();
  if (description !== undefined) product.description = description.trim();
  if (price !== undefined) product.price = Number(price);
  if (stock !== undefined) product.stock = Number(stock);
  if (rating !== undefined) product.rating = Number(rating);

  res.json(product);
});

/**
 * @swagger
 * /api/products/{id}:
 *   delete:
 *     summary: Удаляет товар
 *     tags: [Products]
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: string
 *         required: true
 *         description: ID товара
 *     responses:
 *       204:
 *         description: Товар успешно удалён (нет тела ответа)
 *       404:
 *         description: Товар не найден
 */
app.delete('/api/products/:id', (req, res) => {
  const exists = products.some(p => p.id === req.params.id);
  if (!exists) return res.status(404).json({ error: 'Product not found' });
  products = products.filter(p => p.id !== req.params.id);
  res.status(204).send();
});

app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(port, () => {
  console.log(`Сервер запущен на http://localhost:${port}`);
  console.log(`Swagger UI доступен по адресу http://localhost:${port}/api-docs`);
});
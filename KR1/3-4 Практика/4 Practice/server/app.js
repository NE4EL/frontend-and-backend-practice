// server/app.js
const express = require('express');
const { nanoid } = require('nanoid');
const cors = require('cors');

const app = express();
const port = 3000;

let products = [
  { id: nanoid(6), name: 'iPhone 15 Pro', category: 'Смартфоны', description: 'Apple iPhone 15 Pro 256GB, титановый корпус, камера 48 Мп', price: 89990, stock: 15, rating: 4.9 },
  { id: nanoid(6), name: 'Samsung Galaxy S24', category: 'Смартфоны', description: 'Samsung Galaxy S24 128GB, AMOLED дисплей, Snapdragon 8 Gen 3', price: 74990, stock: 20, rating: 4.7 },
  { id: nanoid(6), name: 'MacBook Air M3', category: 'Ноутбуки', description: 'Apple MacBook Air 13" M3, 8GB RAM, 256GB SSD', price: 119990, stock: 8, rating: 4.8 },
  { id: nanoid(6), name: 'ASUS ROG Zephyrus G14', category: 'Ноутбуки', description: 'Игровой ноутбук, AMD Ryzen 9, RTX 4060, 16GB RAM', price: 109990, stock: 5, rating: 4.6 },
  { id: nanoid(6), name: 'Sony WH-1000XM5', category: 'Наушники', description: 'Беспроводные наушники с ANC, до 30 часов работы', price: 29990, stock: 30, rating: 4.8 },
  { id: nanoid(6), name: 'AirPods Pro 2', category: 'Наушники', description: 'Apple AirPods Pro 2-го поколения, активное шумоподавление', price: 24990, stock: 25, rating: 4.7 },
  { id: nanoid(6), name: 'iPad Air M2', category: 'Планшеты', description: 'Apple iPad Air 11" M2, 128GB, Wi-Fi', price: 69990, stock: 12, rating: 4.8 },
  { id: nanoid(6), name: 'Samsung Galaxy Tab S9', category: 'Планшеты', description: 'Samsung Galaxy Tab S9, 256GB, AMOLED 11"', price: 59990, stock: 10, rating: 4.5 },
  { id: nanoid(6), name: 'Apple Watch Series 9', category: 'Умные часы', description: 'Apple Watch Series 9 45mm, GPS, корпус из алюминия', price: 39990, stock: 18, rating: 4.7 },
  { id: nanoid(6), name: 'Sony PlayStation 5', category: 'Игровые консоли', description: 'Sony PS5 с дисководом, 825GB SSD, 4K HDR', price: 54990, stock: 3, rating: 4.9 },
  { id: nanoid(6), name: 'Xiaomi 14', category: 'Смартфоны', description: 'Xiaomi 14 256GB, Leica камера, Snapdragon 8 Gen 3', price: 64990, stock: 14, rating: 4.6 },
];

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

function findProductOr404(id, res) {
  const product = products.find(p => p.id === id);
  if (!product) {
    res.status(404).json({ error: 'Product not found' });
    return null;
  }
  return product;
}

// GET /api/products
app.get('/api/products', (req, res) => {
  res.json(products);
});

// GET /api/products/:id
app.get('/api/products/:id', (req, res) => {
  const product = findProductOr404(req.params.id, res);
  if (!product) return;
  res.json(product);
});

// POST /api/products
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

// PATCH /api/products/:id
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

// DELETE /api/products/:id
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
});
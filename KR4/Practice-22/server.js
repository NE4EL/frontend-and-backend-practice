const express = require('express');

const app = express();
app.use(express.json());

const PORT      = process.env.PORT      || 3000;
const SERVER_ID = process.env.SERVER_ID || '1';

const products = [
    { id: 1, title: 'iPhone 15 Pro',    category: 'Смартфоны',  description: 'Apple iPhone 15 Pro 256GB',          price: 89990 },
    { id: 2, title: 'MacBook Air M3',   category: 'Ноутбуки',   description: 'Apple MacBook Air 13" M3 256GB',    price: 119990 },
    { id: 3, title: 'Sony WH-1000XM5', category: 'Наушники',   description: 'Беспроводные наушники с ANC',        price: 29990 },
    { id: 4, title: 'iPad Pro 13"',     category: 'Планшеты',   description: 'Apple iPad Pro 13" M4 256GB Wi-Fi', price: 109990 },
    { id: 5, title: 'Samsung 4K TV',    category: 'Телевизоры', description: 'Samsung QLED 55" 4K Smart TV',       price: 79990 },
];

app.get('/', (req, res) => {
    res.json({ message: 'TechStore API', server: `backend-${SERVER_ID}`, port: PORT });
});

app.get('/api/products', (req, res) => {
    res.json({ server: `backend-${SERVER_ID}`, data: products });
});

app.get('/api/products/:id', (req, res) => {
    const product = products.find(p => p.id === Number(req.params.id));
    if (!product) return res.status(404).json({ error: 'Product not found' });
    res.json({ server: `backend-${SERVER_ID}`, data: product });
});

app.get('/health', (req, res) => {
    res.json({ status: 'ok', server: `backend-${SERVER_ID}` });
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`TechStore Backend-${SERVER_ID} запущен на порту ${PORT}`);
});

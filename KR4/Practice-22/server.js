const express = require('express');
const swaggerJsdoc = require('swagger-jsdoc');
const swaggerUi    = require('swagger-ui-express');

const app = express();
app.use(express.json());

const PORT      = process.env.PORT      || 3000;
const SERVER_ID = process.env.SERVER_ID || '1';

const swaggerSpec = swaggerJsdoc({
    definition: {
        openapi: '3.0.0',
        info: { title: `TechStore API — Practice 22 (Nginx LB, backend-${SERVER_ID})`, version: '1.0.0', description: 'Один из backend-серверов за Nginx балансировщиком. Каждый запрос отвечает с указанием имени сервера.' },
        servers: [{ url: `http://localhost:${PORT}` }, { url: 'http://localhost:8080', description: 'Через Nginx (docker compose)' }],
    },
    apis: ['./server.js'],
});
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

const products = [
    { id: 1, title: 'iPhone 15 Pro',    category: 'Смартфоны',  description: 'Apple iPhone 15 Pro 256GB',          price: 89990 },
    { id: 2, title: 'MacBook Air M3',   category: 'Ноутбуки',   description: 'Apple MacBook Air 13" M3 256GB',    price: 119990 },
    { id: 3, title: 'Sony WH-1000XM5', category: 'Наушники',   description: 'Беспроводные наушники с ANC',        price: 29990 },
    { id: 4, title: 'iPad Pro 13"',     category: 'Планшеты',   description: 'Apple iPad Pro 13" M4 256GB Wi-Fi', price: 109990 },
    { id: 5, title: 'Samsung 4K TV',    category: 'Телевизоры', description: 'Samsung QLED 55" 4K Smart TV',       price: 79990 },
];

/**
 * @swagger
 * /:
 *   get:
 *     summary: Информация о сервере
 *     tags: [Info]
 *     responses:
 *       200:
 *         description: "{ message, server, port } — показывает какой backend ответил"
 * /api/products:
 *   get:
 *     summary: Список товаров TechStore
 *     tags: [Products]
 *     responses:
 *       200:
 *         description: "{ server: backend-N, data: [...] } — server показывает кто ответил"
 * /api/products/{id}:
 *   get:
 *     summary: Товар по ID
 *     tags: [Products]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200: { description: Данные товара }
 *       404: { description: Не найден }
 * /health:
 *   get:
 *     summary: Health check (используется Nginx)
 *     tags: [Info]
 *     responses:
 *       200: { description: "{ status: ok, server: backend-N }" }
 */
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

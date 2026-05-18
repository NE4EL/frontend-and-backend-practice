const express = require('express');

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 8000;

const products = {
    1: { id: 1, title: 'iPhone 15 Pro',    category: 'Смартфоны',  description: 'Apple iPhone 15 Pro 256GB',          price: 89990 },
    2: { id: 2, title: 'MacBook Air M3',   category: 'Ноутбуки',   description: 'Apple MacBook Air 13" M3 256GB',    price: 119990 },
    3: { id: 3, title: 'Sony WH-1000XM5', category: 'Наушники',   description: 'Беспроводные наушники с ANC',        price: 29990 },
    4: { id: 4, title: 'iPad Pro 13"',     category: 'Планшеты',   description: 'Apple iPad Pro 13" M4 256GB Wi-Fi', price: 109990 },
    5: { id: 5, title: 'Samsung 4K TV',    category: 'Телевизоры', description: 'Samsung QLED 55" 4K Smart TV',       price: 79990 },
};
let nextId = 6;

app.get('/products', (req, res) => {
    const { category } = req.query;
    let result = Object.values(products);
    if (category) result = result.filter(p => p.category === category);
    res.json(result);
});

app.get('/products/:id', (req, res) => {
    const product = products[req.params.id];
    if (!product) return res.status(404).json({ error: 'Product not found' });
    res.json(product);
});

app.post('/products', (req, res) => {
    const { title, category, description, price } = req.body;
    if (!title || !category || !description || price === undefined) return res.status(400).json({ error: 'Все поля обязательны' });
    const id = nextId++;
    products[id] = { id, title, category, description, price: Number(price) };
    res.status(201).json(products[id]);
});

app.put('/products/:id', (req, res) => {
    const product = products[req.params.id];
    if (!product) return res.status(404).json({ error: 'Product not found' });
    const { title, category, description, price } = req.body;
    if (title       !== undefined) product.title       = title;
    if (category    !== undefined) product.category    = category;
    if (description !== undefined) product.description = description;
    if (price       !== undefined) product.price       = Number(price);
    res.json(product);
});

app.delete('/products/:id', (req, res) => {
    const product = products[req.params.id];
    if (!product) return res.status(404).json({ error: 'Product not found' });
    delete products[req.params.id];
    res.status(204).send();
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`Products service running on port ${PORT}`);
});

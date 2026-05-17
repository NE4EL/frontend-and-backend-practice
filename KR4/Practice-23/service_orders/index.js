const express = require('express');

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 8000;

const orders = {};
let nextId = 1;

app.get('/orders', (req, res) => {
    const { userId } = req.query;
    let result = Object.values(orders);
    if (userId) result = result.filter(o => String(o.userId) === String(userId));
    res.json(result);
});

app.get('/orders/:id', (req, res) => {
    const order = orders[req.params.id];
    if (!order) return res.status(404).json({ error: 'Order not found' });
    res.json(order);
});

app.post('/orders', (req, res) => {
    const { userId, product, price } = req.body;
    if (!userId || !product || price === undefined) return res.status(400).json({ error: 'userId, product and price required' });
    const id = nextId++;
    orders[id] = { id, userId, product, price: Number(price), createdAt: new Date().toISOString() };
    res.status(201).json(orders[id]);
});

app.put('/orders/:id', (req, res) => {
    const order = orders[req.params.id];
    if (!order) return res.status(404).json({ error: 'Order not found' });
    const { product, price } = req.body;
    if (product) order.product = product;
    if (price !== undefined) order.price = Number(price);
    res.json(order);
});

app.delete('/orders/:id', (req, res) => {
    const order = orders[req.params.id];
    if (!order) return res.status(404).json({ error: 'Order not found' });
    delete orders[req.params.id];
    res.json({ message: 'Order deleted' });
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`Orders service running on port ${PORT}`);
});

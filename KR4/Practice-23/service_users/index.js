const express = require('express');

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 8000;

const users = {};
let nextId = 1;

app.get('/users', (req, res) => {
    res.json(Object.values(users));
});

app.get('/users/:id', (req, res) => {
    const user = users[req.params.id];
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json(user);
});

app.post('/users', (req, res) => {
    const { name, email } = req.body;
    if (!name || !email) return res.status(400).json({ error: 'name and email required' });
    const id = nextId++;
    users[id] = { id, name, email, createdAt: new Date().toISOString() };
    res.status(201).json(users[id]);
});

app.put('/users/:id', (req, res) => {
    const user = users[req.params.id];
    if (!user) return res.status(404).json({ error: 'User not found' });
    const { name, email } = req.body;
    if (name)  user.name  = name;
    if (email) user.email = email;
    res.json(user);
});

app.delete('/users/:id', (req, res) => {
    const user = users[req.params.id];
    if (!user) return res.status(404).json({ error: 'User not found' });
    delete users[req.params.id];
    res.json({ message: 'User deleted' });
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`Users service running on port ${PORT}`);
});

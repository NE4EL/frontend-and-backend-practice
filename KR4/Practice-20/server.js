const express = require('express');
const mongoose = require('mongoose');

const app = express();
app.use(express.json());

const MONGO_URL = process.env.MONGO_URL || 'mongodb://localhost:27017/kr4_p20';
const PORT = process.env.PORT || 3001;

const userSchema = new mongoose.Schema({
    first_name: { type: String, required: true, trim: true },
    last_name:  { type: String, required: true, trim: true },
    age:        { type: Number, required: true, min: 0 },
}, {
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
});

const User = mongoose.model('User', userSchema);

// POST /api/users
app.post('/api/users', async (req, res) => {
    const { first_name, last_name, age } = req.body;
    if (!first_name || !last_name || age === undefined) {
        return res.status(400).json({ error: 'first_name, last_name и age обязательны' });
    }
    try {
        const user = new User({ first_name, last_name, age: Number(age) });
        await user.save();
        res.status(201).json(user);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

// GET /api/users
app.get('/api/users', async (req, res) => {
    try {
        const users = await User.find().sort({ created_at: -1 });
        res.json(users);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET /api/users/:id
app.get('/api/users/:id', async (req, res) => {
    try {
        const user = await User.findById(req.params.id);
        if (!user) return res.status(404).json({ error: 'Пользователь не найден' });
        res.json(user);
    } catch (err) {
        res.status(404).json({ error: 'Пользователь не найден' });
    }
});

// PATCH /api/users/:id
app.patch('/api/users/:id', async (req, res) => {
    try {
        const user = await User.findByIdAndUpdate(
            req.params.id,
            req.body,
            { new: true, runValidators: true }
        );
        if (!user) return res.status(404).json({ error: 'Пользователь не найден' });
        res.json(user);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

// DELETE /api/users/:id
app.delete('/api/users/:id', async (req, res) => {
    try {
        const user = await User.findByIdAndDelete(req.params.id);
        if (!user) return res.status(404).json({ error: 'Пользователь не найден' });
        res.json({ message: 'Пользователь удалён' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

mongoose.connect(MONGO_URL)
    .then(() => {
        console.log('MongoDB подключена');
        app.listen(PORT, () => console.log(`Practice 20 (MongoDB) запущен на http://localhost:${PORT}`));
    })
    .catch(err => { console.error('MongoDB ошибка подключения:', err.message); process.exit(1); });

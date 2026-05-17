const express = require('express');

const app = express();
const PORT      = process.env.PORT      || 3000;
const SERVER_ID = process.env.SERVER_ID || '1';

app.get('/', (req, res) => {
    res.json({
        message: 'Response from backend server',
        server:  `backend-${SERVER_ID}`,
        port:    PORT,
        time:    new Date().toISOString(),
    });
});

app.get('/health', (req, res) => {
    res.json({ status: 'ok', server: `backend-${SERVER_ID}` });
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`Backend-${SERVER_ID} запущен на порту ${PORT}`);
});

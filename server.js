require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const searchRoutes = require('./routes/search');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// API Routes
app.use('/api', searchRoutes);

// Ana sayfa
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`\n🚀 POS Müşteri Bulma Aracı çalışıyor!`);
  console.log(`📍 http://localhost:${PORT}\n`);
});

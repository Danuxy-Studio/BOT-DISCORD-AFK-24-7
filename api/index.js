const express = require('express');
const path = require('path');
const { initBot, getStatus } = require('../utils/discord');

const app = express();

// Setup view engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, '../views'));

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files
app.use(express.static(path.join(__dirname, '../public')));

// Import routes
const webRoutes = require('./web');

// Gunakan routes
app.use('/', webRoutes);

// Health check
app.get('/health', (req, res) => {
  const status = getStatus();
  res.json({
    status: 'ok',
    botStatus: status,
    timestamp: new Date().toISOString()
  });
});

// Root path
app.get('/', (req, res) => {
  res.redirect('/dashboard');
});

// Inisialisasi bot saat pertama kali diakses
let botInitialized = false;

app.use(async (req, res, next) => {
  if (!botInitialized) {
    try {
      console.log('🤖 Menginisialisasi bot...');
      await initBot();
      botInitialized = true;
      console.log('✅ Bot berhasil diinisialisasi');
    } catch (error) {
      console.error('❌ Gagal init bot:', error);
    }
  }
  next();
});

// Export untuk Vercel
module.exports = app;
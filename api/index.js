require('dotenv').config();
const express = require('express');
const path = require('path');
const { initBot, getStatus } = require('../src/discord');
const routes = require('../src/routes');

const app = express();

// Setup view engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, '../views'));

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, '../public')));

// Gunakan routes
app.use('/', routes);

// Health check
app.get('/health', (req, res) => {
  const status = getStatus();
  res.json({
    status: 'ok',
    botStatus: status,
    timestamp: new Date().toISOString(),
    environment: 'vercel'
  });
});

// Root path
app.get('/', (req, res) => {
  res.redirect('/dashboard');
});

// Inisialisasi bot
let botInitialized = false;

app.use(async (req, res, next) => {
  if (!botInitialized) {
    try {
      console.log('🤖 Menginisialisasi bot di Vercel...');
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
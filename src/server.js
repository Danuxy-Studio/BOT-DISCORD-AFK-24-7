require('dotenv').config();
const express = require('express');
const path = require('path');
const { initBot, getStatus } = require('./discord');
const routes = require('./routes');

const app = express();
const PORT = process.env.PORT || 3000;

// Setup view engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, '../views'));

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, '../public')));

// Routes
app.use('/', routes);

// Health check
app.get('/health', (req, res) => {
  const status = getStatus();
  res.json({
    status: 'ok',
    botStatus: status,
    timestamp: new Date().toISOString(),
    environment: 'localhost'
  });
});

// Root
app.get('/', (req, res) => {
  res.redirect('/dashboard');
});

// Start server
app.listen(PORT, async () => {
  console.log(`🌐 Web server running on http://localhost:${PORT}`);
  console.log(`📱 Akses: http://localhost:${PORT}/dashboard`);
  
  // Auto-init bot
  try {
    console.log('🤖 Menginisialisasi bot...');
    await initBot();
    console.log('✅ Bot berhasil diinisialisasi');
    
    // Cek status setelah 3 detik
    setTimeout(() => {
      const status = getStatus();
      console.log('📊 Status bot:', status);
    }, 3000);
  } catch (error) {
    console.error('❌ Gagal init bot:', error);
  }
});

module.exports = app;
require('dotenv').config();
const express = require('express');
const path = require('path');
const { initBot, reconnectBot, getStatus } = require('../utils/discord');
const webRoutes = require('./web');

const app = express();
const PORT = process.env.PORT || 3000;

// Setup view engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, '../views'));

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files
app.use(express.static(path.join(__dirname, '../public')));

// Routes
app.use('/', webRoutes);

// Health check endpoint
app.get('/health', (req, res) => {
  const status = getStatus();
  res.json({
    status: 'ok',
    botStatus: status,
    timestamp: new Date().toISOString()
  });
});

// Start server
app.listen(PORT, async () => {
  console.log(`🌐 Web server running on port ${PORT}`);
  console.log(`📱 Akses: http://localhost:${PORT}`);
  
  // Auto-init bot
  try {
    await initBot();
    console.log('🤖 Bot initialized');
    
    // Cek status setelah init dengan interval
    let checkCount = 0;
    const checkInterval = setInterval(() => {
      const status = getStatus();
      console.log(`📊 Check ${checkCount + 1}:`, status);
      checkCount++;
      
      if (status.isConnected || checkCount >= 10) {
        clearInterval(checkInterval);
        console.log('📊 Status monitoring selesai');
      }
    }, 2000);
  } catch (error) {
    console.error('❌ Bot init error:', error);
  }
});

module.exports = app;
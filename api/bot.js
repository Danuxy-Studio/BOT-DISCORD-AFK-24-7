require('dotenv').config();
const express = require('express');
const path = require('path');
const { initBot, reconnectBot, getStatus } = require('../utils/discord');
const webRoutes = require('./web');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
app.use('/', webRoutes);

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
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
  } catch (error) {
    console.error('❌ Bot init error:', error);
  }
});

module.exports = app;
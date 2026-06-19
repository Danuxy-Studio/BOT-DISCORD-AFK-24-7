require('dotenv').config();
const express = require('express');
const { initBot, reconnectBot, getStatus } = require('../utils/discord');

const app = express();
app.use(express.json());

// Endpoint utama untuk trigger bot
app.get('/', async (req, res) => {
  try {
    const status = getStatus();
    
    // Kalau bot belum ready atau tidak connected
    if (!status.clientReady || !status.isConnected) {
      console.log('🚀 Bot belum ready, inisialisasi...');
      await initBot();
      
      // Tunggu sebentar
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      const newStatus = getStatus();
      res.json({
        success: true,
        message: 'Bot di-inisialisasi',
        status: newStatus
      });
    } else {
      res.json({
        success: true,
        message: 'Bot sudah aktif',
        status: status
      });
    }
  } catch (error) {
    console.error('❌ Error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Endpoint untuk reconnect
app.post('/reconnect', async (req, res) => {
  try {
    await reconnectBot();
    res.json({
      success: true,
      message: 'Reconnect berhasil',
      status: getStatus()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Endpoint status
app.get('/status', (req, res) => {
  res.json({
    success: true,
    status: getStatus()
  });
});

module.exports = app;
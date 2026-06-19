const express = require('express');
const { getStatus, reconnectBot, initBot } = require('../utils/discord');

const router = express.Router();

// Halaman utama
router.get('/', async (req, res) => {
  try {
    const status = getStatus();
    
    console.log('📊 Status saat render:', status);
    
    res.render('index', {
      title: 'Discord Bot Dashboard',
      status: status,
      guildId: process.env.GUILD_ID || 'Not Set',
      voiceChannelId: process.env.VOICE_CHANNEL_ID || 'Not Set',
      botName: status.clientReady ? 'Online' : 'Offline',
      timestamp: new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' })
    });
  } catch (error) {
    console.error('Web error:', error);
    res.status(500).send(`
      <h1>Error</h1>
      <p>${error.message}</p>
      <a href="/">Kembali</a>
    `);
  }
});

// API endpoint untuk status (JSON)
router.get('/api/status', (req, res) => {
  try {
    const status = getStatus();
    console.log('📊 API Status:', status);
    res.json({
      success: true,
      data: {
        ...status,
        guildId: process.env.GUILD_ID,
        voiceChannelId: process.env.VOICE_CHANNEL_ID,
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('API Status error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// API endpoint untuk reconnect
router.post('/api/reconnect', async (req, res) => {
  try {
    console.log('🔄 Reconnect requested');
    const success = await reconnectBot();
    const status = getStatus();
    res.json({
      success: success,
      message: success ? 'Reconnect berhasil' : 'Reconnect gagal',
      status: status
    });
  } catch (error) {
    console.error('Reconnect error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// API endpoint untuk restart bot
router.post('/api/restart', async (req, res) => {
  try {
    console.log('🔄 Restart requested');
    await initBot();
    const status = getStatus();
    res.json({
      success: true,
      message: 'Restart berhasil',
      status: status
    });
  } catch (error) {
    console.error('Restart error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// API endpoint untuk leave voice channel
router.post('/api/leave', async (req, res) => {
  try {
    const { connection } = require('../utils/discord');
    const conn = connection();
    
    if (conn) {
      try {
        conn.destroy();
        res.json({
          success: true,
          message: 'Berhasil keluar dari voice channel'
        });
      } catch (error) {
        res.status(500).json({
          success: false,
          error: error.message
        });
      }
    } else {
      res.json({
        success: false,
        message: 'Bot tidak ada di voice channel'
      });
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Debug endpoint
router.get('/api/debug', (req, res) => {
  const status = getStatus();
  res.json({
    success: true,
    data: status,
    raw: {
      isConnected: status.isConnected,
      clientReady: status.clientReady,
      connectionExists: status.connectionExists,
      connectionStatus: status.connectionStatus
    }
  });
});

module.exports = router;
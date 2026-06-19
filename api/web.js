const express = require('express');
const { getStatus, reconnectBot, initBot } = require('../utils/discord');

const router = express.Router();

// Halaman utama
router.get('/', async (req, res) => {
  try {
    const status = getStatus();
    
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
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// API endpoint untuk reconnect
router.post('/api/reconnect', async (req, res) => {
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

// API endpoint untuk restart bot
router.post('/api/restart', async (req, res) => {
  try {
    await initBot();
    res.json({
      success: true,
      message: 'Restart berhasil',
      status: getStatus()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;
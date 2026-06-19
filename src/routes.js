const express = require('express');
const { getStatus, reconnectBot, initBot } = require('./discord');

const router = express.Router();

// Dashboard
router.get('/dashboard', async (req, res) => {
  try {
    const status = getStatus();
    
    res.render('index', {
      title: 'Discord Bot Dashboard',
      status: status,
      guildId: process.env.GUILD_ID || 'Not Set',
      voiceChannelId: process.env.VOICE_CHANNEL_ID || 'Not Set',
      botName: status.clientReady ? status.botTag || 'Online' : 'Offline',
      timestamp: new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' })
    });
  } catch (error) {
    console.error('Web error:', error);
    res.status(500).send(`<h1>Error</h1><p>${error.message}</p><a href="/dashboard">Refresh</a>`);
  }
});

// API Status
router.get('/api/status', (req, res) => {
  try {
    const status = getStatus();
    res.json({
      success: true,
      data: status,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// API Reconnect
router.post('/api/reconnect', async (req, res) => {
  try {
    const success = await reconnectBot();
    const status = getStatus();
    res.json({
      success: success,
      message: success ? 'Reconnect berhasil' : 'Reconnect gagal',
      status: status
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// API Restart
router.post('/api/restart', async (req, res) => {
  try {
    await initBot();
    const status = getStatus();
    res.json({
      success: true,
      message: 'Restart berhasil',
      status: status
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// API Leave
router.post('/api/leave', async (req, res) => {
  try {
    const conn = require('./discord').connection();
    
    if (conn) {
      conn.destroy();
      res.json({ success: true, message: 'Berhasil keluar dari voice channel' });
    } else {
      res.json({ success: false, message: 'Bot tidak ada di voice channel' });
    }
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Root redirect
router.get('/', (req, res) => {
  res.redirect('/dashboard');
});

module.exports = router;
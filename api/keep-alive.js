require('dotenv').config();
const { initBot, reconnectBot, getStatus } = require('../utils/discord');

module.exports = async (req, res) => {
  try {
    console.log('🔄 Keep-alive trigger...');
    
    const status = getStatus();
    
    // Jika bot tidak aktif, inisialisasi ulang
    if (!status.clientReady || !status.isConnected) {
      console.log('⚠️ Bot tidak aktif, mencoba reconnect...');
      
      if (status.clientReady) {
        await reconnectBot();
      } else {
        await initBot();
      }
      
      // Tunggu sebentar
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      const newStatus = getStatus();
      res.json({
        success: true,
        message: 'Bot di-reconnect',
        status: newStatus
      });
    } else {
      // Bot aktif, cek koneksi voice
      if (!status.isConnected) {
        console.log('🔄 Voice disconnect, reconnect...');
        await reconnectBot();
      }
      
      res.json({
        success: true,
        message: 'Bot masih aktif',
        status: status
      });
    }
  } catch (error) {
    console.error('❌ Keep-alive error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};
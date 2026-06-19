const { initBot, reconnectBot, getStatus } = require('../utils/discord');

module.exports = async (req, res) => {
  try {
    console.log('🔄 Keep-alive trigger...');
    
    const status = getStatus();
    
    if (!status.clientReady || !status.isConnected) {
      console.log('⚠️ Bot tidak aktif, mencoba reconnect...');
      
      if (status.clientReady) {
        await reconnectBot();
      } else {
        await initBot();
      }
    }
    
    res.json({
      success: true,
      message: 'Keep-alive executed',
      status: getStatus()
    });
  } catch (error) {
    console.error('❌ Keep-alive error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};
const { Client, GatewayIntentBits } = require('discord.js');
const { joinVoiceChannel, createAudioPlayer, createAudioResource, NoSubscriberBehavior, VoiceConnectionStatus } = require('@discordjs/voice');
const { Readable } = require('stream');

let client = null;
let connection = null;
let player = null;
let isConnected = false;

// Silent audio stream
function createSilentStream() {
  const silence = Buffer.from([0xF8, 0xFF, 0xFE]);
  return new Readable({
    read() {
      this.push(silence);
      setTimeout(() => this.push(silence), 5000);
    }
  });
}

async function connectToVoiceChannel(guildId, voiceChannelId) {
  try {
    const guild = client.guilds.cache.get(guildId);
    if (!guild) {
      console.error('❌ Guild tidak ditemukan');
      return false;
    }

    const voiceChannel = guild.channels.cache.get(voiceChannelId);
    if (!voiceChannel) {
      console.error('❌ Voice channel tidak ditemukan');
      return false;
    }

    if (connection) {
      try { connection.destroy(); } catch (e) {}
      connection = null;
      player = null;
    }

    connection = joinVoiceChannel({
      channelId: voiceChannel.id,
      guildId: guild.id,
      adapterCreator: guild.voiceAdapterCreator,
      selfDeaf: true,
      selfMute: false,
    });

    connection.on(VoiceConnectionStatus.Ready, () => {
      console.log('✅ Connected ke voice channel');
      isConnected = true;
      setupPlayer();
    });

    connection.on(VoiceConnectionStatus.Disconnected, () => {
      console.log('⚠️ Disconnected dari voice');
      isConnected = false;
    });

    connection.on(VoiceConnectionStatus.Destroyed, () => {
      console.log('💥 Connection destroyed');
      isConnected = false;
      connection = null;
      player = null;
    });

    connection.on('error', (error) => {
      console.error('❌ Connection error:', error);
    });

    // Tunggu koneksi
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Cek status
    const status = connection.state.status;
    console.log(`📊 Connection status: ${status}`);
    
    if (status === VoiceConnectionStatus.Ready) {
      isConnected = true;
      setupPlayer();
      return true;
    }
    
    return false;

  } catch (error) {
    console.error('❌ Gagal join:', error);
    return false;
  }
}

function setupPlayer() {
  if (!connection) return;
  
  if (player) {
    try { player.stop(); } catch (e) {}
    player = null;
  }

  player = createAudioPlayer({
    behaviors: {
      noSubscriber: NoSubscriberBehavior.Play,
    },
  });

  const stream = createSilentStream();
  const resource = createAudioResource(stream, {
    inputType: 'opus',
  });

  player.play(resource);
  connection.subscribe(player);
  console.log('✅ Player setup selesai');
}

async function initBot() {
  if (client && client.isReady()) {
    console.log('🔄 Bot sudah ready');
    return reconnectBot();
  }

  if (client) {
    try { client.destroy(); } catch (e) {}
    client = null;
  }

  client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildVoiceStates,
    ]
  });

  return new Promise((resolve) => {
    client.once('ready', async () => {
      console.log(`✅ Bot online: ${client.user.tag}`);
      
      const guildId = process.env.GUILD_ID;
      const voiceChannelId = process.env.VOICE_CHANNEL_ID;
      
      if (guildId && voiceChannelId) {
        const success = await connectToVoiceChannel(guildId, voiceChannelId);
        console.log(`📊 Connect: ${success ? 'Success ✅' : 'Failed ❌'}`);
      }
      
      resolve(true);
    });

    client.on('error', (error) => {
      console.error('❌ Client error:', error);
    });

    client.login(process.env.DISCORD_TOKEN)
      .then(() => console.log('🔑 Login berhasil'))
      .catch((error) => console.error('❌ Login gagal:', error));
  });
}

async function reconnectBot() {
  console.log('🔄 Reconnecting...');
  
  if (connection) {
    try { connection.destroy(); } catch (e) {}
    connection = null;
    player = null;
    isConnected = false;
  }

  if (client && client.isReady()) {
    const guildId = process.env.GUILD_ID;
    const voiceChannelId = process.env.VOICE_CHANNEL_ID;
    return await connectToVoiceChannel(guildId, voiceChannelId);
  }
  
  return false;
}

function getStatus() {
  let statusText = 'none';
  if (connection) {
    try {
      statusText = connection.state?.status || 'none';
      if (statusText === VoiceConnectionStatus.Ready) {
        isConnected = true;
      }
    } catch (e) {
      statusText = 'error';
    }
  }
  
  return {
    isConnected: isConnected,
    clientReady: client?.isReady() || false,
    connectionExists: connection !== null,
    connectionStatus: statusText,
    voiceChannelId: connection?.joinConfig?.channelId || null,
  };
}

module.exports = {
  initBot,
  reconnectBot,
  getStatus,
  client: () => client,
  connection: () => connection,
};
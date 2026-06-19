const { Client, GatewayIntentBits } = require('discord.js');
const { joinVoiceChannel, createAudioPlayer, createAudioResource, NoSubscriberBehavior } = require('@discordjs/voice');
const { Readable } = require('stream');

let client = null;
let connection = null;
let player = null;
let isConnected = false;

// Buat silent audio
function createSilentStream() {
  const silence = Buffer.from([0xF8, 0xFF, 0xFE]);
  return new Readable({
    read() {
      this.push(silence);
      setTimeout(() => this.push(silence), 5000);
    }
  });
}

async function joinVoiceChannel(guildId, voiceChannelId) {
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

    // Destroy connection lama jika ada
    if (connection) {
      try {
        connection.destroy();
      } catch (e) {}
    }

    connection = joinVoiceChannel({
      channelId: voiceChannel.id,
      guildId: guild.id,
      adapterCreator: guild.voiceAdapterCreator,
      selfDeaf: true,
      selfMute: false,
    });

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

    connection.on('ready', () => {
      console.log('✅ Bot connected ke voice channel');
      isConnected = true;
    });

    connection.on('disconnect', () => {
      console.log('⚠️ Disconnected dari voice');
      isConnected = false;
    });

    connection.on('error', (error) => {
      console.error('❌ Connection error:', error);
      isConnected = false;
    });

    console.log(`🔊 Join ke channel: ${voiceChannel.name}`);
    return true;

  } catch (error) {
    console.error('❌ Gagal join:', error);
    return false;
  }
}

async function initBot() {
  if (client) {
    // Kalau sudah ada client, reconnect aja
    return reconnectBot();
  }

  client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildVoiceStates,
    ]
  });

  return new Promise((resolve, reject) => {
    client.once('ready', async () => {
      console.log(`✅ Bot online: ${client.user.tag}`);
      
      const guildId = process.env.GUILD_ID;
      const voiceChannelId = process.env.VOICE_CHANNEL_ID;
      
      if (guildId && voiceChannelId) {
        await joinVoiceChannel(guildId, voiceChannelId);
      }
      
      resolve(true);
    });

    client.on('error', (error) => {
      console.error('❌ Client error:', error);
      reject(error);
    });

    client.login(process.env.DISCORD_TOKEN)
      .then(() => {
        console.log('🔑 Login berhasil');
      })
      .catch((error) => {
        console.error('❌ Login gagal:', error);
        reject(error);
      });
  });
}

async function reconnectBot() {
  console.log('🔄 Reconnecting...');
  
  if (connection) {
    try {
      connection.destroy();
    } catch (e) {}
    connection = null;
  }

  if (client) {
    const guildId = process.env.GUILD_ID;
    const voiceChannelId = process.env.VOICE_CHANNEL_ID;
    
    if (guildId && voiceChannelId) {
      return await joinVoiceChannel(guildId, voiceChannelId);
    }
  }
  
  return false;
}

function getStatus() {
  return {
    isConnected: isConnected,
    clientReady: client?.isReady() || false,
    connectionExists: connection !== null,
    voiceChannelId: connection?.joinConfig?.channelId || null,
  };
}

module.exports = {
  initBot,
  reconnectBot,
  getStatus,
  client: () => client,
};
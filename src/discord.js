const { Client, GatewayIntentBits } = require('discord.js');
const { joinVoiceChannel, createAudioPlayer, createAudioResource, NoSubscriberBehavior, VoiceConnectionStatus, entersState } = require('@discordjs/voice');
const { Readable } = require('stream');

let client = null;
let connection = null;
let player = null;
let isConnected = false;
let isInitializing = false;

// Silent audio stream untuk keep-alive
function createSilentStream() {
  const silence = Buffer.from([0xF8, 0xFF, 0xFE]);
  return new Readable({
    read() {
      this.push(silence);
    }
  });
}

async function connectToVoiceChannel(guildId, voiceChannelId) {
  try {
    if (!client) {
      console.error('❌ Client tidak ada');
      return false;
    }

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

    console.log(`🔊 Mencoba join ke: ${voiceChannel.name}`);

    // Destroy connection lama
    if (connection) {
      try {
        connection.destroy();
      } catch (e) {}
      connection = null;
      player = null;
    }

    // Join voice channel
    connection = joinVoiceChannel({
      channelId: voiceChannel.id,
      guildId: guild.id,
      adapterCreator: guild.voiceAdapterCreator,
      selfDeaf: true,
      selfMute: false,
    });

    // Event listeners
    connection.on(VoiceConnectionStatus.Ready, () => {
      console.log('✅ Voice connection READY');
      isConnected = true;
      setupPlayer();
    });

    connection.on(VoiceConnectionStatus.Connecting, () => {
      console.log('🔄 Connecting to voice...');
    });

    connection.on(VoiceConnectionStatus.Disconnected, () => {
      console.log('⚠️ Disconnected from voice');
      isConnected = false;
      
      // Auto reconnect
      setTimeout(() => {
        if (connection && !isConnected) {
          console.log('🔄 Mencoba reconnect...');
          try {
            connection.rejoin();
          } catch (e) {
            console.error('❌ Rejoin error:', e);
          }
        }
      }, 5000);
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

    // Tunggu sampai ready
    try {
      await entersState(connection, VoiceConnectionStatus.Ready, 15000);
      console.log('✅ Connection READY via entersState');
      isConnected = true;
      setupPlayer();
      return true;
    } catch (error) {
      console.error('❌ Timeout waiting for connection:', error.message);
      
      // Cek status langsung
      if (connection.state.status === VoiceConnectionStatus.Ready) {
        console.log('✅ Connection already READY');
        isConnected = true;
        setupPlayer();
        return true;
      }
      
      isConnected = false;
      return false;
    }

  } catch (error) {
    console.error('❌ Gagal join voice:', error);
    isConnected = false;
    return false;
  }
}

function setupPlayer() {
  if (!connection) return;
  
  if (player) {
    try {
      player.stop();
    } catch (e) {}
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

  player.on('stateChange', (oldState, newState) => {
    console.log(`🎵 Player: ${oldState.status} -> ${newState.status}`);
  });

  player.on('error', (error) => {
    console.error('❌ Player error:', error);
  });

  console.log('✅ Player setup selesai');
}

async function initBot() {
  if (isInitializing) {
    console.log('⏳ Bot sedang diinisialisasi...');
    return;
  }

  isInitializing = true;

  if (client && client.isReady()) {
    console.log('🔄 Bot sudah ready, reconnect...');
    await reconnectBot();
    isInitializing = false;
    return;
  }

  if (client) {
    try {
      client.destroy();
    } catch (e) {}
    client = null;
  }

  client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildVoiceStates,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.MessageContent,
    ]
  });

  try {
    await client.login(process.env.DISCORD_TOKEN);
    console.log('🔑 Login berhasil');

    client.once('ready', async () => {
      console.log(`✅ Bot online: ${client.user.tag}`);
      
      const guildId = process.env.GUILD_ID;
      const voiceChannelId = process.env.VOICE_CHANNEL_ID;
      
      if (guildId && voiceChannelId) {
        console.log('📡 Mencoba join voice channel...');
        const success = await connectToVoiceChannel(guildId, voiceChannelId);
        console.log(`📊 Initial connect: ${success ? 'Success ✅' : 'Failed ❌'}`);
      }
      
      isInitializing = false;
    });

    client.on('error', (error) => {
      console.error('❌ Client error:', error);
    });

    // Setup command handler
    client.on('messageCreate', handleCommand);

  } catch (error) {
    console.error('❌ Login gagal:', error);
    isInitializing = false;
  }
}

async function reconnectBot() {
  console.log('🔄 Reconnecting...');
  
  if (connection) {
    try {
      connection.destroy();
    } catch (e) {}
    connection = null;
    player = null;
    isConnected = false;
  }

  if (client && client.isReady()) {
    const guildId = process.env.GUILD_ID;
    const voiceChannelId = process.env.VOICE_CHANNEL_ID;
    return await connectToVoiceChannel(guildId, voiceChannelId);
  } else {
    await initBot();
    return false;
  }
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
    guildId: connection?.joinConfig?.guildId || null,
    botTag: client?.user?.tag || 'Not logged in',
  };
}

// Command handler untuk Discord
async function handleCommand(message) {
  if (message.author.bot) return;
  if (!message.content.startsWith('!')) return;

  const args = message.content.slice(1).split(' ');
  const command = args[0].toLowerCase();

  if (command === 'status') {
    const status = getStatus();
    const embed = {
      color: status.isConnected ? 0x57f287 : 0xed4245,
      title: '📊 Status Bot',
      fields: [
        { name: 'Status', value: status.isConnected ? '✅ Terhubung ke voice' : '❌ Tidak terhubung', inline: true },
        { name: 'Connection Status', value: status.connectionStatus || 'none', inline: true },
        { name: 'Voice Channel', value: status.voiceChannelId || 'Tidak ada', inline: true },
        { name: 'Bot', value: status.botTag || 'Unknown', inline: true },
      ],
      timestamp: new Date().toISOString()
    };
    await message.reply({ embeds: [embed] });
  }

  if (command === 'join') {
    await message.reply('🔊 Mencoba join voice channel...');
    const success = await reconnectBot();
    await message.reply(success ? '✅ Berhasil join voice channel!' : '❌ Gagal join voice channel!');
  }

  if (command === 'leave') {
    if (connection) {
      try {
        connection.destroy();
        connection = null;
        player = null;
        isConnected = false;
        await message.reply('👋 Bot keluar dari voice channel');
      } catch (error) {
        await message.reply('❌ Gagal keluar: ' + error.message);
      }
    } else {
      await message.reply('❌ Bot tidak ada di voice channel');
    }
  }

  if (command === 'help') {
    const embed = {
      color: 0x5865f2,
      title: '📋 Daftar Commands',
      fields: [
        { name: '!status', value: 'Cek status bot', inline: true },
        { name: '!join', value: 'Join voice channel', inline: true },
        { name: '!leave', value: 'Keluar dari voice channel', inline: true },
        { name: '!help', value: 'Tampilkan commands ini', inline: true },
      ],
      timestamp: new Date().toISOString()
    };
    await message.reply({ embeds: [embed] });
  }
}

// EXPORT SEMUA FUNGSI
module.exports = {
  initBot,
  reconnectBot,
  getStatus,
  client: () => client,
  connection: () => connection,
  handleCommand,
};
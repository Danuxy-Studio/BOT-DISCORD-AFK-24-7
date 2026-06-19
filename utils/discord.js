const { Client, GatewayIntentBits } = require('discord.js');
const { joinVoiceChannel, createAudioPlayer, createAudioResource, NoSubscriberBehavior, VoiceConnectionStatus, entersState } = require('@discordjs/voice');
const { Readable } = require('stream');

let client = null;
let connection = null;
let player = null;
let isConnected = false;
let reconnectTimeout = null;

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

    // Cek izin bot
    const botMember = guild.members.cache.get(client.user.id);
    if (!botMember) {
      console.error('❌ Bot member tidak ditemukan');
      return false;
    }

    const permissions = voiceChannel.permissionsFor(botMember);
    if (!permissions.has('Connect')) {
      console.error('❌ Bot tidak memiliki izin Connect');
      return false;
    }
    if (!permissions.has('Speak')) {
      console.error('❌ Bot tidak memiliki izin Speak');
      return false;
    }

    console.log(`✅ Izin terverifikasi, mencoba join ke: ${voiceChannel.name}`);

    // Destroy connection lama
    if (connection) {
      try {
        connection.destroy();
      } catch (e) {}
      connection = null;
      player = null;
    }

    // Join voice channel dengan pendekatan berbeda
    connection = joinVoiceChannel({
      channelId: voiceChannel.id,
      guildId: guild.id,
      adapterCreator: guild.voiceAdapterCreator,
      selfDeaf: true,
      selfMute: false,
    });

    // Setup event listener sebelum mencoba entersState
    connection.on(VoiceConnectionStatus.Ready, () => {
      console.log('✅ Event READY terdeteksi!');
      isConnected = true;
      setupPlayer();
    });

    connection.on(VoiceConnectionStatus.Connecting, () => {
      console.log('🔄 Menghubungkan...');
    });

    connection.on(VoiceConnectionStatus.Disconnected, () => {
      console.log('⚠️ Disconnected');
      isConnected = false;
      handleDisconnect();
    });

    connection.on(VoiceConnectionStatus.Destroyed, () => {
      console.log('💥 Destroyed');
      isConnected = false;
      connection = null;
      player = null;
    });

    connection.on('error', (error) => {
      console.error('❌ Connection error:', error);
    });

    // Tunggu dengan timeout yang lebih lama
    try {
      console.log('⏳ Menunggu koneksi siap...');
      await entersState(connection, VoiceConnectionStatus.Ready, 15000);
      console.log('✅ Connection ready via entersState!');
      isConnected = true;
      setupPlayer();
      return true;
    } catch (error) {
      console.error('❌ Timeout atau error:', error.message);
      
      // Coba alternatif: cek status langsung
      if (connection.state.status === VoiceConnectionStatus.Ready) {
        console.log('✅ Connection sudah READY!');
        isConnected = true;
        setupPlayer();
        return true;
      }
      
      // Jika masih connecting, coba rejoin
      if (connection.state.status === VoiceConnectionStatus.Connecting) {
        console.log('🔄 Masih connecting, coba rejoin...');
        try {
          connection.rejoin();
          await entersState(connection, VoiceConnectionStatus.Ready, 10000);
          console.log('✅ Rejoin berhasil!');
          isConnected = true;
          setupPlayer();
          return true;
        } catch (rejoinError) {
          console.error('❌ Rejoin gagal:', rejoinError.message);
          isConnected = false;
          return false;
        }
      }
      
      isConnected = false;
      return false;
    }

  } catch (error) {
    console.error('❌ Gagal join:', error);
    isConnected = false;
    return false;
  }
}

function setupPlayer() {
  if (player) {
    try {
      player.stop();
    } catch (e) {}
    player = null;
  }

  if (!connection) return;

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

function handleDisconnect() {
  if (reconnectTimeout) {
    clearTimeout(reconnectTimeout);
  }

  // Auto reconnect setelah 3 detik
  reconnectTimeout = setTimeout(async () => {
    console.log('🔄 Auto-reconnect...');
    if (client && client.isReady()) {
      const guildId = process.env.GUILD_ID;
      const voiceChannelId = process.env.VOICE_CHANNEL_ID;
      if (guildId && voiceChannelId) {
        await connectToVoiceChannel(guildId, voiceChannelId);
      }
    }
  }, 3000);
}

async function initBot() {
  if (client && client.isReady()) {
    console.log('🔄 Bot sudah siap, reconnect...');
    return reconnectBot();
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

  return new Promise((resolve, reject) => {
    client.once('ready', async () => {
      console.log(`✅ Bot online: ${client.user.tag}`);
      
      const guildId = process.env.GUILD_ID;
      const voiceChannelId = process.env.VOICE_CHANNEL_ID;
      
      if (guildId && voiceChannelId) {
        console.log('📡 Mencoba join voice channel...');
        const success = await connectToVoiceChannel(guildId, voiceChannelId);
        console.log(`📊 Initial connect: ${success ? 'Success ✅' : 'Failed ❌'}`);
        
        // Jika gagal, coba lagi setelah 5 detik
        if (!success) {
          console.log('🔄 Mencoba lagi dalam 5 detik...');
          setTimeout(async () => {
            const retry = await connectToVoiceChannel(guildId, voiceChannelId);
            console.log(`📊 Retry connect: ${retry ? 'Success ✅' : 'Failed ❌'}`);
          }, 5000);
        }
      }
      
      resolve(true);
    });

    client.on('error', (error) => {
      console.error('❌ Client error:', error);
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
  
  isConnected = false;
  
  if (reconnectTimeout) {
    clearTimeout(reconnectTimeout);
    reconnectTimeout = null;
  }
  
  if (connection) {
    try {
      connection.destroy();
    } catch (e) {}
    connection = null;
    player = null;
  }

  if (client && client.isReady()) {
    const guildId = process.env.GUILD_ID;
    const voiceChannelId = process.env.VOICE_CHANNEL_ID;
    
    if (guildId && voiceChannelId) {
      const success = await connectToVoiceChannel(guildId, voiceChannelId);
      console.log(`📊 Reconnect: ${success ? 'Success ✅' : 'Failed ❌'}`);
      
      // Jika gagal, coba lagi
      if (!success) {
        console.log('🔄 Mencoba reconnect lagi dalam 3 detik...');
        setTimeout(async () => {
          await connectToVoiceChannel(guildId, voiceChannelId);
        }, 3000);
      }
      
      return success;
    }
  } else {
    console.log('⚠️ Client tidak ready, init ulang...');
    await initBot();
  }
  
  return false;
}

function getStatus() {
  // Cek status real-time
  let realStatus = false;
  let statusText = 'none';
  
  if (connection) {
    try {
      statusText = connection.state?.status || 'none';
      realStatus = statusText === VoiceConnectionStatus.Ready;
    } catch (e) {
      statusText = 'error';
      realStatus = false;
    }
  }
  
  // Update isConnected
  if (realStatus !== isConnected) {
    isConnected = realStatus;
  }
  
  return {
    isConnected: isConnected,
    clientReady: client?.isReady() || false,
    connectionExists: connection !== null,
    connectionStatus: statusText,
    voiceChannelId: connection?.joinConfig?.channelId || null,
    guildId: connection?.joinConfig?.guildId || null,
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
      ],
      timestamp: new Date().toISOString()
    };
    await message.reply({ embeds: [embed] });
  }

  if (command === 'join') {
    await message.reply('🔊 Mencoba join voice channel...');
    const success = await reconnectBot();
    await message.reply(success ? '✅ Berhasil join voice channel!' : '❌ Gagal join voice channel! Coba cek izin bot.');
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

// Setup command handler setelah client ready
if (client) {
  client.on('messageCreate', handleCommand);
}

module.exports = {
  initBot,
  reconnectBot,
  getStatus,
  client: () => client,
  connection: () => connection,
  handleCommand,
};
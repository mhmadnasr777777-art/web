require('dotenv').config(); 
const { Client, GatewayIntentBits, Routes, REST, SlashCommandBuilder } = require('discord.js');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

const TOKEN = process.env.TOKEN; 
const CLIENT_ID = process.env.CLIENT_ID;

client.once('ready', () => {
    console.log(`👑 تم بدء تشغيل البوت الخارق والذكي التابع لـ MG APP باسم: ${client.user.tag}`);
});

// استقبال الرسائل ومعالجة الردود والبنغ
client.on('messageCreate', async (message) => {
    if (message.author.bot || !message.guild) return;

    if (message.content === 'ping') {
        return message.reply('🏓 pong!');
    }
});

client.login(TOKEN);
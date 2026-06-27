require('dotenv').config();
const { Client, GatewayIntentBits, PermissionFlagsBits } = require('discord.js');
const express = require('express');
const cors = require('cors');
const { QuickDB } = require('quick-db');

const db = new QuickDB();
const app = express();
app.use(cors());
app.use(express.json());

// جلب البيانات من ملف الـ البيئة (.env) لضمان أمان البوت بنسبة 100%
const TOKEN = process.env.TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const CLIENT_SECRET = process.env.CLIENT_SECRET;
const REDIRECT_URI = 'http://localhost:3000/dashboard'; // رابط العودة للوحة الويب المبرمجة

const client = new Client({ 
    intents: [
        GatewayIntentBits.Guilds, 
        GatewayIntentBits.GuildMessages, 
        GatewayIntentBits.MessageContent
    ] 
});

client.once('ready', () => {
    console.log(`✅ تم تشغيل نظام الربط لبوت MG APP المطور بنجاح: ${client.user.tag}`);
});

// ==========================================================================
// 🔐 مسارات الدخول (Discord OAuth2 System) لقراءة السيرفرات بصلاحياتها
// ==========================================================================
app.get('/api/auth/discord', (req, res) => {
    const url = `https://discord.com/api/oauth2/authorize?client_id=${CLIENT_ID}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&response_type=code&scope=identify%20guilds`;
    res.redirect(url);
});

app.get('/api/auth/callback', async (req, res) => {
    const code = req.query.code;
    if (!code) return res.status(400).json({ error: 'No code provided' });

    try {
        // تبديل رمز الكود بـ Access Token من الديسكورد
        const tokenResponse = await fetch('https://discord.com/api/oauth2/token', {
            method: 'POST',
            body: new URLSearchParams({
                client_id: CLIENT_ID,
                client_secret: CLIENT_SECRET,
                grant_type: 'authorization_code',
                code: code,
                redirect_uri: REDIRECT_URI,
            }),
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        });
        
        const tokenData = await tokenResponse.json();
        
        // جلب سيرفرات المستخدم التي يتواجد بها
        const userGuildsResponse = await fetch('https://discord.com/api/users/@me/guilds', {
            headers: { Authorization: `Bearer ${tokenData.access_token}` },
        });
        const userGuilds = await userGuildsResponse.json();

        // تصفية السيرفرات: يجب أن يملك المشرف صلاحية إدارية (Manage Server) والبوت متواجد فيها
        const botGuilds = client.guilds.cache;
        const validGuilds = userGuilds.filter(guild => {
            const hasManagePerm = (BigInt(guild.permissions) & BigInt(0x20)) === BigInt(0x20); // 0x20 صلاحية إدارة السيرفر
            const isBotIn = botGuilds.has(guild.id);
            return hasManagePerm && isBotIn;
        });

        res.json({ success: true, guilds: validGuilds });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ==========================================================================
// 🌐 الـ APIs الخاصة بلوحة التحكم (Dashboard)
// ==========================================================================
app.get('/api/get-settings', async (req, res) => {
    const { guildId } = req.query;
    if (!guildId) return res.status(400).json({ error: 'Missing Guild ID' });

    const general = await db.get(`general_${guildId}`) || { serverLanguage: 'ar' };
    const welcome = await db.get(`welcome_${guildId}`) || { enabled: true, welcomeMessage: 'أهلاً بك' };
    const autoReplies = await db.get(`autoReplies_${guildId}`) || [];
    const autoRoles = await db.get(`autoRoles_${guildId}`) || { memberRoles: [], botRoles: [] };
    const storedCommands = await db.get(`modCommands_${guildId}`) || { ban: 'ban', kick: 'kick' };
    const storedStatuses = await db.get(`modStatuses_${guildId}`) || { ban: true, kick: true };

    res.json({ general, welcome, autoReplies, autoRoles, moderation: { commands: storedCommands, statuses: storedStatuses } });
});

app.post('/api/save-settings', async (req, res) => {
    const data = req.body;
    const { guildId } = data;

    await db.set(`general_${guildId}`, data.general);
    await db.set(`welcome_${guildId}`, data.welcome);
    await db.set(`autoReplies_${guildId}`, data.autoReplies);
    await db.set(`autoRoles_${guildId}`, data.autoRoles);
    await db.set(`modCommands_${guildId}`, data.moderation.commands);
    await db.set(`modStatuses_${guildId}`, data.moderation.statuses);

    res.json({ message: '✅ تم حفظ التعديلات وتحديث إعدادات خادمك فوراً!' });
});

app.get('/api/get-server-meta', async (req, res) => {
    const { guildId } = req.query;
    const guild = client.guilds.cache.get(guildId);
    if (!guild) return res.json({ channels: [], roles: [] });

    const channels = guild.channels.cache.filter(c => c.type === 0).map(c => ({ id: c.id, name: c.name })); // رومات كتابية
    const roles = guild.roles.cache.filter(r => r.name !== '@everyone').map(r => ({ id: r.id, name: r.name }));

    res.json({ channels, roles });
});

app.listen(3000, () => {
    console.log('🌐 سيرفر الويب والـ API المؤمن يعمل الآن على الرابط المحلي: http://localhost:3000');
});

client.login(TOKEN);
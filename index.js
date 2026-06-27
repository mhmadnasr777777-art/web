// استدعاء مكتبة dotenv لتشغيل ملف البيئة
require('dotenv').config();

// استدعاء الكلاسات المطلوبة من discord.js
const { Client, GatewayIntentBits } = require('discord.js');

// إنشاء نسخة جديدة من البوت وتحديد الـ Intents
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

// حدث عند تشغيل البوت بنجاح
client.once('ready', () => {
    console.log(`✅ تم تشغيل البوت بنجاح باسم: ${client.user.tag}`);
});

// حدث عند استقبال رسالة (مثال بسيط)
client.on('messageCreate', (message) => {
    // تجنب رد البوت على نفسه
    if (message.author.bot) return;

    if (message.content === 'ping') {
        message.reply('🏓 pong!');
    }
});

// تسجيل الدخول باستخدام التوكن المستدعى من ملف .env
client.login(process.env.DISCORD_TOKEN);


// ==========================================================================
// ⚙️ نظام إدارة البيانات والربط الفوري ببوت الديسكورد (MG APP)
// ==========================================================================

const API_BASE_URL = 'http://localhost:3000'; // رابط السيرفر الخلفي المشترك

let serverChannelsCached = [];
let serverRolesCached = [];
let ticketPanels = []; 
let currentReplies = [];

// دالة التنقل بين أقسام اللوحة الجانبية
function switchTab(tabId) {
    document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active-tab'));
    document.querySelectorAll('.nav-link').forEach(el => el.classList.remove('active'));
    document.getElementById(tabId).classList.add('active-tab');
    if (event && event.currentTarget) {
        event.currentTarget.classList.add('active');
    }
}

// دالة نسخ المتغيرات الذكية بضغطة زر
function copyVar(text) {
    navigator.clipboard.writeText(text);
    alert("تم نسخ المتغير الذكي: " + text);
}

// التحكم في إظهار وإخفاء حقول الصور بناءً على نوع الرسالة
function updateWelcomePreviewVisibility() {
    const type = document.getElementById('welcomeMessageType').value;
    document.getElementById('welcome_image_input_group').style.display = (type === 'image') ? 'block' : 'none';
}

function updateLeavePreviewVisibility() {
    const type = document.getElementById('leaveMessageType').value;
    document.getElementById('leave_image_input_group').style.display = (type === 'image') ? 'block' : 'none';
}

// تفعيل وتعطيل لوحة التذاكر بالكامل
function toggleProBotTicketSystem(enabled) {
    const container = document.getElementById('probot_ticket_container');
    if (container) {
        container.style.opacity = enabled ? "1" : "0.3";
        container.style.pointerEvents = enabled ? "auto" : "none";
    }
}

// معالجة رفع الصور وتوليد رابط محاكي
function handleFileUpload(inputElement, targetInputId) {
    const file = inputElement.files[0];
    if (file) document.getElementById(targetInputId).value = `https://cdn.discordapp.com/attachments/${file.name}`;
}

// جلب معلومات الرومات والرتب الأساسية من السيرفر لتغذية القوائم المنسدلة
async function loadServerMetadata() {
    try {
        const resMeta = await fetch(`${API_BASE_URL}/api/get-server-meta`);
        const meta = await resMeta.json();
        
        serverChannelsCached = meta.channels || [];
        serverRolesCached = meta.roles || [];

        document.querySelectorAll('.channel-select-box').forEach(select => {
            select.innerHTML = '<option value="">-- اختر روم --</option>';
            serverChannelsCached.forEach(ch => select.innerHTML += `<option value="${ch.id}">${ch.name}</option>`);
        });

        document.querySelectorAll('.role-select-box').forEach(select => {
            select.innerHTML = '';
            serverRolesCached.forEach(r => select.innerHTML += `<option value="${r.id}">${r.name}</option>`);
        });
    } catch (error) {
        console.error("❌ فشل في جلب بيانات السيرفر الحيوية:", error);
    }
}

// ==========================================================================
// 🛠️ تحميل البيانات من الـ API وتوزيعها على اللوحة (بما فيها الـ 15 أمراً)
// ==========================================================================
async function loadAllData() {
    await loadServerMetadata();

    try {
        const res = await fetch(`${API_BASE_URL}/api/get-settings`);
        const data = await res.json();

        // 1. الإعدادات العامة
        document.getElementById('serverLanguage').value = data.general.serverLanguage;
        
        // 2. نظام الترحيب والمغادرة
        document.getElementById('welcome_system_toggle').checked = data.welcome.enabled !== undefined ? data.welcome.enabled : true;
        document.getElementById('welcomeChannel').value = data.welcome.welcomeChannel || '';
        document.getElementById('welcomeMessageType').value = data.welcome.messageType || 'text';
        document.getElementById('welcomeMessage').value = data.welcome.welcomeMessage || '';
        document.getElementById('welcomeImage').value = data.welcome.welcomeImage || '';
        
        document.getElementById('leave_system_toggle').checked = data.welcome.leaveEnabled !== undefined ? data.welcome.leaveEnabled : true;
        document.getElementById('leaveChannel').value = data.welcome.leaveChannel || '';
        document.getElementById('leaveMessageType').value = data.welcome.leaveMessageType || 'text';
        document.getElementById('leaveMessage').value = data.welcome.leaveMessage || '';
        document.getElementById('leaveImage').value = data.welcome.leaveImage || '';

        updateWelcomePreviewVisibility();
        updateLeavePreviewVisibility();

        // 3. نظام الردود التلقائية
        currentReplies = data.autoReplies || [];
        renderAutoReplies();

        // 4. الرتب التلقائية وحماية السيرفر
        setSelectedOptions('memberRoles', data.autoRoles.memberRoles);
        setSelectedOptions('botRoles', data.autoRoles.botRoles);
        setSelectedOptions('protectionModRoles', data.protection.modRoles);

        document.getElementById('banLimit').value = data.protection.banLimit;
        document.getElementById('banAction').value = data.protection.banAction;
        document.getElementById('ownerOnlyLimits').checked = data.protection.ownerOnlyLimits;

        // 5. نظام التذاكر المطور
        document.getElementById('probot_ticket_toggle').checked = data.ticket.enabled !== undefined ? data.ticket.enabled : true;
        toggleProBotTicketSystem(document.getElementById('probot_ticket_toggle').checked);
        document.getElementById('useEmbed').checked = data.ticket.useEmbed;
        document.getElementById('pUserClose').checked = data.ticket.userPerms?.close || false;
        document.getElementById('pAdminCopy').checked = data.ticket.adminPerms?.copy || false;
        document.getElementById('pClaimSystem').checked = data.ticket.claimSystemEnabled || false;

        ticketPanels = data.ticket.panels || [];
        renderTicketPanels();

        // 6. جلب وقراءة الـ 15 أمراً الإشرافية بالكامل وتوزيعها على الكروت
        const modCommands = [
            'ban', 'unban', 'kick', 'mute', 'unmute', 
            'jail', 'warn', 'warnings', 'clear', 'lock', 
            'unlock', 'lockdown', 'setNick', 'role', 'slowmode'
        ];

        const serverCmds = data.moderation.commands || {};
        const serverStatuses = data.moderation.statuses || {};

        modCommands.forEach(cmd => {
            const inputEl = document.getElementById(`cmd_${cmd}`);
            if (inputEl) {
                inputEl.value = serverCmds[cmd] !== undefined ? serverCmds[cmd] : cmd;
            }
            const toggleEl = document.getElementById(`status_${cmd}`);
            if (toggleEl) {
                toggleEl.checked = serverStatuses[cmd] !== undefined ? serverStatuses[cmd] : true;
            }
        });
    } catch (error) {
        console.error("❌ خطأ أثناء تحميل إعدادات اللوحة:", error);
    }
}

// ==========================================================================
// 💾 تجميع وحفظ البيانات الكلية وإرسالها للـ API لتطبيقها على البوت فوراً
// ==========================================================================
async function saveAllData() {
    const cmdShortcuts = {};
    const cmdStatuses = {};
    const modCommands = [
        'ban', 'unban', 'kick', 'mute', 'unmute', 
        'jail', 'warn', 'warnings', 'clear', 'lock', 
        'unlock', 'lockdown', 'setNick', 'role', 'slowmode'
    ];

    modCommands.forEach(cmd => {
        const inputEl = document.getElementById(`cmd_${cmd}`);
        const toggleEl = document.getElementById(`status_${cmd}`);
        
        if (inputEl) cmdShortcuts[cmd] = inputEl.value;
        if (toggleEl) cmdStatuses[cmd] = toggleEl.checked;
    });

    const updatedConfig = {
        general: { serverLanguage: document.getElementById('serverLanguage').value },
        welcome: {
            enabled: document.getElementById('welcome_system_toggle').checked,
            welcomeChannel: document.getElementById('welcomeChannel').value,
            messageType: document.getElementById('welcomeMessageType').value,
            welcomeMessage: document.getElementById('welcomeMessage').value,
            welcomeImage: document.getElementById('welcomeImage').value,
            leaveEnabled: document.getElementById('leave_system_toggle').checked,
            leaveChannel: document.getElementById('leaveChannel').value,
            leaveMessageType: document.getElementById('leaveMessageType').value,
            leaveMessage: document.getElementById('leaveMessage').value,
            leaveImage: document.getElementById('leaveImage').value
        },
        autoReplies: currentReplies,
        autoRoles: { memberRoles: getSelectedOptions('memberRoles'), botRoles: getSelectedOptions('botRoles') },
        moderation: { commands: cmdShortcuts, statuses: cmdStatuses },
        ticket: {
            enabled: document.getElementById('probot_ticket_toggle').checked,
            useEmbed: document.getElementById('useEmbed').checked,
            claimSystemEnabled: document.getElementById('pClaimSystem').checked,
            adminPerms: { copy: document.getElementById('pAdminCopy').checked, close: true, delete: true },
            userPerms: { close: document.getElementById('pUserClose').checked },
            panels: ticketPanels
        },
        protection: {
            modRoles: getSelectedOptions('protectionModRoles'),
            banLimit: parseInt(document.getElementById('banLimit').value) || 0,
            banAction: document.getElementById('banAction').value,
            ownerOnlyLimits: document.getElementById('ownerOnlyLimits').checked
        }
    };

    try {
        const response = await fetch(`${API_BASE_URL}/api/save-settings`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(updatedConfig)
        });
        
        const resData = await response.json();
        alert(resData.message);
    } catch (error) {
        console.error("❌ فشل في حفظ البيانات وإرسالها للسيرفر:", error);
        alert("حدث خطأ أثناء الاتصال بالسيرفر، تأكد من تشغيل ملف server.js أولاً!");
    }
}

// ==========================================================================
// 🛠️ دالات فرعية مساعدة لبناء القوائم الديناميكية داخل اللوحة
// ==========================================================================
function renderAutoReplies() {
    const container = document.getElementById('repliesContainer');
    if (!container) return;
    container.innerHTML = '';
    
    if (currentReplies.length === 0) {
        container.innerHTML = `<p style="color:#6b7280; text-align:center; padding: 20px;">لا توجد أي ردود تلقائية مبرمجة حالياً.</p>`;
        return;
    }
    currentReplies.forEach((reply, idx) => {
        let channelOptions = '';
        serverChannelsCached.forEach(ch => {
            const isSelected = reply.allowedChannels && reply.allowedChannels.includes(ch.id);
            channelOptions += `<option value="${ch.id}" ${isSelected ? 'selected' : ''}>${ch.name}</option>`;
        });
        let roleOptions = '';
        serverRolesCached.forEach(role => {
            const isSelected = reply.allowedRoles && reply.allowedRoles.includes(role.id);
            roleOptions += `<option value="${role.id}" ${isSelected ? 'selected' : ''}>${role.name}</option>`;
        });
        container.innerHTML += `
            <div class="panel-pro-card reply-pro-card">
                <div class="panel-pro-header">
                    <span class="panel-badge-pro" style="background: var(--probot-blue)">رد تلقائي #${idx + 1}</span>
                    <div style="flex:1;"></div>
                    <button type="button" class="probot-btn-delete" onclick="currentReplies.splice(${idx},1); renderAutoReplies();">🗑️ إزالة الرد</button>
                </div>
                <div class="grid-2">
                    <div class="form-group"><label>الكلمة المفتاحية:</label><input type="text" value="${reply.keyword || ''}" oninput="currentReplies[${idx}].keyword=this.value"></div>
                    <div class="form-group">
                        <label>نوع التطابق:</label>
                        <select class="pro-select" onchange="currentReplies[${idx}].matchType=this.value">
                            <option value="exact" ${reply.matchType === 'exact' ? 'selected' : ''}>تطابق تام</option>
                            <option value="contains" ${reply.matchType === 'contains' ? 'selected' : ''}>تحتوي على الكلمة</option>
                        </select>
                    </div>
                </div>
                <div class="form-group"><label>الرد التلقائي:</label><textarea rows="2" oninput="currentReplies[${idx}].replyText=this.value">${reply.replyText || ''}</textarea></div>
            </div>`;
    });
}

function renderTicketPanels() {
    const container = document.getElementById('panelsContainer');
    if (!container) return;
    container.innerHTML = '';
    
    if (ticketPanels.length === 0) {
        container.innerHTML = `<p style="color:#6b7280; text-align:center; padding: 20px;">لا توجد أي لوحة تذاكر حالياً.</p>`;
        return;
    }
    ticketPanels.forEach((panel, idx) => {
        let channelOptions = `<option value="">-- اختر روم الإرسال --</option>`;
        serverChannelsCached.forEach(ch => { channelOptions += `<option value="${ch.id}" ${panel.channelId === ch.id ? 'selected' : ''}>${ch.name}</option>`; });
        container.innerHTML += `
            <div class="panel-pro-card">
                <div class="panel-pro-header">
                    <span class="panel-badge-pro">لوحة #${idx + 1}</span>
                    <input type="text" class="panel-title-input" value="${panel.name || ''}" oninput="ticketPanels[${idx}].name=this.value">
                    <button type="button" class="probot-btn-delete" onclick="ticketPanels.splice(${idx},1); renderTicketPanels();">🗑️ حذف اللوحة</button>
                </div>
                <div class="grid-2" style="margin-top: 15px;">
                    <div class="form-group"><label>روم الإرسال:</label><select onchange="ticketPanels[${idx}].channelId=this.value" class="pro-select">${channelOptions}</select></div>
                    <div class="form-group"><label>نص زر فتح التذكرة:</label><input type="text" value="${panel.buttonText || '📩 فتح تذكرة'}" oninput="ticketPanels[${idx}].buttonText=this.value"></div>
                </div>
            </div>`;
    });
}

function setSelectedOptions(selectId, valuesArray) { 
    const select = document.getElementById(selectId); 
    if(select && valuesArray) Array.from(select.options).forEach(opt => opt.selected = valuesArray.includes(opt.value)); 
}

function getSelectedOptions(selectId) { 
    const select = document.getElementById(selectId); 
    return select ? Array.from(select.selectedOptions).map(opt => opt.value) : []; 
}

// تشغيل جلب البيانات بمجرد فتح المتصفح لقراءة الإعدادات فوراً
window.onload = loadAllData;
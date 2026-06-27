const REDIRECT_URI = 'http://localhost:3000/index.html';
let serverChannelsCached = [];
let serverRolesCached = [];
let currentReplies = [];
let currentSelectedGuildId = null;

// دالة توجيه المستخدم لصفحة تسجيل الدخول في ديسكورد بالصلاحيات المطلوبة
function redirectToDiscord() {
    window.location.href = `${API_BASE_URL}/api/auth/discord`;
}

// دالة فحص وتدقيق كود الـ OAuth العائد في الرابط
async function checkAuthOnLoad() {
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get('code');
    
    if (code) {
        try {
            const res = await fetch(`${API_BASE_URL}/api/auth/callback?code=${code}`);
            const data = await res.json();
            if (data.success) {
                // إخفاء صفحة التسجيل وعرض صفحة السيرفرات المدارة فوراً
                switchTab('servers-tab');
                renderUserGuilds(data.guilds);
            }
        } catch (err) {
            console.error("خطأ أثناء معالجة تسجيل الدخول:", err);
        }
    }
}

// دالة عرض السيرفرات التي يملك فيها صلاحية والبوت متواجد فيها
function renderUserGuilds(guilds) {
    const container = document.getElementById('serversList');
    container.innerHTML = '';
    
    if (!guilds || guilds.length === 0) {
        container.innerHTML = `<p style="color:#6b7280; grid-column: 1/-1; text-align:center;">عذراً، لم نجد سيرفرات تمتلك فيها صلاحيات إدارية ويتواجد البوت بها.</p>`;
        return;
    }
    
    guilds.forEach(guild => {
        const iconUrl = guild.icon ? `https://cdn.discordapp.com/icons/${guild.id}/${guild.icon}.png` : '44.png';
        container.innerHTML += `
            <div class="server-card" onclick="selectServerToManage('${guild.id}')">
                <img src="${iconUrl}" class="server-icon" onerror="this.src='44.png'">
                <h4 style="margin:0; color:#fff;">${guild.name}</h4>
                <p style="margin:5px 0 0 0; font-size:12px; color:var(--success);">جاهز للإدارة</p>
            </div>
        `;
    });
}

// دالة الانتقال المباشر لصفحة الويب وإظهار القائمة الجانبية بعد اختيار السيرفر
async function selectServerToManage(guildId) {
    currentSelectedGuildId = guildId;
    document.getElementById('mainSidebar').style.display = 'flex';
    switchTab('general-tab');
    await loadAllData();
}

function switchTab(tabId) {
    document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active-tab'));
    document.querySelectorAll('.nav-link').forEach(el => el.classList.remove('active'));
    
    const targetTab = document.getElementById(tabId);
    if(targetTab) targetTab.classList.add('active-tab');
    
    const targetMenu = document.getElementById(`menu_${tabId.split('-')[0]}`);
    if (targetMenu) targetMenu.classList.add('active');
}

function copyVar(text) {
    navigator.clipboard.writeText(text);
    alert("تم نسخ المتغير الذكي: " + text);
}

function updateWelcomePreviewVisibility() {
    const type = document.getElementById('welcomeMessageType').value;
    document.getElementById('welcome_image_input_group').style.display = (type === 'image') ? 'block' : 'none';
}

function handleFileUpload(inputElement, targetInputId) {
    const file = inputElement.files[0];
    if (file) document.getElementById(targetInputId).value = `https://cdn.discordapp.com/attachments/${file.name}`;
}

async function loadServerMetadata() {
    try {
        const resMeta = await fetch(`${API_BASE_URL}/api/get-server-meta?guildId=${currentSelectedGuildId}`);
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

async function loadAllData() {
    if (!currentSelectedGuildId) return;
    await loadServerMetadata();

    try {
        const res = await fetch(`${API_BASE_URL}/api/get-settings?guildId=${currentSelectedGuildId}`);
        const data = await res.json();

        document.getElementById('serverLanguage').value = data.general.serverLanguage;
        document.getElementById('welcome_system_toggle').checked = data.welcome.enabled !== undefined ? data.welcome.enabled : true;
        document.getElementById('welcomeChannel').value = data.welcome.welcomeChannel || '';
        document.getElementById('welcomeMessageType').value = data.welcome.messageType || 'text';
        document.getElementById('welcomeMessage').value = data.welcome.welcomeMessage || '';
        document.getElementById('welcomeImage').value = data.welcome.welcomeImage || '';
        
        updateWelcomePreviewVisibility();
        currentReplies = data.autoReplies || [];
        renderAutoReplies();

        setSelectedOptions('memberRoles', data.autoRoles.memberRoles);
        setSelectedOptions('botRoles', data.autoRoles.botRoles);

        const modCommands = ['ban', 'kick'];
        const serverCmds = data.moderation.commands || {};
        const serverStatuses = data.moderation.statuses || {};

        modCommands.forEach(cmd => {
            const inputEl = document.getElementById(`cmd_${cmd}`);
            if (inputEl) inputEl.value = serverCmds[cmd] !== undefined ? serverCmds[cmd] : cmd;
            const toggleEl = document.getElementById(`status_${cmd}`);
            if (toggleEl) toggleEl.checked = serverStatuses[cmd] !== undefined ? serverStatuses[cmd] : true;
        });
    } catch (error) {
        console.error("❌ خطأ أثناء تحميل إعدادات اللوحة:", error);
    }
}

async function saveAllData() {
    if (!currentSelectedGuildId) return;
    const cmdShortcuts = {};
    const cmdStatuses = {};
    const modCommands = ['ban', 'kick'];

    modCommands.forEach(cmd => {
        const inputEl = document.getElementById(`cmd_${cmd}`);
        const toggleEl = document.getElementById(`status_${cmd}`);
        if (inputEl) cmdShortcuts[cmd] = inputEl.value;
        if (toggleEl) cmdStatuses[cmd] = toggleEl.checked;
    });

    const updatedConfig = {
        guildId: currentSelectedGuildId,
        general: { serverLanguage: document.getElementById('serverLanguage').value },
        welcome: {
            enabled: document.getElementById('welcome_system_toggle').checked,
            welcomeChannel: document.getElementById('welcomeChannel').value,
            messageType: document.getElementById('welcomeMessageType').value,
            welcomeMessage: document.getElementById('welcomeMessage').value,
            welcomeImage: document.getElementById('welcomeImage').value
        },
        autoReplies: currentReplies,
        autoRoles: { memberRoles: getSelectedOptions('memberRoles'), botRoles: getSelectedOptions('botRoles') },
        moderation: { commands: cmdShortcuts, statuses: cmdStatuses }
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
        alert("حدث خطأ أثناء الاتصال بالسيرفر الخلفي!");
    }
}

function setSelectedOptions(selectId, valuesArray) { 
    const select = document.getElementById(selectId); 
    if(select && valuesArray) Array.from(select.options).forEach(opt => opt.selected = valuesArray.includes(opt.value)); 
}

function getSelectedOptions(selectId) { 
    const select = document.getElementById(selectId); 
    return select ? Array.from(select.selectedOptions).map(opt => opt.value) : []; 
}

window.onload = checkAuthOnLoad;
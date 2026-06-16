console.log('小猫农场启动 - 庭院摸猫暂停换图版');

// ======================= 1. 键盘布局（104键物理排布） =======================
const keyboardLayout = [
    ['Esc', 'F1', 'F2', 'F3', 'F4', 'F5', 'F6', 'F7', 'F8', 'F9', 'F10', 'F11', 'F12', 'PrtSc', 'Scrlk', 'Pause'],
    ['`', '1', '2', '3', '4', '5', '6', '7', '8', '9', '0', '-', '=', 'Backspace'],
    ['Tab', 'Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P', '[', ']', '\\'],
    ['CapsLock', 'A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L', ';', '\'', 'Enter'],
    ['Shift', 'Z', 'X', 'C', 'V', 'B', 'N', 'M', ',', '.', '/', 'Shift_R'],
    ['Ctrl', 'Win', 'Alt', 'Space', 'Alt_R', 'Win_R', 'Menu', 'Ctrl_R'],
    ['Insert', 'Home', 'PageUp', 'Delete', 'End', 'PageDown', 'Up', 'Down', 'Left', 'Right'],
    ['NumLock', 'NumpadDivide', 'NumpadMultiply', 'NumpadSubtract', 'Numpad7', 'Numpad8', 'Numpad9', 'NumpadAdd', 'Numpad4', 'Numpad5', 'Numpad6', 'NumpadDecimal', 'Numpad1', 'Numpad2', 'Numpad3', 'Numpad0']
];
const visibleKeys = keyboardLayout.flat();

// ======================= 2. 游戏数据 =======================
let gameData = {
    gold: 350,
    rareCurrency: 5,
    ownedCats: [],
    inventory: {},
    ponds: {},
    keyPressStats: {},
    lastOnlineTime: Date.now(),
    todayFishCount: 0,
    lastDailyReset: new Date().toDateString()
};

const fishDB = {
    minnow: { name: '小银鱼', value: 5, emoji: '🐟' },
    shrimp: { name: '小虾米', value: 8, emoji: '🦐' },
    carp: { name: '锦鲤', value: 20, emoji: '🎏' },
    goldfish: { name: '金鱼', value: 35, emoji: '🐠' },
    koi: { name: '梦幻龙鳞', value: 120, emoji: '🐉' }
};

const catShop = [
    { id: 'ginger', name: '橘胖', price: 200, emoji: '🐈', baseHappiness: 60 },
    { id: 'white', name: '雪球', price: 350, emoji: '🐩', baseHappiness: 60 },
    { id: 'black', name: '墨墨', price: 500, emoji: '🐈‍⬛', baseHappiness: 60 }
];

// 初始化池塘
visibleKeys.forEach(key => {
    if (!gameData.ponds[key]) gameData.ponds[key] = { catId: null, fishMult: 1.0 };
});
if (gameData.ownedCats.length === 0) {
    gameData.ownedCats.push({ ...catShop[0], uniqueId: 'cat0', happiness: 60, level: 1, currentPondKey: null });
}

// ======================= 3. 音效管理器（支持BGM切换） =======================
class SoundManager {
    constructor() {
        this.config = { bgmEnabled: true, fishEnabled: true, meowEnabled: true, otherEnabled: true, bgmVolume: 0.3 };
        this.meowFiles = [];
        this.bgmAudio = null;
        this.currentBgm = 'bgm.mp3';
        this.lastFishPlayTime = 0;
        this.lastMeowPlayTime = 0;
        this.isReady = false;
        this.init();
    }
    async init() {
        this.loadUserSettings();
        await this.scanMeowFiles();
        this.initBgm('bgm.mp3');
        this.isReady = true;
        console.log('音效管理器就绪，猫叫文件列表:', this.meowFiles);
    }
    loadUserSettings() {
        const saved = localStorage.getItem('soundConfig');
        if (saved) try { Object.assign(this.config, JSON.parse(saved)); } catch(e) {}
    }
    saveSettings() {
        localStorage.setItem('soundConfig', JSON.stringify(this.config));
    }
    async scanMeowFiles() {
        try {
            let files = [];
            if (window.electronAPI) {
                try {
                    files = await window.electronAPI.getSoundFiles();
                    console.log('getSoundFiles 返回:', files);
                } catch(e) {
                    console.warn('调用 getSoundFiles 失败:', e);
                }
            }
            let meowFiles = files
                .map(f => {
                    const parts = f.split(/[\/\\]/);
                    return parts[parts.length - 1];
                })
                .filter(f => /^meow.*\.mp3$/i.test(f));
            if (meowFiles.length === 0) {
                const possible = [];
                for (let i = 1; i <= 8; i++) possible.push(`meow${i}.mp3`);
                possible.push('meow.mp3');
                meowFiles = [...new Set(possible)];
                console.log('未从 API 获取到文件，使用硬编码列表:', meowFiles);
            }
            this.meowFiles = meowFiles;
        } catch(e) {
            console.warn('扫描猫叫文件失败:', e);
            this.meowFiles = ['meow1.mp3', 'meow2.mp3', 'meow3.mp3', 'meow4.mp3', 'meow5.mp3', 'meow6.mp3', 'meow7.mp3', 'meow8.mp3'];
        }
        if (this.meowFiles.length === 0) {
            this.meowFiles = ['meow.mp3'];
            console.warn('未找到猫叫文件，使用默认 meow.mp3');
        }
    }
    initBgm(fileName = 'bgm.mp3') {
        if (!this.config.bgmEnabled) return;
        try {
            if (this.bgmAudio) {
                this.bgmAudio.pause();
                this.bgmAudio.src = '';
            }
            this.bgmAudio = new Audio(`sounds/${fileName}`);
            this.bgmAudio.loop = true;
            this.bgmAudio.volume = this.config.bgmVolume;
            this.bgmAudio.play().catch(() => {});
            this.currentBgm = fileName;
        } catch(e) {}
    }
    switchBgm(fileName) {
        if (this.currentBgm === fileName) return;
        this.initBgm(fileName);
    }
    setBgmVolume(vol) {
        this.config.bgmVolume = vol;
        if (this.bgmAudio) this.bgmAudio.volume = vol;
        this.saveSettings();
    }
    toggleBgm(enable) {
        this.config.bgmEnabled = enable;
        if (enable) {
            if (!this.bgmAudio || this.bgmAudio.paused) this.initBgm(this.currentBgm);
            else if (this.bgmAudio) this.bgmAudio.play().catch(()=>{});
        } else {
            if (this.bgmAudio) this.bgmAudio.pause();
        }
        this.saveSettings();
    }
    playFishSound() {
        if (!this.config.fishEnabled) return;
        const now = Date.now();
        if (now - this.lastFishPlayTime < 200) return;
        this.lastFishPlayTime = now;
        this.playFile('water.mp3');
    }
    playMeowSound() {
        if (!this.config.meowEnabled) return;
        const now = Date.now();
        if (now - this.lastMeowPlayTime < 150) return;
        this.lastMeowPlayTime = now;
        let fileToPlay;
        if (this.meowFiles.length > 0) {
            const randomIndex = Math.floor(Math.random() * this.meowFiles.length);
            fileToPlay = this.meowFiles[randomIndex];
        } else {
            fileToPlay = 'meow.mp3';
        }
        console.log('播放猫叫:', fileToPlay);
        this.playFile(fileToPlay);
    }
    playOtherSound(file) {
        if (!this.config.otherEnabled) return;
        this.playFile(file);
    }
    playFile(fileName) {
        try {
            const audio = new Audio(`sounds/${fileName}`);
            audio.volume = 0.5;
            audio.play().catch(err => {
                console.debug('音效播放失败:', fileName, err);
            });
        } catch(e) {
            console.debug('音效创建失败:', fileName, e);
        }
    }
    updateUI() {
        const bgmToggle = document.getElementById('toggleBgm');
        if (bgmToggle) bgmToggle.checked = this.config.bgmEnabled;
        const fishToggle = document.getElementById('toggleFishSound');
        if (fishToggle) fishToggle.checked = this.config.fishEnabled;
        const meowToggle = document.getElementById('toggleMeowSound');
        if (meowToggle) meowToggle.checked = this.config.meowEnabled;
        const otherToggle = document.getElementById('toggleOtherSound');
        if (otherToggle) otherToggle.checked = this.config.otherEnabled;
        const bgmVol = document.getElementById('bgmVolume');
        if (bgmVol) bgmVol.value = this.config.bgmVolume * 100;
    }
}
const soundMgr = new SoundManager();

// ======================= 4. 键盘启用/禁用控制 =======================
let isKeyboardEnabled = true;
function setKeyboardEnabled(enabled) {
    isKeyboardEnabled = enabled;
    const modeIndicator = document.getElementById('modeIndicator');
    if (modeIndicator) {
        if (enabled) {
            modeIndicator.innerText = '⌨️ 监听模式: ' + (globalListenerAvailable ? '全局键盘 (后台可用)' : '窗口内键盘 (需激活窗口)');
        } else {
            modeIndicator.innerText = '🔇 键盘监听已暂停 (庭院模式)';
        }
    }
}
let globalListenerAvailable = false;

// ======================= 5. 辅助函数 =======================
function saveGame() {
    gameData.lastOnlineTime = Date.now();
    localStorage.setItem('kittyFarmSave', JSON.stringify(gameData));
}
function loadGame() {
    const saved = localStorage.getItem('kittyFarmSave');
    if (saved) {
        try {
            const old = JSON.parse(saved);
            Object.assign(gameData, old);
            visibleKeys.forEach(k => {
                if (!gameData.ponds[k]) gameData.ponds[k] = { catId: null, fishMult: 1.0 };
            });
            const offlineSeconds = (Date.now() - (gameData.lastOnlineTime || Date.now())) / 1000;
            if (offlineSeconds > 10 && offlineSeconds < 86400 * 7) calculateOfflineGain(offlineSeconds);
        } catch(e) { console.warn(e); }
    }
    checkDailyReset();
    updateUI();
}
function calculateOfflineGain(seconds) {
    let totalFish = 0;
    for (let key in gameData.ponds) {
        const pond = gameData.ponds[key];
        if (pond.catId) {
            const cat = gameData.ownedCats.find(c => c.uniqueId === pond.catId);
            if (cat) {
                const happinessBonus = 0.5 + (cat.happiness / 200);
                const fishCount = Math.floor(seconds * 0.0004 * happinessBonus);
                totalFish += fishCount;
                cat.happiness = Math.max(0, cat.happiness - Math.floor(seconds / 7200));
            }
        }
    }
    if (totalFish > 0) {
        addFish('minnow', Math.min(totalFish, 200));
        showSystemMessage(`✨ 离线期间猫咪们为你捕到 ${totalFish} 条小鱼！`);
    }
    saveGame();
}
function checkDailyReset() {
    const today = new Date().toDateString();
    if (gameData.lastDailyReset !== today) {
        gameData.todayFishCount = 0;
        gameData.lastDailyReset = today;
        saveGame();
    }
}
function addFish(fishId, amount = 1) {
    if (!gameData.inventory[fishId]) gameData.inventory[fishId] = 0;
    gameData.inventory[fishId] += amount;
    gameData.todayFishCount += amount;
    updateUI();
    saveGame();
}
function showFloatingMessage(msg, key) {
    const tile = document.querySelector(`.key-tile[data-key='${key}']`);
    if (tile) {
        const float = document.createElement('div');
        float.className = 'float-msg';
        float.innerText = msg;
        tile.style.position = 'relative';
        tile.appendChild(float);
        setTimeout(() => float.remove(), 800);
    }
}
function showSystemMessage(msg) {
    const toast = document.createElement('div');
    toast.style.position = 'fixed';
    toast.style.bottom = '20px';
    toast.style.right = '20px';
    toast.style.background = '#2e4a3e';
    toast.style.color = 'white';
    toast.style.padding = '8px 16px';
    toast.style.borderRadius = '40px';
    toast.style.zIndex = 999;
    toast.innerText = msg;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
}

// ======================= 6. 钓鱼核心逻辑 =======================
let keyPressTimers = {};
function attemptFishing(key, isLongPress = false, isCombo = false) {
    const pond = gameData.ponds[key];
    if (!pond) return false;
    let fishChance = 0.35;
    let catBonus = 1.0;
    if (pond.catId) {
        const cat = gameData.ownedCats.find(c => c.uniqueId === pond.catId);
        if (cat) catBonus = 0.8 + (cat.happiness / 100);
        if (isLongPress) catBonus *= 1.2;
    }
    fishChance *= catBonus;
    if (isLongPress) fishChance = Math.min(0.85, fishChance + 0.3);
    if (isCombo) fishChance = Math.min(0.95, fishChance + 0.4);
    
    if (Math.random() < fishChance) {
        let fishType = 'minnow';
        const r = Math.random();
        if (r < 0.05) fishType = 'koi';
        else if (r < 0.15) fishType = 'goldfish';
        else if (r < 0.35) fishType = 'carp';
        else if (r < 0.6) fishType = 'shrimp';
        addFish(fishType, 1);
        if (pond.catId) {
            const cat = gameData.ownedCats.find(c => c.uniqueId === pond.catId);
            if (cat) cat.happiness = Math.min(100, cat.happiness + 3);
        }
        soundMgr.playFishSound();
        showFloatingMessage(`🎣 钓到 ${fishDB[fishType].name}!`, key);
        return true;
    } else {
        showFloatingMessage(`💧 没钓到鱼...`, key);
        return false;
    }
}
function handleKeyPress(key) {
    if (!isKeyboardEnabled) return;
    if (!key || !gameData.ponds[key]) return;
    if (!gameData.keyPressStats[key]) gameData.keyPressStats[key] = { count: 0, recent: [] };
    const stats = gameData.keyPressStats[key];
    const now = Date.now();
    stats.count++;
    stats.recent = stats.recent.filter(t => now - t < 2000);
    stats.recent.push(now);
    const isHighFreq = stats.recent.length >= 4;
    
    if (keyPressTimers[key]) clearTimeout(keyPressTimers[key]);
    keyPressTimers[key] = setTimeout(() => {
        attemptFishing(key, true, false);
        delete keyPressTimers[key];
    }, 380);
    
    if (Math.random() < 0.15) {
        gameData.gold += 1;
        showFloatingMessage(`🍘 +1小鱼干`, key);
    }
    if (isHighFreq && Math.random() < 0.5) {
        attemptFishing(key, false, true);
        showFloatingMessage(`✨ 鱼群爆发!`, key);
    }
    soundMgr.playOtherSound('keypress.mp3');
    updateUI();
    saveGame();
}
function onKeyUp(key) {
    if (!isKeyboardEnabled) return;
    if (keyPressTimers[key]) {
        clearTimeout(keyPressTimers[key]);
        delete keyPressTimers[key];
        attemptFishing(key, false, false);
    }
}
function animateKeyTile(key) {
    const tile = document.querySelector(`.key-tile[data-key='${key}']`);
    if (tile) tile.classList.add('wave-animation');
    setTimeout(() => tile?.classList.remove('wave-animation'), 300);
}

// ======================= 7. 鱼群活跃状态随机系统 =======================
let keyActiveStatus = {};
let activeInterval = null;
function startRandomActiveEvents() {
    if (activeInterval) clearInterval(activeInterval);
    activeInterval = setInterval(() => {
        const num = Math.floor(Math.random() * 3) + 1;
        const shuffled = [...visibleKeys];
        for (let i = shuffled.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        }
        for (let i = 0; i < num; i++) {
            const key = shuffled[i];
            const duration = 5000 + Math.random() * 7000;
            keyActiveStatus[key] = Date.now() + duration;
        }
        renderKeyboard();
        setTimeout(() => {
            let changed = false;
            for (let k in keyActiveStatus) {
                if (keyActiveStatus[k] < Date.now()) {
                    delete keyActiveStatus[k];
                    changed = true;
                }
            }
            if (changed) renderKeyboard();
        }, Math.max(...Object.values(keyActiveStatus).map(v => v - Date.now()), 1000));
    }, 15000);
}

// ======================= 8. UI 渲染（键盘网格） =======================
function renderKeyboard() {
    const container = document.getElementById('keyboardGrid');
    if (!container) return;
    container.innerHTML = '';
    container.style.display = 'grid';
    container.style.gridTemplateColumns = 'repeat(16, 64px)';
    container.style.gap = '4px';
    container.style.justifyContent = 'center';
    const now = Date.now();
    for (let row = 0; row < keyboardLayout.length; row++) {
        const keys = keyboardLayout[row];
        for (let col = 0; col < keys.length; col++) {
            const key = keys[col];
            const pond = gameData.ponds[key];
            const hasCat = pond && pond.catId !== null;
            const isActive = keyActiveStatus[key] && keyActiveStatus[key] > now;
            let mainIcon = '🐟';
            if (hasCat) mainIcon = '🐱';
            else if (isActive) mainIcon = '💧';
            else mainIcon = '🐟';
            const div = document.createElement('div');
            div.className = 'key-tile';
            div.setAttribute('data-key', key);
            div.style.gridRow = row + 1;
            div.style.gridColumn = col + 1;
            div.innerHTML = `<div class="key-label">${key}</div><div class="key-status">${mainIcon}</div>`;
            if (isActive && hasCat) div.style.boxShadow = '0 0 8px #00aaff';
            else div.style.boxShadow = '';
            div.onclick = () => handleKeyPress(key);
            container.appendChild(div);
        }
    }
}

// ======================= 9. 改名功能 =======================
let renameTargetCat = null;
function showRenameModal(cat) {
    renameTargetCat = cat;
    const modal = document.getElementById('renameModal');
    if (!modal) {
        createRenameModal();
        document.getElementById('renameModal').style.display = 'flex';
    } else {
        modal.style.display = 'flex';
    }
    const input = document.getElementById('renameInput');
    if (input) {
        input.value = cat.name;
        input.focus();
        input.select();
    }
    const label = document.getElementById('renameLabel');
    if (label) label.innerText = `修改 ${cat.name} 的名字`;
}
function closeRenameModal() {
    const modal = document.getElementById('renameModal');
    if (modal) modal.style.display = 'none';
    renameTargetCat = null;
}
function confirmRename() {
    if (!renameTargetCat) return;
    const input = document.getElementById('renameInput');
    const newName = input.value.trim();
    if (newName === '') {
        alert('名字不能为空');
        return;
    }
    renameTargetCat.name = newName;
    saveGame();
    updateUI();
    showSystemMessage(`✅ 猫咪已改名为 “${newName}”`);
    closeRenameModal();
}
function createRenameModal() {
    const modal = document.createElement('div');
    modal.id = 'renameModal';
    modal.className = 'modal';
    modal.innerHTML = `
        <div class="modal-content" style="max-width: 400px;">
            <span class="close" id="renameCloseBtn">&times;</span>
            <h3 id="renameLabel">修改猫咪名字</h3>
            <input type="text" id="renameInput" placeholder="输入新名字" style="width: 100%; padding: 8px; margin: 10px 0; border-radius: 20px; border: 1px solid #ccc;">
            <div style="display: flex; gap: 10px; justify-content: flex-end;">
                <button id="renameCancelBtn" class="tiny-btn">取消</button>
                <button id="renameConfirmBtn" class="action-btn" style="margin-top: 0;">确认</button>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
    document.getElementById('renameCloseBtn').onclick = closeRenameModal;
    document.getElementById('renameCancelBtn').onclick = closeRenameModal;
    document.getElementById('renameConfirmBtn').onclick = confirmRename;
    modal.onclick = (e) => { if (e.target === modal) closeRenameModal(); };
    document.getElementById('renameInput').addEventListener('keydown', (e) => {
        if (e.key === 'Enter') confirmRename();
    });
}

// ======================= 10. 派驻猫咪相关 =======================
let currentAssignCat = null;
function showAssignModal(cat) {
    currentAssignCat = cat;
    const modal = document.getElementById('assignModal');
    const catNameSpan = document.getElementById('assignCatName');
    const input = document.getElementById('assignKeyInput');
    if (modal && catNameSpan) {
        catNameSpan.innerText = `将 ${cat.name} 派驻到哪个键位？`;
        input.value = cat.currentPondKey || '';
        modal.style.display = 'flex';
        input.focus();
    }
}
function closeAssignModal() {
    const modal = document.getElementById('assignModal');
    if (modal) modal.style.display = 'none';
    currentAssignCat = null;
}
function confirmAssign() {
    if (!currentAssignCat) return;
    const input = document.getElementById('assignKeyInput');
    let targetKey = input.value.trim();
    if (targetKey === '') { alert('请输入键位名称'); return; }
    const matched = visibleKeys.find(k => k.toLowerCase() === targetKey.toLowerCase());
    if (matched) {
        targetKey = matched;
        for (let k in gameData.ponds) if (gameData.ponds[k].catId === currentAssignCat.uniqueId) gameData.ponds[k].catId = null;
        gameData.ponds[targetKey].catId = currentAssignCat.uniqueId;
        currentAssignCat.currentPondKey = targetKey;
        saveGame();
        updateUI();
        showFloatingMessage(`🐱 ${currentAssignCat.name} 已派驻到 ${targetKey} 键`, targetKey);
        closeAssignModal();
    } else alert(`未找到键位 "${targetKey}"，请从键盘列表中选择。`);
}

// ======================= 11. 猫咪列表渲染 =======================
function renderCats() {
    const container = document.getElementById('catsList');
    if (!container) return;
    container.innerHTML = '';
    gameData.ownedCats.forEach(cat => {
        const div = document.createElement('div');
        div.className = 'cat-card';
        div.setAttribute('data-cat-id', cat.uniqueId);
        div.innerHTML = `
            <div class="cat-avatar">${cat.emoji}</div>
            <div class="cat-name" style="font-weight: bold; font-size: 0.9rem;">${cat.name}</div>
            <div style="font-size: 0.8rem;">❤️ ${cat.happiness}</div>
            <div style="display: flex; gap: 4px; margin-top: 6px; flex-wrap: wrap; justify-content: center;">
                <button class="tiny-btn assign-cat" data-id="${cat.uniqueId}">派驻</button>
                <button class="tiny-btn pet-cat-btn" data-cat-id="${cat.uniqueId}">🐾 抚摸</button>
                <button class="tiny-btn rename-cat" data-id="${cat.uniqueId}" style="background: #e8e0d0;">改名</button>
            </div>
        `;
        container.appendChild(div);
    });

    document.querySelectorAll('.assign-cat').forEach(btn => {
        btn.removeEventListener('click', window._assignHandler);
        const handler = (e) => {
            e.stopPropagation();
            const catId = btn.getAttribute('data-id');
            const cat = gameData.ownedCats.find(c => c.uniqueId === catId);
            if (cat) showAssignModal(cat);
        };
        btn.addEventListener('click', handler);
        btn._assignHandler = handler;
    });

    document.querySelectorAll('.pet-cat-btn').forEach(btn => {
        btn.removeEventListener('click', window._petHandler);
        const handler = (e) => {
            e.stopPropagation();
            const catId = btn.getAttribute('data-cat-id');
            const cat = gameData.ownedCats.find(c => c.uniqueId === catId);
            if (cat) {
                cat.happiness = Math.min(100, cat.happiness + 5);
                gameData.gold += 10;
                updateUI();
                soundMgr.playMeowSound();
                showFloatingMessage(`🐾 抚摸${cat.name}，+5❤️ +10🐟`, cat.currentPondKey || 'cat');
            }
        };
        btn.addEventListener('click', handler);
        btn._petHandler = handler;
    });

    document.querySelectorAll('.rename-cat').forEach(btn => {
        btn.removeEventListener('click', window._renameHandler);
        const handler = (e) => {
            e.stopPropagation();
            const catId = btn.getAttribute('data-id');
            const cat = gameData.ownedCats.find(c => c.uniqueId === catId);
            if (cat) {
                if (!document.getElementById('renameModal')) createRenameModal();
                showRenameModal(cat);
            }
        };
        btn.addEventListener('click', handler);
        btn._renameHandler = handler;
    });

    setupDragDrop();
}

// ======================= 12. 背包与拖拽 =======================
function renderInventory() {
    const container = document.getElementById('fishInventory');
    if (!container) return;
    container.innerHTML = '';
    for (let [fishId, qty] of Object.entries(gameData.inventory)) {
        if (qty > 0) {
            const fish = fishDB[fishId];
            const item = document.createElement('div');
            item.className = 'fish-item';
            item.setAttribute('data-fish-id', fishId);
            item.setAttribute('draggable', 'true');
            item.innerHTML = `${fish.emoji} ${fish.name} x${qty} <span style="margin-left:5px;">💰${fish.value}</span>`;
            item.addEventListener('dragstart', (e) => { e.dataTransfer.setData('text/plain', fishId); e.dataTransfer.effectAllowed = 'copy'; });
            item.onclick = (e) => {
                if (e.shiftKey) {
                    gameData.inventory[fishId]--;
                    if (gameData.inventory[fishId] === 0) delete gameData.inventory[fishId];
                    gameData.gold += fish.value;
                    updateUI();
                    saveGame();
                }
            };
            container.appendChild(item);
        }
    }
}
function setupDragDrop() {
    const catCards = document.querySelectorAll('.cat-card');
    catCards.forEach(catDiv => {
        catDiv.addEventListener('dragover', (e) => e.preventDefault());
        catDiv.addEventListener('dragenter', (e) => catDiv.classList.add('drag-over'));
        catDiv.addEventListener('dragleave', (e) => catDiv.classList.remove('drag-over'));
        catDiv.addEventListener('drop', (e) => {
            e.preventDefault();
            catDiv.classList.remove('drag-over');
            const fishId = e.dataTransfer.getData('text/plain');
            const catId = catDiv.getAttribute('data-cat-id');
            const cat = gameData.ownedCats.find(c => c.uniqueId === catId);
            if (cat && fishId && gameData.inventory[fishId] > 0) {
                gameData.inventory[fishId]--;
                if (gameData.inventory[fishId] === 0) delete gameData.inventory[fishId];
                cat.happiness = Math.min(100, cat.happiness + 15);
                gameData.gold += fishDB[fishId].value * 2;
                updateUI();
                soundMgr.playMeowSound();
                showFloatingMessage(`🍽️ 喂食${fishDB[fishId].name}，${cat.name}开心+15`, cat.currentPondKey || 'cat');
                saveGame();
            }
        });
    });
}

// ======================= 13. 商店（四猫限制） =======================
function renderShop() {
    const container = document.getElementById('shopItems');
    if (!container) return;
    container.innerHTML = '';
    catShop.forEach(cat => {
        const div = document.createElement('div');
        div.className = 'shop-item';
        div.innerHTML = `<span>${cat.emoji} ${cat.name} 🐟${cat.price}</span><button class="buy-cat" data-id="${cat.id}">收养</button>`;
        const btn = div.querySelector('.buy-cat');
        btn.addEventListener('click', () => {
            if (gameData.gold < cat.price) {
                alert('小鱼干不足');
                return;
            }

            if (gameData.ownedCats.length >= 4) {
                const randomIndex = Math.floor(Math.random() * gameData.ownedCats.length);
                const removedCat = gameData.ownedCats[randomIndex];
                gameData.ownedCats.splice(randomIndex, 1);
                for (let key in gameData.ponds) {
                    if (gameData.ponds[key].catId === removedCat.uniqueId) {
                        gameData.ponds[key].catId = null;
                    }
                }
                showSystemMessage(`⚠️ 你的庭院太挤了，小猫 ${removedCat.name} 去了其他人的院子，不要放置超过4只小猫`);
                const newCat = { ...cat, uniqueId: Date.now() + '_' + Math.random(), happiness: 60, level: 1, currentPondKey: null };
                gameData.ownedCats.push(newCat);
                gameData.gold -= cat.price;
                saveGame();
                updateUI();
                soundMgr.playOtherSound('meow.mp3');
                showSystemMessage(`🎉 新猫咪 ${cat.name} 加入农场！`);
            } else {
                gameData.gold -= cat.price;
                const newCat = { ...cat, uniqueId: Date.now() + '_' + Math.random(), happiness: 60, level: 1, currentPondKey: null };
                gameData.ownedCats.push(newCat);
                saveGame();
                updateUI();
                soundMgr.playOtherSound('meow.mp3');
                showSystemMessage(`🎉 新猫咪 ${cat.name} 加入农场！`);
            }
        });
        container.appendChild(div);
    });
}

function updateUI() {
    document.getElementById('goldAmount').innerText = Math.floor(gameData.gold);
    document.getElementById('rareCurrency').innerText = gameData.rareCurrency;
    document.getElementById('todayFish').innerText = gameData.todayFishCount;
    renderKeyboard();
    renderCats();
    renderInventory();
    renderShop();
}

function generateDiary() {
    let totalPresses = 0, busiestKey = { key: '', count: 0 };
    for (let [k, stat] of Object.entries(gameData.keyPressStats)) {
        totalPresses += stat.count;
        if (stat.count > busiestKey.count) busiestKey = { key: k, count: stat.count };
    }
    const catStatus = gameData.ownedCats.map(c => `${c.name}(❤️${c.happiness})`).join(', ');
    return `
        <p>🐾 统计周期: ${new Date().toLocaleDateString()}</p>
        <p>⌨️ 总敲击次数: ${totalPresses}</p>
        <p>🏆 最忙池塘键: ${busiestKey.key} (${busiestKey.count}次)</p>
        <p>🐟 今日钓获: ${gameData.todayFishCount}条鱼</p>
        <p>🐱 猫咪陪伴: ${catStatus}</p>
        <p>✨ 趣味标签: ${busiestKey.count > 300 ? '键盘大师' : '温柔敲击者'}，${gameData.todayFishCount > 50 ? '钓鱼高手' : '佛系钓鱼'}</p>
        <p>❤️ 提示: 多抚摸猫咪可以增加亲密值，提高钓鱼效率～</p>
    `;
}

// ======================= 14. 庭院视图（核心修改：摸猫暂停+换图） =======================
let gardenAnimationId = null;
let gardenCats = [];
let isGardenViewActive = false;

function initGardenView() {
    const canvas = document.getElementById('gardenCanvas');
    if (!canvas) return;
    canvas.innerHTML = '';
    gardenCats = [];
    const width = canvas.clientWidth || 800;
    const height = canvas.clientHeight || 500;

    gameData.ownedCats.forEach((cat, index) => {
        const div = document.createElement('div');
        div.className = 'cat-sprite';
        div.setAttribute('data-cat-id', cat.uniqueId);
        div.style.position = 'absolute';
        div.style.width = '80px';
        div.style.height = '80px';
        div.style.left = Math.random() * (width - 80) + 'px';
        div.style.top = Math.random() * (height - 80) + 'px';
        div.style.cursor = 'pointer';
        div.style.zIndex = 5;

        const img = document.createElement('img');
        img.style.width = '80px';
        img.style.height = '80px';
        img.style.objectFit = 'contain';
        img.alt = cat.emoji;
        const originalSrc = `box/cat${index + 1}.gif`;
        img.src = originalSrc;
        let fallbackDiv = null;

        img.onerror = function() {
            this.style.display = 'none';
            fallbackDiv = document.createElement('div');
            fallbackDiv.style.width = '80px';
            fallbackDiv.style.height = '80px';
            fallbackDiv.style.fontSize = '64px';
            fallbackDiv.style.textAlign = 'center';
            fallbackDiv.style.lineHeight = '80px';
            fallbackDiv.innerText = cat.emoji;
            div.appendChild(fallbackDiv);
        };
        div.appendChild(img);

        const vx = (Math.random() - 0.5) * 1.5;
        const vy = (Math.random() - 0.5) * 1.5;

        div.addEventListener('click', (e) => {
            e.stopPropagation();
            petCatInGarden(cat.uniqueId, e);
        });

        canvas.appendChild(div);
        gardenCats.push({
            dom: div,
            img: img,
            fallback: fallbackDiv,
            originalSrc: originalSrc,
            origVx: vx,
            origVy: vy,
            vx: vx,
            vy: vy,
            width: 80,
            height: 80,
            catId: cat.uniqueId,
            isPaused: false,
            restoreTimer: null
        });
    });

    startGardenAnimation();
}

function startGardenAnimation() {
    if (gardenAnimationId) cancelAnimationFrame(gardenAnimationId);
    const canvas = document.getElementById('gardenCanvas');
    if (!canvas) return;
    let width = canvas.clientWidth, height = canvas.clientHeight;
    function updateDimensions() { width = canvas.clientWidth; height = canvas.clientHeight; }
    function animate() {
        if (!isGardenViewActive) return;
        updateDimensions();
        gardenCats.forEach(cat => {
            if (cat.isPaused) return; // 暂停状态不移动
            let left = parseFloat(cat.dom.style.left);
            let top = parseFloat(cat.dom.style.top);
            left += cat.vx;
            top += cat.vy;
            if (left <= 0) { left = 0; cat.vx = Math.abs(cat.vx); }
            if (left + cat.width >= width) { left = width - cat.width; cat.vx = -Math.abs(cat.vx); }
            if (top <= 0) { top = 0; cat.vy = Math.abs(cat.vy); }
            if (top + cat.height >= height) { top = height - cat.height; cat.vy = -Math.abs(cat.vy); }
            cat.dom.style.left = left + 'px';
            cat.dom.style.top = top + 'px';
        });
        gardenAnimationId = requestAnimationFrame(animate);
    }
    animate();
}

function petCatInGarden(catId, clickEvent) {
    const cat = gameData.ownedCats.find(c => c.uniqueId === catId);
    if (!cat) return;

    // 增加亲密度和金币（业务逻辑）
    cat.happiness = Math.min(100, cat.happiness + 5);
    gameData.gold += 10;
    updateUI();
    saveGame();
    soundMgr.playMeowSound();

    // 找到庭院中对应的猫对象
    const gardenCat = gardenCats.find(gc => gc.catId === catId);
    if (!gardenCat) return;

    // 如果已有恢复定时器，清除它
    if (gardenCat.restoreTimer) {
        clearTimeout(gardenCat.restoreTimer);
        gardenCat.restoreTimer = null;
    }

    // 暂停运动
    gardenCat.isPaused = true;
    gardenCat.vx = 0;
    gardenCat.vy = 0;

    // 切换图像为 catput.gif（若存在，否则 fallback 到 emoji）
    const img = gardenCat.img;
    if (img) {
        // 清除之前的 fallback（如果有）
        if (gardenCat.fallback && gardenCat.fallback.parentNode) {
            gardenCat.fallback.remove();
            gardenCat.fallback = null;
        }
        img.style.display = 'block';
        img.src = 'box/catput.gif';
        // 如果加载失败，显示 emoji
        img.onerror = function() {
            this.style.display = 'none';
            if (!gardenCat.fallback) {
                const fallback = document.createElement('div');
                fallback.style.width = '80px';
                fallback.style.height = '80px';
                fallback.style.fontSize = '64px';
                fallback.style.textAlign = 'center';
                fallback.style.lineHeight = '80px';
                fallback.innerText = cat.emoji;
                gardenCat.dom.appendChild(fallback);
                gardenCat.fallback = fallback;
            }
        };
    }

    // 3秒后恢复
    gardenCat.restoreTimer = setTimeout(() => {
        restoreCat(gardenCat, cat);
    }, 3000);

    // 爱心动画（与原有逻辑一致）
    const target = clickEvent.target.closest('.cat-sprite');
    if (target) {
        const heart = document.createElement('div');
        heart.className = 'heart-animation';
        heart.innerText = '❤️';
        const rect = target.getBoundingClientRect();
        const relativeX = clickEvent.clientX - rect.left;
        const relativeY = clickEvent.clientY - rect.top;
        heart.style.left = relativeX + 'px';
        heart.style.top = relativeY - 20 + 'px';
        target.style.position = 'relative';
        target.appendChild(heart);
        setTimeout(() => heart.remove(), 800);
    }
}

function restoreCat(gardenCat, cat) {
    // 恢复运动
    gardenCat.isPaused = false;
    gardenCat.vx = gardenCat.origVx;
    gardenCat.vy = gardenCat.origVy;

    // 恢复原始图像
    const img = gardenCat.img;
    if (img) {
        // 清除 fallback
        if (gardenCat.fallback && gardenCat.fallback.parentNode) {
            gardenCat.fallback.remove();
            gardenCat.fallback = null;
        }
        img.style.display = 'block';
        img.src = gardenCat.originalSrc;
        // 重新绑定 onerror（以防原始图片加载失败）
        img.onerror = function() {
            this.style.display = 'none';
            if (!gardenCat.fallback) {
                const fallback = document.createElement('div');
                fallback.style.width = '80px';
                fallback.style.height = '80px';
                fallback.style.fontSize = '64px';
                fallback.style.textAlign = 'center';
                fallback.style.lineHeight = '80px';
                fallback.innerText = cat.emoji;
                gardenCat.dom.appendChild(fallback);
                gardenCat.fallback = fallback;
            }
        };
    }
    gardenCat.restoreTimer = null;
}

function showGardenView() {
    const keyboardView = document.getElementById('keyboardView');
    const gardenView = document.getElementById('gardenView');
    if (keyboardView && gardenView) {
        keyboardView.style.display = 'none';
        gardenView.style.display = 'flex';
        isGardenViewActive = true;
        initGardenView();
        soundMgr.switchBgm('bgm2.mp3');
        setKeyboardEnabled(false);
    }
}

function hideGardenView() {
    const keyboardView = document.getElementById('keyboardView');
    const gardenView = document.getElementById('gardenView');
    if (keyboardView && gardenView) {
        gardenView.style.display = 'none';
        keyboardView.style.display = 'flex';
        isGardenViewActive = false;
        if (gardenAnimationId) cancelAnimationFrame(gardenAnimationId);
        gardenAnimationId = null;
        // 清理所有猫的恢复定时器（避免内存泄漏）
        gardenCats.forEach(gc => {
            if (gc.restoreTimer) {
                clearTimeout(gc.restoreTimer);
                gc.restoreTimer = null;
            }
            // 恢复运动状态（避免下次进入庭院时卡住）
            gc.isPaused = false;
            gc.vx = gc.origVx;
            gc.vy = gc.origVy;
            // 恢复原始图像（如果当前是 catput）
            const img = gc.img;
            if (img && img.src && img.src.includes('catput.gif')) {
                if (gc.fallback && gc.fallback.parentNode) gc.fallback.remove();
                gc.fallback = null;
                img.style.display = 'block';
                img.src = gc.originalSrc;
                // 重新设置 onerror
                img.onerror = function() {
                    this.style.display = 'none';
                    if (!gc.fallback) {
                        const fallback = document.createElement('div');
                        fallback.style.width = '80px';
                        fallback.style.height = '80px';
                        fallback.style.fontSize = '64px';
                        fallback.style.textAlign = 'center';
                        fallback.style.lineHeight = '80px';
                        fallback.innerText = gc.catId ? gameData.ownedCats.find(c => c.uniqueId === gc.catId)?.emoji || '🐱' : '🐱';
                        gc.dom.appendChild(fallback);
                        gc.fallback = fallback;
                    }
                };
            }
        });
        renderCats();
        soundMgr.switchBgm('bgm.mp3');
        setKeyboardEnabled(true);
    }
}

// ======================= 15. 事件绑定与键盘监听 =======================
function bindUIEvents() {
    document.getElementById('diaryBtn').onclick = () => { document.getElementById('diaryContent').innerHTML = generateDiary(); document.getElementById('diaryModal').style.display = 'flex'; };
    document.getElementById('shareDiaryBtn').onclick = () => alert('分享功能：请使用系统截图保存猫咪日记');
    document.getElementById('viewAllCatsBtn').onclick = () => showGardenView();
    document.getElementById('backToKeyboardBtn').onclick = () => hideGardenView();
    document.getElementById('sellAllBtn').onclick = () => {
        let total = 0;
        for (let [fid, qty] of Object.entries(gameData.inventory)) { total += fishDB[fid].value * qty; delete gameData.inventory[fid]; }
        gameData.gold += total;
        updateUI();
        saveGame();
        showSystemMessage(`一键出售获得 ${total} 小鱼干`);
    };
    const fullscreenBtn = document.getElementById('fullscreenBtn');
    if (fullscreenBtn && window.electronAPI) {
        fullscreenBtn.onclick = async () => {
            const isFull = await window.electronAPI.toggleFullscreen();
            fullscreenBtn.innerText = isFull ? '⛶' : '⛶'; // 可更换为不同图标（或保持相同）
            // 可选：更新按钮提示文字
            fullscreenBtn.title = isFull ? '退出全屏' : '全屏';
        };
    }
    const floatBtn = document.getElementById('floatModeBtn');
    if (floatBtn && window.electronAPI) floatBtn.onclick = () => { const newMode = !window._floatMode; window._floatMode = newMode; window.electronAPI.toggleFloatMode(newMode); };
    const soundBtn = document.getElementById('soundSettingsBtn');
    if (soundBtn) soundBtn.onclick = () => document.getElementById('soundModal').style.display = 'flex';
    document.getElementById('refreshSoundsModalBtn').onclick = async () => { await soundMgr.scanMeowFiles(); alert(`已刷新，找到 ${soundMgr.meowFiles.length} 个猫叫音效`); };
    document.getElementById('minimizeBtn').onclick = () => { if (window.electronAPI) alert('请使用任务栏最小化'); else window.blur(); };
    document.getElementById('closeBtn').onclick = () => window.close();

    const assignModal = document.getElementById('assignModal');
    if (assignModal) {
        assignModal.querySelector('.close').onclick = closeAssignModal;
        document.getElementById('assignCancelBtn').onclick = closeAssignModal;
        document.getElementById('assignConfirmBtn').onclick = confirmAssign;
        assignModal.onclick = (e) => { if (e.target === assignModal) closeAssignModal(); };
    }
    document.querySelectorAll('.modal .close').forEach(btn => btn.addEventListener('click', (e) => { e.target.closest('.modal').style.display = 'none'; }));
    document.querySelectorAll('.modal').forEach(modal => modal.addEventListener('click', (e) => { if (e.target === modal) modal.style.display = 'none'; }));

    document.getElementById('toggleBgm').onchange = (e) => soundMgr.toggleBgm(e.target.checked);
    document.getElementById('toggleFishSound').onchange = (e) => { soundMgr.config.fishEnabled = e.target.checked; soundMgr.saveSettings(); };
    document.getElementById('toggleMeowSound').onchange = (e) => { soundMgr.config.meowEnabled = e.target.checked; soundMgr.saveSettings(); };
    document.getElementById('toggleOtherSound').onchange = (e) => { soundMgr.config.otherEnabled = e.target.checked; soundMgr.saveSettings(); };
    document.getElementById('bgmVolume').oninput = (e) => soundMgr.setBgmVolume(e.target.value / 100);
    document.getElementById('refreshSoundsBtn').onclick = async () => { await soundMgr.scanMeowFiles(); alert(`已刷新，找到 ${soundMgr.meowFiles.length} 个猫叫音效`); };
    soundMgr.updateUI();
}

function initKeyboardListener() {
    const modeIndicator = document.getElementById('modeIndicator');
    if (modeIndicator) modeIndicator.innerText = '⌨️ 监听模式: 启动中...';
    window.addEventListener('keydown', (e) => {
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
        if (!isKeyboardEnabled) return;
        let key = e.key;
        const keyMap = {
            ' ': 'Space', 'Control': 'Ctrl', 'Meta': 'Win', 'Alt': 'Alt', 'Shift': 'Shift',
            'ArrowUp': 'Up', 'ArrowDown': 'Down', 'ArrowLeft': 'Left', 'ArrowRight': 'Right',
            'Enter': 'Enter', 'Backspace': 'Backspace', 'Delete': 'Delete', 'Insert': 'Insert',
            'Home': 'Home', 'End': 'End', 'PageUp': 'PageUp', 'PageDown': 'PageDown',
            'CapsLock': 'CapsLock', 'Tab': 'Tab', 'Escape': 'Esc', 'NumLock': 'NumLock'
        };
        key = keyMap[key] || key;
        let matchedKey = visibleKeys.find(k => k.toUpperCase() === key.toUpperCase() || k === key);
        if (!matchedKey && key === ' ') matchedKey = 'Space';
        if (matchedKey) {
            handleKeyPress(matchedKey);
            animateKeyTile(matchedKey);
            e.preventDefault();
        }
    });
    window.addEventListener('keyup', (e) => {
        if (!isKeyboardEnabled) return;
        let key = e.key;
        const keyMap = { ' ': 'Space' };
        key = keyMap[key] || key;
        let matchedKey = visibleKeys.find(k => k.toUpperCase() === key.toUpperCase() || k === key);
        if (matchedKey) onKeyUp(matchedKey);
    });
    if (window.electronAPI) {
        window.electronAPI.onGlobalKeydown((data) => {
            if (!isKeyboardEnabled) return;
            let key = data.key;
            let matchedKey = visibleKeys.find(k => k.toUpperCase() === key.toUpperCase() || k === key);
            if (matchedKey) {
                handleKeyPress(matchedKey);
                animateKeyTile(matchedKey);
            }
        });
        window.electronAPI.onGlobalListenerStatus((available) => {
            globalListenerAvailable = available;
            if (!isGardenViewActive) {
                if (modeIndicator) {
                    modeIndicator.innerText = available ? '⌨️ 监听模式: 全局键盘 (后台可用)' : '⌨️ 监听模式: 窗口内键盘 (需激活窗口)';
                }
            }
        });
    }
    setTimeout(() => {
        if (modeIndicator && modeIndicator.innerText === '⌨️ 监听模式: 启动中...') {
            modeIndicator.innerText = '⌨️ 监听模式: 窗口内键盘 (需激活窗口)';
        }
    }, 3500);
}

// 自动挂机
setInterval(() => {
    for (let key in gameData.ponds) if (gameData.ponds[key].catId && Math.random() < 0.25) addFish('minnow', 1);
    saveGame();
}, 30000);

// 启动
document.addEventListener('DOMContentLoaded', () => {
    loadGame();
    bindUIEvents();
    initKeyboardListener();
    updateUI();
    startRandomActiveEvents();
});
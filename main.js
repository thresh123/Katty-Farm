const { app, BrowserWindow, ipcMain, Tray, Menu, nativeImage, screen } = require('electron');
const path = require('path');
const { GlobalKeyboardListener } = require('node-global-key-listener');

let mainWindow = null;
let tray = null;
let isFloatMode = false;
let isSnapping = false;
let globalListener = null;

// 吸附边缘（优化版）
function snapToEdge(window, display) {
    if (isSnapping) return;
    const bounds = window.getBounds();
    const { x, y, width, height } = bounds;
    const { workArea } = display;
    const threshold = 30;
    let newX = x, newY = y;
    if (Math.abs(x - workArea.x) < threshold) newX = workArea.x;
    else if (Math.abs((x + width) - (workArea.x + workArea.width)) < threshold) newX = workArea.x + workArea.width - width;
    if (Math.abs(y - workArea.y) < threshold) newY = workArea.y;
    else if (Math.abs((y + height) - (workArea.y + workArea.height)) < threshold) newY = workArea.y + workArea.height - height;
    if (newX !== x || newY !== y) {
        isSnapping = true;
        window.setBounds({ x: newX, y: newY, width, height });
        setTimeout(() => { isSnapping = false; }, 100);
    }
}

function setupFloatMode(enable) {
    if (!mainWindow) return;
    if (enable) {
        isFloatMode = true;
        mainWindow.setAlwaysOnTop(true, 'floating');
        mainWindow.setSkipTaskbar(false);
        mainWindow.setVisibleOnAllWorkspaces(true);
        mainWindow.setMovable(true);
        mainWindow.setResizable(true);
        mainWindow.setMinimumSize(400, 300);
        mainWindow.removeAllListeners('moved');
        mainWindow.on('moved', () => {
            if (mainWindow && !mainWindow.isDestroyed() && !isSnapping) {
                const currentDisplay = screen.getDisplayMatching(mainWindow.getBounds());
                snapToEdge(mainWindow, currentDisplay);
            }
        });
        mainWindow.webContents.send('float-mode-changed', true);
    } else {
        isFloatMode = false;
        mainWindow.setAlwaysOnTop(false);
        mainWindow.setSkipTaskbar(false);
        mainWindow.setVisibleOnAllWorkspaces(false);
        mainWindow.removeAllListeners('moved');
        mainWindow.setBounds({ width: 1200, height: 800 });
        mainWindow.center();
        mainWindow.webContents.send('float-mode-changed', false);
    }
}

function setupGlobalKeyboardListener() {
    if (globalListener) return;
    try {
        globalListener = new GlobalKeyboardListener();
        globalListener.addListener((e) => {
            if (e.state === 'DOWN') {
                let keyName = e.name;
                const keyMap = {
                    'SPACE': 'Space', 'CONTROL': 'Ctrl', 'LEFT CONTROL': 'Ctrl', 'RIGHT CONTROL': 'Ctrl',
                    'ALT': 'Alt', 'LEFT ALT': 'Alt', 'RIGHT ALT': 'Alt',
                    'SHIFT': 'Shift', 'LEFT SHIFT': 'Shift', 'RIGHT SHIFT': 'Shift',
                    'LEFT META': 'Win', 'RIGHT META': 'Win', 'META': 'Win',
                    'UP': 'Up', 'DOWN': 'Down', 'LEFT': 'Left', 'RIGHT': 'Right',
                    'RETURN': 'Enter', 'ENTER': 'Enter', 'BACKSPACE': 'Backspace',
                    'DELETE': 'Delete', 'INSERT': 'Insert', 'HOME': 'Home', 'END': 'End',
                    'PAGEUP': 'PageUp', 'PAGEDOWN': 'PageDown', 'CAPS LOCK': 'CapsLock',
                    'TAB': 'Tab', 'ESCAPE': 'Esc', 'NUM LOCK': 'NumLock',
                    'NUMPAD0': 'Numpad0', 'NUMPAD1': 'Numpad1', 'NUMPAD2': 'Numpad2', 'NUMPAD3': 'Numpad3',
                    'NUMPAD4': 'Numpad4', 'NUMPAD5': 'Numpad5', 'NUMPAD6': 'Numpad6', 'NUMPAD7': 'Numpad7',
                    'NUMPAD8': 'Numpad8', 'NUMPAD9': 'Numpad9',
                    'ADD': 'NumpadAdd', 'SUBTRACT': 'NumpadSubtract',
                    'MULTIPLY': 'NumpadMultiply', 'DIVIDE': 'NumpadDivide', 'DECIMAL': 'NumpadDecimal'
                };
                if (keyMap[keyName]) keyName = keyMap[keyName];
                if (mainWindow && !mainWindow.isDestroyed()) {
                    mainWindow.webContents.send('global-keydown', { key: keyName, timestamp: Date.now() });
                }
            }
        });
        console.log('✅ 全局键盘监听已启动');
        if (mainWindow) mainWindow.webContents.send('global-listener-status', true);
    } catch (error) {
        console.error('❌ 全局键盘监听启动失败:', error);
        if (mainWindow) mainWindow.webContents.send('global-listener-status', false);
    }
}

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1200,
        height: 800,
        frame: false,
        transparent: false,
        backgroundColor: '#f0f7ff',
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            preload: path.join(__dirname, 'preload.js')
        },
        icon: path.join(__dirname, 'assets', 'icon.png'),
        title: '小猫农场'
    });

    mainWindow.loadFile('index.html');

    // 默认全屏
    mainWindow.setFullScreen(true);

    // F12 开发者工具
    mainWindow.webContents.on('before-input-event', (event, input) => {
        if (input.key === 'F12') {
            mainWindow.webContents.openDevTools();
            event.preventDefault();
        }
    });

    // 托盘
    const trayIcon = nativeImage.createEmpty();
    tray = new Tray(trayIcon);
    const contextMenu = Menu.buildFromTemplate([
        { label: '显示主窗口', click: () => mainWindow.show() },
        { label: '退出', click: () => app.quit() }
    ]);
    tray.setToolTip('小猫农场');
    tray.setContextMenu(contextMenu);
    tray.on('click', () => mainWindow.show());

    mainWindow.on('closed', () => { mainWindow = null; });

    setupGlobalKeyboardListener();

    ipcMain.handle('toggle-float-mode', (event, enable) => {
        setupFloatMode(enable);
        return isFloatMode;
    });

    ipcMain.handle('toggle-fullscreen', (event) => {
        if (mainWindow) {
            const isFull = mainWindow.isFullScreen();
            mainWindow.setFullScreen(!isFull);
            return !isFull;
        }
        return false;
    });

    ipcMain.handle('get-sound-files', async () => {
        const fs = require('fs');
        const soundDir = path.join(process.resourcesPath, 'sounds');
        let finalDir = soundDir;
        if (!fs.existsSync(soundDir)) {
            const devDir = path.join(__dirname, 'sounds');
            if (fs.existsSync(devDir)) finalDir = devDir;
        }
        try {
            if (!fs.existsSync(finalDir)) fs.mkdirSync(finalDir, { recursive: true });
            const files = fs.readdirSync(finalDir);
            return files.filter(f => f.toLowerCase().endsWith('.mp3'));
        } catch (e) { return []; }
    });
}

app.whenReady().then(() => createWindow());
app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
});
app.on('activate', () => {
    if (mainWindow === null) createWindow();
});
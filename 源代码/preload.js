const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    onGlobalKeydown: (callback) => ipcRenderer.on('global-keydown', (event, data) => callback(data)),
    onGlobalListenerStatus: (callback) => ipcRenderer.on('global-listener-status', (event, available) => callback(available)),
    onFloatModeChanged: (callback) => ipcRenderer.on('float-mode-changed', (event, enable) => callback(enable)),
    toggleFloatMode: (enable) => ipcRenderer.invoke('toggle-float-mode', enable),
    toggleFullscreen: () => ipcRenderer.invoke('toggle-fullscreen'),
    getSoundFiles: () => ipcRenderer.invoke('get-sound-files'),
    getVersion: () => ipcRenderer.invoke('get-version')
});
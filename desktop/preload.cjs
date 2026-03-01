const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronLLM', {
  availability: () => ipcRenderer.invoke('local-llm:availability'),
  chat: (args) => ipcRenderer.invoke('local-llm:chat', args),
});

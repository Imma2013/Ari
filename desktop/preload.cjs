const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronLLM', {
  availability: () => ipcRenderer.invoke('local-llm:availability'),
  prepare: () => ipcRenderer.invoke('local-llm:prepare'),
  chat: (args) => ipcRenderer.invoke('local-llm:chat', args),
});

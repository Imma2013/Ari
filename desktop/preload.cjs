const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronLLM', {
  availability: () => ipcRenderer.invoke('local-llm:availability'),
  prepare: () => ipcRenderer.invoke('local-llm:prepare'),
  listModels: () => ipcRenderer.invoke('local-llm:list-models'),
  setModel: (args) => ipcRenderer.invoke('local-llm:set-model', args),
  chat: (args) => ipcRenderer.invoke('local-llm:chat', args),
});

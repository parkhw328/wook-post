import { contextBridge, ipcRenderer } from 'electron'
import type { DesktopApi } from '../shared/contracts'

const api: DesktopApi = {
  load: () => ipcRenderer.invoke('workspace:load'),
  saveWorkspace: (workspace) => ipcRenderer.invoke('workspace:save', workspace),
  send: (request, operationId) => ipcRenderer.invoke('request:send', request, operationId),
  cancel: (operationId) => ipcRenderer.invoke('request:cancel', operationId),
  getHistory: (id) => ipcRenderer.invoke('history:get', id),
  listHistory: (offset) => ipcRenderer.invoke('history:list', offset),
  clearHistory: () => ipcRenderer.invoke('history:clear'),
  previewImport: () => ipcRenderer.invoke('file:preview-import'),
  applyImport: (token) => ipcRenderer.invoke('file:apply-import', token),
  exportData: (options) => ipcRenderer.invoke('file:export', options),
  info: () => ipcRenderer.invoke('app:info'),
}

contextBridge.exposeInMainWorld('wook', api)

import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("electronAPI", {
  isElectron: true,
  saveExcelFile: (fileName: string, monthFolder: string, buffer: Uint8Array | number[]) =>
    ipcRenderer.invoke("file:save-excel", { fileName, monthFolder, buffer }),
  showNotification: (options: { title: string; body: string }) =>
    ipcRenderer.invoke("system:notify", options),
  openZaloSession: () => ipcRenderer.invoke("zalo:open-session"),
  startZaloBatch: (items: any[], settings: any) =>
    ipcRenderer.invoke("zalo:start-batch", { items, settings }),
  stopZaloBatch: () => ipcRenderer.invoke("zalo:stop-batch"),
  onZaloProgress: (callback: (data: any) => void) => {
    const handler = (_event: any, data: any) => callback(data);
    ipcRenderer.on("zalo:progress", handler);
    // Cleanup function bắt buộc cho React 19 StrictMode
    return () => {
      ipcRenderer.removeListener("zalo:progress", handler);
    };
  },
  onZaloStatusChange: (callback: (status: any) => void) => {
    const handler = (_event: any, data: any) => callback(data);
    ipcRenderer.on("zalo:status", handler);
    return () => {
      ipcRenderer.removeListener("zalo:status", handler);
    };
  },
});

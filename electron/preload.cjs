// The two things the page needs from the desktop that a web page cannot do
// for itself: Windows' own "choose a folder" window, and starting the app
// again so a newly chosen vault is the one it opens.
//
// Nothing else crosses over. The page still has no way to read files or run
// anything; it can only ask for these two, by name.
const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('daily', {
  pickFolder: (start) => ipcRenderer.invoke('daily:pick-folder', String(start ?? '')),
  restart: () => ipcRenderer.invoke('daily:restart'),
})

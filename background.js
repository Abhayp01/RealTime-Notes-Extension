let enabled = true;
let useSync = false; // default local

function getStorageArea() {
  return useSync ? chrome.storage.sync : chrome.storage.local;
}

// Right-click Add to Notes
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "addToNotes",
    title: "Add to Notes",
    contexts: ["selection"]
  });
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (enabled && info.menuItemId === "addToNotes") {
    const note = {
      text: info.selectionText,
      url: tab.url,
      favorite: false,
      timestamp: Date.now()
    };

    getStorageArea().get(["notes"], (result) => {
      const notes = result.notes || [];
      notes.push(note);
      getStorageArea().set({ notes });
    });
  }
});

// Messages from popup
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === "toggle") {
    enabled = msg.value;
  }
  if (msg.type === "storageMode") {
    useSync = msg.value;
  }
});

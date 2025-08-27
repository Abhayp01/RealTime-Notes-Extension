const notesList = document.getElementById("notesList");
const toggle = document.getElementById("toggle");
const searchInput = document.getElementById("search");
const downloadTxt = document.getElementById("downloadTxt");
const downloadJson = document.getElementById("downloadJson");
const clearBtn = document.getElementById("clear");
const syncToggle = document.getElementById("syncToggle");

let useSync = false;

function getStorageArea() {
  return useSync ? chrome.storage.sync : chrome.storage.local;
}

// Load toggle state
chrome.storage.local.get(["enabled"], (result) => {
  const isEnabled = result.enabled !== false;
  toggle.checked = isEnabled;
  chrome.runtime.sendMessage({ type: "toggle", value: isEnabled });
});

// Load storage mode
chrome.storage.local.get(["useSync"], (result) => {
  useSync = result.useSync || false;
  syncToggle.checked = useSync;
});

// Load Notes
function loadNotes(filter = "") {
  getStorageArea().get(["notes"], (result) => {
    notesList.innerHTML = "";
    const notes = result.notes || [];

    notes
      .filter(n => n.text.toLowerCase().includes(filter.toLowerCase()))
      .sort((a,b) => (b.favorite - a.favorite) || (b.timestamp - a.timestamp))
      .forEach((note, index) => {
        const li = document.createElement("li");
        li.innerHTML = `
          <span class="note-text">${note.text}</span>
          <div class="note-actions">
            <button class="copy">📋</button>
            <button class="fav">${note.favorite ? "⭐" : "☆"}</button>
            <button class="del">🗑️</button>
          </div>
          <small class="note-url">${new URL(note.url).hostname}</small>
        `;

        // Actions
        li.querySelector(".copy").addEventListener("click", () => {
          navigator.clipboard.writeText(note.text);
        });

        li.querySelector(".fav").addEventListener("click", () => {
          note.favorite = !note.favorite;
          notes[index] = note;
          getStorageArea().set({ notes }, () => loadNotes(filter));
        });

        li.querySelector(".del").addEventListener("click", () => {
          notes.splice(index, 1);
          getStorageArea().set({ notes }, () => loadNotes(filter));
        });

        notesList.appendChild(li);
      });
  });
}
loadNotes();

// Toggle enable
toggle.addEventListener("change", () => {
  const enabled = toggle.checked;
  chrome.storage.local.set({ enabled });
  chrome.runtime.sendMessage({ type: "toggle", value: enabled });
});

// Search filter
searchInput.addEventListener("input", () => {
  loadNotes(searchInput.value);
});

// Export .txt
downloadTxt.addEventListener("click", () => {
  getStorageArea().get(["notes"], (result) => {
    const notes = result.notes || [];
    const text = notes.map(n => `- ${n.text} (${n.url})`).join("\n");
    const blob = new Blob([text], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    chrome.downloads.download({ url, filename: "notes.txt" });
  });
});

// Export .json
downloadJson.addEventListener("click", () => {
  getStorageArea().get(["notes"], (result) => {
    const blob = new Blob([JSON.stringify(result.notes || [], null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    chrome.downloads.download({ url, filename: "notes.json" });
  });
});

// Clear all
clearBtn.addEventListener("click", () => {
  getStorageArea().set({ notes: [] }, loadNotes);
});

// Sync toggle
syncToggle.addEventListener("change", () => {
  useSync = syncToggle.checked;
  chrome.storage.local.set({ useSync });
  chrome.runtime.sendMessage({ type: "storageMode", value: useSync });
  loadNotes(searchInput.value);
});

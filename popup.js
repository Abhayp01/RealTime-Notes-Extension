const elements = {
  notesList: document.getElementById("notesList"),
  newNoteInput: document.getElementById("newNoteInput"),
  addNoteBtn: document.getElementById("addNoteBtn"),
  search: document.getElementById("search"),
  toggle: document.getElementById("toggle"),
  syncToggle: document.getElementById("syncToggle"),
  emptyState: document.getElementById("emptyState"),
  colorSelector: document.getElementById("colorSelector"),
  downloadTxt: document.getElementById("downloadTxt"),
  downloadJson: document.getElementById("downloadJson"),
  clearBtn: document.getElementById("clear"),
};

let state = {
  notes: [],
  enabled: true,
  useSync: false,
  selectedColor: '#6C63FF', // Default purple
  filter: ''
};

// --- Initialization ---

async function init() {
  // Load settings
  const settings = await chrome.storage.local.get(["enabled", "useSync"]);
  state.enabled = settings.enabled !== false;
  state.useSync = settings.useSync || false;

  // UI Refection
  elements.toggle.checked = state.enabled;
  elements.syncToggle.checked = state.useSync;

  // Load Notes
  await loadNotes();

  setupEventListeners();
}

function getStorage() {
  return state.useSync ? chrome.storage.sync : chrome.storage.local;
}

// --- Core Logic ---

async function loadNotes() {
  const result = await getStorage().get(["notes"]);
  state.notes = result.notes || [];
  render();
}

async function saveNotes() {
  await getStorage().set({ notes: state.notes });
  render(); // Re-render to reflect changes (e.g. re-sort)
}

function render() {
  elements.notesList.innerHTML = "";

  // Filter
  const filtered = state.notes.filter(n =>
    n.text.toLowerCase().includes(state.filter.toLowerCase())
  );

  // Sort: Favorites first, then new
  filtered.sort((a, b) => (b.favorite - a.favorite) || (b.timestamp - a.timestamp));

  // Empty State
  if (filtered.length === 0) {
    elements.emptyState.style.display = "block";
  } else {
    elements.emptyState.style.display = "none";
  }

  // Render Items
  filtered.forEach(note => {
    const li = document.createElement("li");
    li.className = "note-item";
    li.style.setProperty("--accent", note.color || '#6C63FF');

    // Check if url is valid
    let domain = "Manual Entry";
    try {
      if (note.url) domain = new URL(note.url).hostname;
    } catch (e) { }

    li.innerHTML = `
      <div class="note-content" contenteditable="true" spellcheck="false">${note.text}</div>
      <div class="note-footer">
        <span class="note-source">${domain}</span>
        <div class="note-actions">
           <button class="icon-btn fav ${note.favorite ? 'active' : ''}">
             ${note.favorite ? "★" : "☆"}
           </button>
           <button class="icon-btn del">🗑️</button>
        </div>
      </div>
    `;

    // Event Listeners for Item

    // Toggle Collapse on click (excluding content/buttons)
    li.addEventListener("click", (e) => {
      // If clicking outside content and buttons, toggle expand
      if (!e.target.closest('.note-content') && !e.target.closest('button')) {
        li.classList.toggle('expanded');
      }
    });

    const contentDiv = li.querySelector(".note-content");

    // If clicking content while collapsed, expand it
    contentDiv.addEventListener("focus", () => {
      li.classList.add('expanded');
    });

    // Inline Edit Save on Blur
    contentDiv.addEventListener("blur", () => {
      const newText = contentDiv.innerText.trim();
      if (newText && newText !== note.text) {
        note.text = newText;
        note.timestamp = Date.now();
        saveNotes();
      }
    });

    // Favorite
    li.querySelector(".fav").addEventListener("click", (e) => {
      e.stopPropagation(); // Prevent triggering other clicks if any
      note.favorite = !note.favorite;
      saveNotes();
    });

    // Delete
    li.querySelector(".del").addEventListener("click", (e) => {
      e.stopPropagation();
      const index = state.notes.indexOf(note);
      if (index > -1) {
        state.notes.splice(index, 1);
        saveNotes();
      }
    });

    elements.notesList.appendChild(li);
  });
}

// --- Event Listeners ---

function setupEventListeners() {
  // Enable Toggle
  elements.toggle.addEventListener("change", () => {
    state.enabled = elements.toggle.checked;
    chrome.storage.local.set({ enabled: state.enabled });
    chrome.runtime.sendMessage({ type: "toggle", value: state.enabled });
  });

  // Sync Toggle
  elements.syncToggle.addEventListener("change", async () => {
    state.useSync = elements.syncToggle.checked;
    chrome.storage.local.set({ useSync: state.useSync });

    // Notify background to switch modes too
    chrome.runtime.sendMessage({ type: "storageMode", value: state.useSync });

    // Reload notes from the new storage source
    await loadNotes();
  });

  // Search
  elements.search.addEventListener("input", (e) => {
    state.filter = e.target.value;
    render();
  });

  // Color Selection
  elements.colorSelector.addEventListener("click", (e) => {
    if (e.target.classList.contains("color-option")) {
      // Remove selected from all
      document.querySelectorAll(".color-option").forEach(el => el.classList.remove("selected"));
      e.target.classList.add("selected");
      state.selectedColor = e.target.dataset.color;
    }
  });

  // Add Note (Click)
  elements.addNoteBtn.addEventListener("click", addNewNote);

  // Add Note (Enter Key)
  elements.newNoteInput.addEventListener("keypress", (e) => {
    if (e.key === "Enter") addNewNote();
  });

  // Export TXT
  elements.downloadTxt.addEventListener("click", () => {
    const text = state.notes.map(n => `- ${n.text} (${n.url || "Manual"})\n`).join("");
    downloadFile(text, "notes.txt", "text/plain");
  });

  // Export JSON
  elements.downloadJson.addEventListener("click", () => {
    downloadFile(JSON.stringify(state.notes, null, 2), "notes.json", "application/json");
  });

  // Clear All
  elements.clearBtn.addEventListener("click", () => {
    if (confirm("Are you sure you want to delete all notes?")) {
      state.notes = [];
      saveNotes();
    }
  });
}

function addNewNote() {
  const text = elements.newNoteInput.value.trim();
  if (!text) return;

  const newNote = {
    text,
    url: "",
    favorite: false,
    color: state.selectedColor,
    timestamp: Date.now()
  };

  state.notes.unshift(newNote); // Add to top
  saveNotes();

  elements.newNoteInput.value = ""; // Clear input
}

function downloadFile(content, filename, type) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  chrome.downloads.download({ url, filename });
}

// Start
init();

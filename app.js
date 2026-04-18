import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, GoogleAuthProvider, signInWithPopup, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

// --- CONFIGURATION ---
const firebaseConfig = {
  apiKey: "AIzaSyCbLiGgLmc6p8p-P_g8rlfOMObTwKcoSyU",
  authDomain: "lnioptic.firebaseapp.com",
  projectId: "lnioptic",
  storageBucket: "lnioptic.firebasestorage.app",
  messagingSenderId: "978508155594",
  appId: "1:978508155594:web:2ca5e8dd5b87f5ef4ec233",
  measurementId: "G-56VQD84RDZ"
};

const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbxNSyOxtg79177XQSSZtI5w5zEHje0EOQHGag8KDAQXTLlj049xlvCm7UOtPDvRffUl/exec";

// --- INITIALIZE FIREBASE ---
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const provider = new GoogleAuthProvider();
provider.setCustomParameters({ prompt: 'select_account' });

// --- STATE MANAGEMENT ---
let currentPage = 'home';
let currentStock = [];

const sheetGrades = ["A1008", "A1011", "A36", "5052", "6061", "304 #4", "304 2B", "Other"];
const tubeShapes = ["Square", "Rectangle", "Round", "Angle", "Channel", "Bar"];
const shopStations = ["Laser Cut", "Forming", "Manual Machining", "CNC Machining", "Welding", "Shipping"];

// --- DOM ELEMENTS ---
const sidebar = document.getElementById('sidebar');
const overlay = document.getElementById('sidebar-overlay');
const matSelect = document.getElementById('mat-name');
const inventoryList = document.getElementById('inventory-list');
const pageTitle = document.getElementById('page-title');

// --- MOBILE NAVIGATION LOGIC ---
const toggleSidebar = () => {
    sidebar.classList.toggle('open');
    overlay.classList.toggle('open');
};

document.getElementById('menu-toggle').onclick = toggleSidebar;
document.getElementById('sidebar-overlay').onclick = toggleSidebar;
document.getElementById('close-sidebar').onclick = toggleSidebar;

// --- DASHBOARD STATS ---
async function refreshDashboardStats() {
    try {
        const res = await fetch(`${SCRIPT_URL}?grade=SUMMARY_STATS&page=home`);
        const stats = await res.json();
        document.getElementById('stat-sheet-crop').innerText = stats.sheet_crop;
        document.getElementById('stat-struct-crop').innerText = stats.struct_crop;
        document.getElementById('stat-wip').innerText = stats.wip_parts;
        document.getElementById('stat-full').innerText = (stats.full_sheet + stats.full_struct);
    } catch (err) {
        console.error("Dashboard Stats Sync Failed");
    }
}

// --- NAVIGATION ROUTING ---
document.querySelectorAll('.nav-links li').forEach(link => {
    link.onclick = () => {
        const page = link.getAttribute('data-page');
        if (!page) return;

        // Close sidebar on mobile after selection
        if (window.innerWidth <= 900) toggleSidebar();

        document.querySelectorAll('.nav-links li').forEach(l => l.classList.remove('active'));
        link.classList.add('active');
        
        currentPage = page;
        pageTitle.innerText = link.innerText;
        
        if (page === 'home') {
            document.getElementById('home-view').style.display = 'block';
            document.getElementById('main-terminal').style.display = 'none';
            refreshDashboardStats();
        } else {
            document.getElementById('home-view').style.display = 'none';
            document.getElementById('main-terminal').style.display = 'grid';
            setupForm(page);
        }
    };
});

function setupForm(page) {
    inventoryList.innerHTML = "<p class='footer-note'>Select a category to view items.</p>";
    if (page === 'wip_parts') {
        matSelect.style.display = 'none';
        setLabels("Workflow", "Part Number", "Job Number", "Quantity", "Current Station", "Customer");
        loadData("Master");
    } else {
        matSelect.style.display = 'block';
        if (page.includes('sheet')) {
            updateSelect(matSelect, sheetGrades);
            setLabels("Grade", "Thickness", "Size (W x L)", "Cert #", "Location", "Notes");
        } else {
            updateSelect(matSelect, tubeShapes);
            setLabels("Shape", "Dimensions", "Length", "Cert #", "Location", "Notes");
        }
    }
}

function setLabels(g, d, l, c, loc, n) {
    document.getElementById('label-grade').innerText = g;
    document.getElementById('label-dim').innerText = d;
    document.getElementById('label-len').innerText = l;
    document.getElementById('label-cert').innerText = c;
    document.getElementById('label-loc').innerText = loc;
    document.getElementById('label-notes').innerText = n;
}

function updateSelect(el, options) {
    el.innerHTML = '<option value="" disabled selected>Select...</option>';
    options.forEach(opt => { el.innerHTML += `<option value="${opt}">${opt}</option>`; });
}

// --- DATA FETCHING & RENDERING ---
async function loadData(tabName) {
    inventoryList.innerHTML = "<p class='footer-note'>Querying LNI Databases...</p>";
    try {
        const response = await fetch(`${SCRIPT_URL}?page=${currentPage}&grade=${tabName}`);
        currentStock = await response.json();
        renderInventory(currentStock);
    } catch (err) {
        inventoryList.innerHTML = "<p class='footer-note'>Connection Error.</p>";
    }
}

function renderInventory(items) {
    inventoryList.innerHTML = "";
    if (items.length === 0) { inventoryList.innerHTML = "<p class='footer-note'>No items found.</p>"; return; }

    items.forEach(item => {
        const div = document.createElement('div');
        div.className = "stock-item";
        const isWIP = currentPage === 'wip_parts';
        
        div.innerHTML = `
            <div style="flex:1;">
                <strong>${item.id}</strong> | ${isWIP ? 'Job: ' : ''}${item.size}<br>
                <small>${isWIP ? 'Station: ' : 'Loc: '}${item.loc}</small><br>
                <small style="color:var(--text-muted)">${isWIP ? 'Updated: ' : 'Cert: '}${isWIP ? item.other : item.cert}</small>
            </div>
            <button class="${isWIP ? 'btn-move' : 'btn-use'}" onclick="${isWIP ? `window.movePart('${item.id}')` : `window.deleteItem('${item.id}', '${item.type}')`}">${isWIP ? 'MOVE' : 'USE'}</button>
        `;
        inventoryList.appendChild(div);
    });
}

// --- ACTIONS ---
window.movePart = async (id) => {
    const next = prompt("Enter Next Station:", "Welding");
    if (!next) return;
    await fetch(SCRIPT_URL, { 
        method: 'POST', 
        mode: 'no-cors', 
        body: JSON.stringify({ action: "MOVE", page: "wip_parts", item: "Master", id: id, nextStation: next, user: auth.currentUser.email }) 
    });
    loadData("Master");
};

window.deleteItem = async (id, tab) => {
    if (!confirm(`Permanently remove ${id}?`)) return;
    await fetch(SCRIPT_URL, { 
        method: 'POST', 
        mode: 'no-cors', 
        body: JSON.stringify({ action: "DELETE", page: currentPage, item: tab, id: id, user: auth.currentUser.email }) 
    });
    loadData(tab);
};

// --- FORM SUBMISSION ---
document.getElementById('material-form').onsubmit = async (e) => {
    e.preventDefault();
    const btn = document.getElementById('submit-btn');
    btn.innerText = "Processing..."; btn.disabled = true;

    const data = {
        action: "ADD",
        page: currentPage,
        item: (currentPage === 'wip_parts') ? "Master" : matSelect.value,
        id: document.getElementById('dim-input').value, // Part # or Thickness
        size: document.getElementById('len-input').value, // Job # or Size
        thickness: (currentPage === 'wip_parts') ? "" : document.getElementById('dim-input').value,
        cert: document.getElementById('cert-num').value,
        loc: document.getElementById('location').value,
        type: (currentPage === 'wip_parts') ? document.getElementById('other-info').value : matSelect.value, // Customer Name
        user: auth.currentUser.email
    };

    await fetch(SCRIPT_URL, { method: 'POST', mode: 'no-cors', body: JSON.stringify(data) });
    document.getElementById('material-form').reset();
    btn.innerText = "Add Entry"; btn.disabled = false;
    loadData(data.item);
};

matSelect.onchange = (e) => loadData(e.target.value);

// --- AUTHENTICATION ---
onAuthStateChanged(auth, (user) => {
    if (user) {
        document.getElementById('auth-container').style.display = 'none';
        document.getElementById('sidebar').style.display = 'flex';
        document.getElementById('app-interface').style.display = 'block';
        document.getElementById('user-display').innerText = user.displayName;
        refreshDashboardStats();
    } else {
        document.getElementById('auth-container').style.display = 'block';
        document.getElementById('sidebar').style.display = 'none';
        document.getElementById('app-interface').style.display = 'none';
    }
});

document.getElementById('login-btn').onclick = () => signInWithPopup(auth, provider);
document.getElementById('logout-btn').onclick = () => signOut(auth);
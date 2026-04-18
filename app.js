import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, GoogleAuthProvider, signInWithPopup, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

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

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const provider = new GoogleAuthProvider();

let currentPage = 'home';
const sheetGrades = ["A1008", "A1011", "A36", "5052", "6061", "304 #4", "304 2B", "Other"];
const tubeShapes = ["Square", "Rectangle", "Round", "Angle", "Channel", "Bar"];

const sidebar = document.getElementById('sidebar');
const overlay = document.getElementById('sidebar-overlay');
const matSelect = document.getElementById('mat-name');
const inventoryList = document.getElementById('inventory-list');

// Sidebar Toggle
const toggleNav = () => {
    sidebar.classList.toggle('open');
    overlay.classList.toggle('open');
};

document.getElementById('menu-toggle').onclick = toggleNav;
document.getElementById('sidebar-overlay').onclick = toggleNav;
document.getElementById('close-sidebar').onclick = toggleNav;

// Dashboard Stats
async function refreshStats() {
    try {
        const res = await fetch(`${SCRIPT_URL}?grade=SUMMARY_STATS&page=home`);
        const stats = await res.json();
        document.getElementById('stat-sheet-crop').innerText = stats.sheet_crop || 0;
        document.getElementById('stat-struct-crop').innerText = stats.struct_crop || 0;
        document.getElementById('stat-wip').innerText = stats.wip_parts || 0;
        document.getElementById('stat-full').innerText = (stats.full_sheet + stats.full_struct) || 0;
    } catch (e) { console.error("Stats Sync Error"); }
}

// Navigation
document.querySelectorAll('.nav-links li').forEach(link => {
    link.onclick = () => {
        if (window.innerWidth <= 1024) toggleNav();
        const page = link.getAttribute('data-page');
        document.querySelectorAll('.nav-links li').forEach(l => l.classList.remove('active'));
        link.classList.add('active');
        currentPage = page;
        document.getElementById('page-title').innerText = link.innerText;

        if (page === 'home') {
            document.getElementById('home-view').style.display = 'block';
            document.getElementById('main-terminal').style.display = 'none';
            refreshStats();
        } else {
            document.getElementById('home-view').style.display = 'none';
            document.getElementById('main-terminal').style.display = 'grid';
            setupUI(page);
        }
    };
});

function setupUI(page) {
    if (page === 'wip_parts') {
        matSelect.style.display = 'none';
        setLabels("Workflow", "Part Number", "Job Number", "Quantity", "Initial Station", "Customer");
        loadData("Master");
    } else {
        matSelect.style.display = 'block';
        if (page.includes('sheet')) {
            updateSelect(matSelect, sheetGrades);
            setLabels("Grade", "Thickness", "Size", "Cert #", "Location", "Notes");
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

async function loadData(tab) {
    inventoryList.innerHTML = "<p>Syncing...</p>";
    try {
        const res = await fetch(`${SCRIPT_URL}?page=${currentPage}&grade=${tab}`);
        const data = await res.json();
        renderList(data);
    } catch (e) { inventoryList.innerHTML = "<p>Sync Error. Verify Script Deployment.</p>"; }
}

function renderList(items) {
    inventoryList.innerHTML = "";
    items.forEach(item => {
        const div = document.createElement('div');
        div.className = "stock-item";
        const isWIP = currentPage === 'wip_parts';
        div.innerHTML = `
            <div style="flex:1;">
                <strong>${item.id}</strong> | ${item.size}<br>
                <small>${isWIP ? 'At: ' : 'Loc: '}${item.loc}</small>
            </div>
            <button class="${isWIP ? 'btn-move' : 'btn-use'}" onclick="${isWIP ? `window.movePart('${item.id}')` : `window.deleteItem('${item.id}', '${item.type}')`}" style="padding: 8px 12px; border-radius: 6px; border:none; cursor:pointer; background: ${isWIP ? '#ffedd5' : '#fee2e2'}; color: ${isWIP ? '#f97316' : '#dc2626'};">
                ${isWIP ? 'MOVE' : 'USE'}
            </button>
        `;
        inventoryList.appendChild(div);
    });
}

window.movePart = async (id) => {
    const next = prompt("Next Station:", "Welding");
    if (!next) return;
    await fetch(SCRIPT_URL, { method: 'POST', mode: 'no-cors', body: JSON.stringify({ action: "MOVE", page: "wip_parts", item: "Master", id, nextStation: next, user: auth.currentUser.email }) });
    loadData("Master");
};

window.deleteItem = async (id, tab) => {
    if (!confirm(`Remove ${id}?`)) return;
    await fetch(SCRIPT_URL, { method: 'POST', mode: 'no-cors', body: JSON.stringify({ action: "DELETE", page: currentPage, item: tab, id, user: auth.currentUser.email }) });
    loadData(tab);
};

document.getElementById('material-form').onsubmit = async (e) => {
    e.preventDefault();
    const btn = document.getElementById('submit-btn');
    btn.innerText = "Syncing..."; btn.disabled = true;
    const data = {
        action: "ADD",
        page: currentPage,
        item: (currentPage === 'wip_parts') ? "Master" : matSelect.value,
        id: document.getElementById('dim-input').value,
        size: document.getElementById('len-input').value,
        cert: document.getElementById('cert-num').value,
        loc: document.getElementById('location').value,
        type: (currentPage === 'wip_parts') ? document.getElementById('other-info').value : matSelect.value,
        user: auth.currentUser.email
    };
    await fetch(SCRIPT_URL, { method: 'POST', mode: 'no-cors', body: JSON.stringify(data) });
    document.getElementById('material-form').reset();
    btn.innerText = "Sync to Database"; btn.disabled = false;
    loadData(data.item);
};

matSelect.onchange = (e) => loadData(e.target.value);
onAuthStateChanged(auth, (user) => {
    if (user) {
        document.getElementById('auth-container').style.display = 'none';
        document.getElementById('app-interface').style.display = 'block';
        document.getElementById('user-display').innerText = user.displayName;
        refreshStats();
    } else {
        document.getElementById('auth-container').style.display = 'flex';
        document.getElementById('app-interface').style.display = 'none';
    }
});
document.getElementById('login-btn').onclick = () => signInWithPopup(auth, provider);
document.getElementById('logout-btn').onclick = () => signOut(auth);
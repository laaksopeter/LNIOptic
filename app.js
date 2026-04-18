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
provider.setCustomParameters({ prompt: 'select_account' });

let currentPage = 'home';
let currentStock = [];

const sheetGrades = ["A1008", "A1011", "A36", "5052", "6061", "304 #4", "304 2B", "Other"];
const tubeShapes = ["Square", "Rectangle", "Round", "Angle", "Channel", "Bar"];
const shopStations = ["Laser Cut", "Forming", "Manual Machining", "CNC Machining", "Welding", "Shipping"];

const matSelect = document.getElementById('mat-name');
const inventoryList = document.getElementById('inventory-list');

document.querySelectorAll('.nav-links li').forEach(link => {
    link.onclick = () => {
        const page = link.getAttribute('data-page');
        if (!page) return;
        document.querySelectorAll('.nav-links li').forEach(l => l.classList.remove('active'));
        link.classList.add('active');
        currentPage = page;
        document.getElementById('page-title').innerText = link.innerText;
        
        if (page === 'home') {
            document.getElementById('home-view').style.display = 'block';
            document.getElementById('main-terminal').style.display = 'none';
        } else {
            document.getElementById('home-view').style.display = 'none';
            document.getElementById('main-terminal').style.display = 'grid';
            setupForm(page);
        }
    };
});

function setupForm(page) {
    inventoryList.innerHTML = "<p class='footer-note'>Select a category.</p>";
    if (page === 'wip_parts') {
        matSelect.style.display = 'none'; 
        document.getElementById('label-grade').innerText = "Workflow Active";
        setLabels("WIP", "Part Number", "Job Number", "Qty", "Initial Station");
        loadData("Master");
    } else {
        matSelect.style.display = 'block';
        if (page.includes('sheet')) {
            updateSelect(matSelect, sheetGrades);
            setLabels("Grade", "Thickness", "Size (W x L)", "Cert #", "Location");
        } else {
            updateSelect(matSelect, tubeShapes);
            setLabels("Shape", "Dimensions", "Length", "Cert #", "Location");
        }
    }
}

function setLabels(g, d, l, c, loc) {
    document.getElementById('label-dim').innerText = d;
    document.getElementById('label-len').innerText = l;
    document.getElementById('label-cert').innerText = c;
    document.getElementById('label-loc').innerText = loc;
}

function updateSelect(el, options) {
    el.innerHTML = '<option value="" disabled selected>Select...</option>';
    options.forEach(opt => { el.innerHTML += `<option value="${opt}">${opt}</option>`; });
}

async function loadData(tabName) {
    inventoryList.innerHTML = "<p class='footer-note'>Querying Database...</p>";
    const res = await fetch(`${SCRIPT_URL}?page=${currentPage}&grade=${tabName}`);
    currentStock = await res.json();
    renderInventory(currentStock);
}

function renderInventory(items) {
    inventoryList.innerHTML = "";
    items.forEach(item => {
        const div = document.createElement('div');
        div.className = "stock-item";
        const isWIP = currentPage === 'wip_parts';
        div.innerHTML = `
            <div style="flex:1;">
                <strong>${item.id}</strong> | ${item.size}<br>
                <small>${isWIP ? 'Station: ' : 'Loc: '}${item.loc}</small><br>
                <small style="color:var(--text-muted)">${isWIP ? 'Updated: ' : 'Cert: '}${isWIP ? item.other : item.cert}</small>
            </div>
            <button class="${isWIP ? 'btn-move' : 'btn-use'}" onclick="${isWIP ? `window.movePart('${item.id}')` : `window.deleteItem('${item.id}', '${item.type}')`}">${isWIP ? 'MOVE' : 'USE'}</button>
        `;
        inventoryList.appendChild(div);
    });
}

window.movePart = async (id) => {
    const next = prompt("Enter Next Station:", "Welding");
    if (!next) return;
    await fetch(SCRIPT_URL, { method: 'POST', mode: 'no-cors', body: JSON.stringify({ action: "MOVE", page: "wip_parts", item: "Master", id: id, nextStation: next, user: auth.currentUser.email }) });
    loadData("Master");
};

window.deleteItem = async (id, tab) => {
    if (!confirm(`Remove ${id}?`)) return;
    await fetch(SCRIPT_URL, { method: 'POST', mode: 'no-cors', body: JSON.stringify({ action: "DELETE", page: currentPage, item: tab, id: id, user: auth.currentUser.email }) });
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
        thickness: (currentPage === 'wip_parts') ? new Date().toLocaleDateString() : document.getElementById('dim-input').value,
        cert: document.getElementById('cert-num').value,
        loc: document.getElementById('location').value,
        type: (currentPage === 'wip_parts') ? "WIP" : matSelect.value,
        user: auth.currentUser.email
    };

    await fetch(SCRIPT_URL, { method: 'POST', mode: 'no-cors', body: JSON.stringify(data) });
    document.getElementById('material-form').reset();
    btn.innerText = "Add Entry"; btn.disabled = false;
    loadData(data.item);
};

matSelect.onchange = (e) => loadData(e.target.value);
onAuthStateChanged(auth, (user) => {
    document.getElementById('auth-container').style.display = user ? 'none' : 'block';
    document.getElementById('sidebar').style.display = user ? 'flex' : 'none';
    document.getElementById('app-interface').style.display = user ? 'block' : 'none';
    if(user) document.getElementById('user-display').innerText = user.displayName;
});
document.getElementById('login-btn').onclick = () => signInWithPopup(auth, provider);
document.getElementById('logout-btn').onclick = () => signOut(auth);
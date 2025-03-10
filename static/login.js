let authToken = null;
let currentAdmin = null;

function showLogin() {
    document.getElementById('loginModal').classList.remove('hidden');
}

function closeLogin() {
    document.getElementById('loginModal').classList.add('hidden');
}


async function handleLogin(event) {
    event.preventDefault();
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;
    try {

        const response = await fetch('https://asimabdulkhaleq-unismartagentapi.hf.space/api/token', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Authorization': `Bearer ${apiToken}`  // Include the fetched token
            },
            body: new URLSearchParams({ username, password, grant_type: 'password' })
        });
      
        
        if (!response.ok) throw new Error('Login failed');
        const data = await response.json();
       // window.authToken = data.access_token;
        window.currentAdmin = data.username;
        localStorage.setItem('authToken', window.authToken);
        localStorage.setItem('currentAdmin', window.currentAdmin);
        console.log("Login successful. Token:", window.authToken);
        closeLogin();
        connectAdminWebSocket(data.username); // Connect WebSocket immediately after login
        showDashboard();
        updateNavbar();
    } catch (error) {
        console.error('Login error:', error);
        alert('Login failed: Incorrect username or password');
    }
}

function updateNavbar() {
    const adminInfo = document.getElementById('adminInfo');
    const loginButton = document.getElementById('signInButton');
    if (window.currentAdmin) { // Change from currentAdmin to window.currentAdmin
        document.getElementById('adminName').textContent = window.currentAdmin;
        adminInfo.classList.remove('hidden');
        loginButton.classList.add('hidden');
    } else {
        adminInfo.classList.add('hidden');
        loginButton.classList.remove('hidden');
    }
}

function logout() {
    window.authToken = null; // Change to window variables
    window.currentAdmin = null;
    updateNavbar();
    document.getElementById('dashboard').classList.add('hidden');
    document.getElementById('chatContainer').parentElement.classList.remove('hidden');
}

function showDashboard() {
    console.log("Showing dashboard with token:", window.authToken);
    document.getElementById('dashboard').classList.remove('hidden');
    document.getElementById('chatContainer').parentElement.classList.add('hidden');
    try {
        if (typeof initDataTables === 'function') {
            initDataTables();
        } else {
            throw new Error("initDataTables is not defined");
        }
        if (typeof loadCharts === 'function') {
            loadCharts();
        } else {
            console.warn("loadCharts is not defined");
        }
    } catch (error) {
        console.error("Error showing dashboard:", error);
        alert("Dashboard initialization failed: " + error.message);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    console.log("login.js loaded");
    document.getElementById('signInButton').addEventListener('click', showLogin);
    document.getElementById('logoutButton').addEventListener('click', logout);
});
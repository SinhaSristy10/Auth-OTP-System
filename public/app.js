
let currentEmail = '';
let countdownTimer = null;
const API_BASE = '/api';


function switchTab(tab) {
    const tabRegister = document.getElementById('tabRegister');
    const tabLogin = document.getElementById('tabLogin');
    const registerForm = document.getElementById('registerForm');
    const loginForm = document.getElementById('loginForm');
    const toast = document.getElementById('toastMessage');

    toast.classList.add('hidden');

    if (tab === 'register') {
        tabRegister.classList.add('active');
        tabLogin.classList.remove('active');
        registerForm.classList.remove('hidden');
        loginForm.classList.add('hidden');
    } else {
        tabLogin.classList.add('active');
        tabRegister.classList.remove('active');
        loginForm.classList.remove('hidden');
        registerForm.classList.add('hidden');
    }
}


function showToast(message, type = 'error') {
    const toast = document.getElementById('toastMessage');
    toast.textContent = message;
    toast.className = `toast ${type}`;
    toast.classList.remove('hidden');

    
    setTimeout(() => {
        toast.classList.add('hidden');
    }, 5000);
}


async function handleRegister(e) {
    e.preventDefault();
    const btn = document.getElementById('btnRegister');
    const name = document.getElementById('regName').value.trim();
    const email = document.getElementById('regEmail').value.trim();
    const password = document.getElementById('regPassword').value;

    btn.disabled = true;
    btn.innerHTML = '<span>Sending OTP...</span>';

    try {
        const res = await fetch(`${API_BASE}/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, email, password })
        });
        const data = await res.json();

        if (!res.ok) throw new Error(data.error || 'Registration failed');

        currentEmail = email;
        openOTPModal(email);
        showToast('OTP sent! Check your email or backend terminal.', 'success');
    } catch (err) {
        showToast(err.message, 'error');
    } finally {
        btn.disabled = false;
        btn.innerHTML = '<span>Create Account & Send OTP</span>';
    }
}


const otpBoxes = document.querySelectorAll('.otp-box');

otpBoxes.forEach((box, index) => {
    
    box.addEventListener('input', (e) => {
        const val = e.target.value;
        if (val.length === 1 && index < otpBoxes.length - 1) {
            otpBoxes[index + 1].focus();
        }
    });

    
    box.addEventListener('keydown', (e) => {
        if (e.key === 'Backspace' && !box.value && index > 0) {
            otpBoxes[index - 1].focus();
        }
    });

    
    box.addEventListener('paste', (e) => {
        e.preventDefault();
        const pastedData = (e.clipboardData || window.clipboardData).getData('text').trim();
        if (/^\d{6}$/.test(pastedData)) {
            pastedData.split('').forEach((char, i) => {
                if (otpBoxes[i]) otpBoxes[i].value = char;
            });
            otpBoxes[5].focus();
        }
    });
});


function openOTPModal(email) {
    document.getElementById('displayEmail').textContent = email;
    document.getElementById('otpModal').classList.remove('hidden');

    
    otpBoxes.forEach(b => b.value = '');
    setTimeout(() => otpBoxes[0].focus(), 100);

    startCountdown();
}


function startCountdown() {
    let timeLeft = 60;
    const timerText = document.getElementById('timerText');
    const countdownSpan = document.getElementById('countdown');
    const btnResend = document.getElementById('btnResend');

    timerText.classList.remove('hidden');
    btnResend.classList.add('hidden');
    countdownSpan.textContent = timeLeft;

    clearInterval(countdownTimer);
    countdownTimer = setInterval(() => {
        timeLeft--;
        countdownSpan.textContent = timeLeft;
        if (timeLeft <= 0) {
            clearInterval(countdownTimer);
            timerText.classList.add('hidden');
            btnResend.classList.remove('hidden');
        }
    }, 1000);
}


async function handleVerifyOTP() {
    const btn = document.getElementById('btnVerify');
    let enteredOTP = '';
    otpBoxes.forEach(box => enteredOTP += box.value);

    if (enteredOTP.length !== 6) {
        alert('Please enter complete 6-digit OTP');
        return;
    }

    btn.disabled = true;
    btn.innerHTML = '<span>Verifying...</span>';

    try {
        const res = await fetch(`${API_BASE}/verify-otp`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: currentEmail, otp: enteredOTP })
        });
        const data = await res.json();

        if (!res.ok) throw new Error(data.error || 'Verification failed');

        
        document.getElementById('otpModal').classList.add('hidden');
        switchTab('login');
        document.getElementById('loginEmail').value = currentEmail;
        showToast('Email verified successfully! Please log in.', 'success');
    } catch (err) {
        alert(err.message);
    } finally {
        btn.disabled = false;
        btn.innerHTML = '<span>Verify & Activate</span>';
    }
}


async function handleResendOTP() {
    const btnResend = document.getElementById('btnResend');
    btnResend.textContent = 'Sending...';

    try {
        const res = await fetch(`${API_BASE}/resend-otp`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: currentEmail })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);

        alert('A new OTP has been sent to your email!');
        startCountdown();
    } catch (err) {
        alert(err.message);
    } finally {
        btnResend.textContent = 'Resend OTP';
    }
}


async function handleLogin(e) {
    e.preventDefault();
    const btn = document.getElementById('btnLogin');
    const email = document.getElementById('loginEmail').value.trim();
    const password = document.getElementById('loginPassword').value;

    btn.disabled = true;
    btn.innerHTML = '<span>Authenticating...</span>';

    try {
        const res = await fetch(`${API_BASE}/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });
        const data = await res.json();

        
        if (res.status === 403 && data.needsVerification) {
            currentEmail = data.email;
            openOTPModal(currentEmail);
            showToast('Please verify your email OTP before logging in.', 'error');
            return;
        }

        if (!res.ok) throw new Error(data.error || 'Login failed');

        
        localStorage.setItem('auth_token', data.token);
        localStorage.setItem('auth_user', JSON.stringify(data.user));

        renderDashboard(data.user);
    } catch (err) {
        showToast(err.message, 'error');
    } finally {
        btn.disabled = false;
        btn.innerHTML = '<span>Log In to Dashboard</span>';
    }
}


function renderDashboard(user) {
    document.getElementById('authContainer').classList.add('hidden');
    document.getElementById('dashboardContainer').classList.remove('hidden');

    document.getElementById('dashWelcome').textContent = `Welcome, ${user.name}!`;
    document.getElementById('dashEmail').textContent = user.email;
    document.getElementById('dashAvatar').textContent = user.name.charAt(0).toUpperCase();
}

function handleLogout() {
    localStorage.removeItem('auth_token');
    localStorage.removeItem('auth_user');
    document.getElementById('dashboardContainer').classList.add('hidden');
    document.getElementById('authContainer').classList.remove('hidden');
    switchTab('login');
    showToast('Logged out successfully.', 'success');
}


window.addEventListener('DOMContentLoaded', async () => {
    const token = localStorage.getItem('auth_token');
    if (!token) return;

    try {
        const res = await fetch(`${API_BASE}/profile`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (res.ok) {
            const data = await res.json();
            renderDashboard(data.user);
        } else {
            handleLogout();
        }
    } catch (e) {
        handleLogout();
    }
});
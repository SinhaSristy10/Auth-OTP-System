require('dotenv').config();
const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');

const app = express();
const PORT = process.env.PORT || 5000;
const DB_FILE = process.env.VERCEL ? path.join('/tmp', 'users.json') : path.join(__dirname, 'users.json');

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public'))); 


function getUsers() {
    if (!fs.existsSync(DB_FILE)) {
        fs.writeFileSync(DB_FILE, JSON.stringify([]));
    }
    const data = fs.readFileSync(DB_FILE, 'utf-8');
    return JSON.parse(data || '[]');
}

function saveUsers(users) {
    fs.writeFileSync(DB_FILE, JSON.stringify(users, null, 2));
}


const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
});


async function sendOTPEmail(email, otp, name) {
    const mailOptions = {
        from: `"SecureAuth" <${process.env.EMAIL_USER}>`,
        to: email,
        subject: 'Your Verification Code (OTP)',
        html: `
            <div style="font-family: Arial, sans-serif; max-width: 500px; margin: auto; padding: 25px; border: 1px solid #e2e8f0; border-radius: 12px; background-color: #ffffff;">
                <h2 style="color: #4f46e5; text-align: center; margin-top: 0;">SecureAuth Verification</h2>
                <p>Hello <b>${name}</b>,</p>
                <p>Thank you for signing up. Please use the OTP below to verify your email address. It is valid for <b>5 minutes</b>.</p>
                <div style="text-align: center; margin: 30px 0;">
                    <span style="font-size: 32px; font-weight: bold; letter-spacing: 6px; color: #1e1b4b; background: #e0e7ff; padding: 12px 24px; border-radius: 8px; border: 1px dashed #6366f1;">
                        ${otp}
                    </span>
                </div>
                <p style="color: #64748b; font-size: 13px; text-align: center;">If you did not request this OTP, you can safely ignore this email.</p>
            </div>
        `
    };

    try {
        await transporter.sendMail(mailOptions);
        console.log(`[Email Sent] OTP successfully sent to: ${email}`);
    } catch (err) {
        console.warn(`[Email Warning] Could not send email (${err.message}). Check terminal for OTP!`);
    }
}




app.post('/api/register', async (req, res) => {
    try {
        const { name, email, password } = req.body;
        if (!name || !email || !password) {
            return res.status(400).json({ error: 'All fields are required!' });
        }

        const users = getUsers();
        const existingUser = users.find(u => u.email.toLowerCase() === email.toLowerCase());

        
        if (existingUser && existingUser.isVerified) {
            return res.status(400).json({ error: 'Email already registered and verified. Please login.' });
        }

        
        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        const otpExpiresAt = Date.now() + 5 * 60 * 1000; // 5 minute validity
        const hashedPassword = await bcrypt.hash(password, 10);

        if (existingUser) {
            
            existingUser.name = name;
            existingUser.password = hashedPassword;
            existingUser.otp = otp;
            existingUser.otpExpiresAt = otpExpiresAt;
        } else {
            
            users.push({
                id: Date.now().toString(),
                name,
                email: email.toLowerCase(),
                password: hashedPassword,
                isVerified: false,
                otp,
                otpExpiresAt,
                createdAt: new Date().toISOString()
            });
        }

        saveUsers(users);

        
        console.log(`\n========================================`);
        console.log(`🔑 OTP generated for ${email}: [ ${otp} ]`);
        console.log(`========================================\n`);

        
        await sendOTPEmail(email, otp, name);

        res.status(200).json({ 
            message: 'OTP has been sent to your email!',
            email: email.toLowerCase()
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});


app.post('/api/verify-otp', (req, res) => {
    try {
        const { email, otp } = req.body;
        if (!email || !otp) {
            return res.status(400).json({ error: 'Email and OTP are required!' });
        }

        const users = getUsers();
        const user = users.find(u => u.email.toLowerCase() === email.toLowerCase());

        if (!user) {
            return res.status(404).json({ error: 'User not found!' });
        }

        if (user.isVerified) {
            return res.status(400).json({ error: 'User already verified. Please login!' });
        }

        
        if (Date.now() > user.otpExpiresAt) {
            return res.status(400).json({ error: 'OTP has expired! Please request a new one.' });
        }

        
        if (user.otp !== otp.trim()) {
            return res.status(400).json({ error: 'Invalid OTP! Please check and try again.' });
        }

        
        user.isVerified = true;
        user.otp = null;
        user.otpExpiresAt = null;
        saveUsers(users);

        res.status(200).json({ message: 'Email verified successfully! You can now login.' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});


app.post('/api/resend-otp', async (req, res) => {
    try {
        const { email } = req.body;
        const users = getUsers();
        const user = users.find(u => u.email.toLowerCase() === email.toLowerCase());

        if (!user) {
            return res.status(404).json({ error: 'User not found!' });
        }

        if (user.isVerified) {
            return res.status(400).json({ error: 'User already verified. Please login.' });
        }

        
        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        user.otp = otp;
        user.otpExpiresAt = Date.now() + 5 * 60 * 1000;
        saveUsers(users);

        console.log(`\n========================================`);
        console.log(`🔄 Resent OTP for ${email}: [ ${otp} ]`);
        console.log(`========================================\n`);

        await sendOTPEmail(user.email, otp, user.name);

        res.status(200).json({ message: 'New OTP sent to your email!' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        if (!email || !password) {
            return res.status(400).json({ error: 'Email and password are required!' });
        }

        const users = getUsers();
        const user = users.find(u => u.email.toLowerCase() === email.toLowerCase());

        if (!user) {
            return res.status(400).json({ error: 'Invalid email or password!' });
        }

        
        if (!user.isVerified) {
            return res.status(403).json({ 
                error: 'Email not verified! Please verify OTP first.',
                needsVerification: true,
                email: user.email 
            });
        }

        
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(400).json({ error: 'Invalid email or password!' });
        }

        
        const token = jwt.sign(
            { id: user.id, email: user.email, name: user.name },
            process.env.JWT_SECRET || 'secret_key',
            { expiresIn: '2h' }
        );

        res.status(200).json({
            message: 'Login successful!',
            token,
            user: { id: user.id, name: user.name, email: user.email }
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});


app.get('/api/profile', (req, res) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Access denied! No token provided.' });
    }

    const token = authHeader.split(' ')[1];
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret_key');
        res.status(200).json({ user: decoded });
    } catch (err) {
        res.status(401).json({ error: 'Invalid or expired token!' });
    }
});


app.listen(PORT, () => {
    console.log(`\n🚀 Server running smoothly on http://localhost:${PORT}`);
    console.log(`📁 Database connected: users.json`);
    module.exports = app;
});
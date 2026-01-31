const express = require('express');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const nodemailer = require('nodemailer');
const User = require('../models/User');
const { auth } = require('../middleware/auth');

const router = express.Router();

// Helper function to normalize email (lowercase, trim whitespace)
const normalizeEmail = (email) => {
  if (!email) return undefined;
  return String(email).toLowerCase().trim();
};

// Generate JWT Token
const generateToken = (userId) => {
  return jwt.sign({ userId }, process.env.JWT_SECRET || 'your_super_secret_jwt_key_change_this_in_production', {
    expiresIn: '7d'
  });
};

// Register
router.post('/register', async (req, res) => {
  try {
    const { firstName, lastName, email, phone, password, role, department, school, studentId, courseYear } = req.body;

    // Validate required fields
    if (!firstName || !lastName || !phone || !password) {
      return res.status(400).json({ message: 'firstName, lastName, phone, and password are required' });
    }
    
    const userRole = role || 'student';
    const isAdmin = userRole === 'admin';
    const isFaculty = userRole === 'staff';
    
    // Email is required for all users
    if (!email) {
      return res.status(400).json({ message: 'Email is required' });
    }

    // Validate email format - all users must use @gmail.com
    const normalizedEmail = email.toLowerCase().trim();
    if (!normalizedEmail.endsWith('@gmail.com')) {
      return res.status(400).json({ message: 'Email must be a valid @gmail.com address' });
    }
    
    if (!isAdmin) {
      if (!school) {
        return res.status(400).json({ message: 'school is required for non-admin users' });
      }
      if (userRole === 'student' && !department) {
        return res.status(400).json({ message: 'department is required for students' });
      }
      if (isFaculty && !department) {
        return res.status(400).json({ message: 'department is required for faculty' });
      }
    }

    // Validate Indian phone number
    if (!/^[6-9][0-9]{9}$/.test(phone)) {
      return res.status(400).json({ message: 'Phone must be a valid 10-digit Indian mobile number' });
    }

    // Check if user already exists
    const existingUser = await User.findOne({ $or: [{ email: normalizedEmail }, { phone }] });
    if (existingUser) {
      return res.status(400).json({ message: 'User already exists with this email or phone' });
    }

    // Create new user with provided email
    const userData = {
      firstName,
      lastName,
      email: normalizedEmail,
      phone,
      password,
      role: userRole,
      department: userRole === 'student' ? department : (department || ''),
      school: isAdmin ? '' : school,
      studentId
    };
    
    // Only include courseYear if provided
    if (courseYear && courseYear.trim()) {
      userData.courseYear = courseYear.trim();
    }
    
    const user = new User(userData);

    await user.save();

    const token = generateToken(user._id);

    res.status(201).json({
      token,
      user: {
        id: user._id,
        name: `${user.firstName} ${user.lastName}`,
        email: user.email,
        role: user.role,
        department: user.department,
        school: user.school
      }
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Login
router.post('/login', async (req, res) => {
  try {
    const { identifier, password } = req.body; // identifier can be email or phone

    // Find user by email or phone
    let user = null;
    if (identifier && identifier.includes('@')) {
      // Normalize email for lookup (students/faculty use name.courseyear@chanakyauniversity.edu.in format)
      const normalizedEmail = normalizeEmail(identifier);
      user = await User.findOne({ email: normalizedEmail });
    } else if (identifier && /^[0-9]{10}$/.test(identifier)) {
      user = await User.findOne({ phone: identifier });
    }
    if (!user) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    // Check password
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    const token = generateToken(user._id);

    res.json({
      token,
      user: {
        id: user._id,
        name: `${user.firstName} ${user.lastName}`,
        email: user.email,
        role: user.role,
        department: user.department,
        school: user.school
      }
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get current user
router.get('/me', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('-password');
    res.json(user);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Forgot password - request reset
router.post('/forgot', async (req, res) => {
  try {
    const { email, phone } = req.body;
    if (!email && !phone) return res.status(400).json({ message: 'Email or phone is required' });

    // Normalize email and find user (students/faculty use name.courseyear@chanakyauniversity.edu.in format)
    const normalizedEmail = normalizeEmail(email);
    const user = normalizedEmail ? await User.findOne({ email: normalizedEmail }) : await User.findOne({ phone });
    if (!user) {
      // Do not reveal whether user exists
      return res.json({ message: 'If the email/phone exists, a reset link has been sent' });
    }

    const token = crypto.randomBytes(20).toString('hex');
    const expiresAt = new Date(Date.now() + 1000 * 60 * 15); // 15 minutes
    // Update only the reset fields to avoid triggering full schema validation
    await User.updateOne(
      { _id: user._id },
      { $set: { resetPasswordToken: token, resetPasswordExpires: expiresAt } }
    );

    const resetUrl = `${process.env.FRONTEND_BASE_URL || 'http://localhost:3000'}/reset-password.html?token=${token}&email=${encodeURIComponent(user.email)}&phone=${encodeURIComponent(user.phone)}`;

    // Prepare email content
    const emailSubject = 'Password Reset - Campus Complaint System';
    const emailHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #1565C0;">Password Reset Request</h2>
        <p>Hello ${user.firstName} ${user.lastName},</p>
        <p>You requested a password reset for your account.</p>
        <p>Click the button below to reset your password. This link is valid for 15 minutes.</p>
        <div style="margin: 30px 0;">
          <a href="${resetUrl}" style="background-color: #1565C0; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block;">Reset Password</a>
        </div>
        <p>If the button doesn't work, copy and paste this URL into your browser:</p>
        <p style="color: #666; word-break: break-all;">${resetUrl}</p>
        <p style="margin-top: 30px; color: #999; font-size: 12px;">If you didn't request this password reset, please ignore this email.</p>
      </div>
    `;

    // Try to send email via SMTP (if configured)
    let emailSent = false;
    let emailError = null;
    const smtpConfigured = process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS;
    
    console.log(`[FORGOT PASSWORD] User found: ${user.email}, SMTP configured: ${smtpConfigured}`);
    if (!smtpConfigured) {
      console.log(`[FORGOT PASSWORD] SMTP Configuration Status:`);
      console.log(`  - SMTP_HOST: ${process.env.SMTP_HOST ? '✓ Set' : '✗ Missing'}`);
      console.log(`  - SMTP_USER: ${process.env.SMTP_USER ? '✓ Set' : '✗ Missing'}`);
      console.log(`  - SMTP_PASS: ${process.env.SMTP_PASS ? '✓ Set' : '✗ Missing'}`);
    }
    
    if (smtpConfigured) {
      try {
        console.log(`[FORGOT PASSWORD] Attempting to send password reset email to ${user.email} via SMTP...`);
        console.log(`[FORGOT PASSWORD] SMTP Config - Host: ${process.env.SMTP_HOST}, Port: ${process.env.SMTP_PORT || 587}, User: ${process.env.SMTP_USER}`);
        
        const transporter = nodemailer.createTransport({
          host: process.env.SMTP_HOST,
          port: Number(process.env.SMTP_PORT || 587),
          secure: process.env.SMTP_SECURE === 'true' || false,
          auth: { 
            user: process.env.SMTP_USER, 
            pass: process.env.SMTP_PASS 
          },
          tls: {
            rejectUnauthorized: false // Allow self-signed certificates
          }
        });

        // Verify connection configuration
        console.log(`[FORGOT PASSWORD] Verifying SMTP connection...`);
        await transporter.verify();
        console.log('[FORGOT PASSWORD] SMTP server connection verified successfully');

        // Send email
        console.log(`[FORGOT PASSWORD] Sending email to ${user.email}...`);
        const info = await transporter.sendMail({
          from: process.env.FROM_EMAIL || 'no-reply@chanakyauniversity.edu.in',
          to: user.email,
          subject: emailSubject,
          html: emailHtml
        });

        emailSent = true;
        console.log(`[FORGOT PASSWORD] ✓ Password reset email sent successfully to ${user.email}`);
        console.log(`[FORGOT PASSWORD] Message ID: ${info.messageId}`);
        console.log(`[FORGOT PASSWORD] Response: ${JSON.stringify(info.response)}`);
      } catch (error) {
        emailError = error.message;
        console.error('[FORGOT PASSWORD] ✗ ERROR: Failed to send password reset email to', user.email);
        console.error('[FORGOT PASSWORD] SMTP Error Message:', error.message);
        console.error('[FORGOT PASSWORD] SMTP Error Code:', error.code);
        if (error.response) {
          console.error('[FORGOT PASSWORD] SMTP Response:', error.response);
        }
        if (error.responseCode) {
          console.error('[FORGOT PASSWORD] SMTP Response Code:', error.responseCode);
        }
        if (error.command) {
          console.error('[FORGOT PASSWORD] SMTP Command:', error.command);
        }
        console.error('[FORGOT PASSWORD] Error Stack:', error.stack);
        // emailSent remains false, will fall back to returning resetUrl
      }
    } else {
      console.log(`[FORGOT PASSWORD] SMTP not configured. Missing: ${!process.env.SMTP_HOST ? 'SMTP_HOST ' : ''}${!process.env.SMTP_USER ? 'SMTP_USER ' : ''}${!process.env.SMTP_PASS ? 'SMTP_PASS' : ''}`);
      console.log(`[FORGOT PASSWORD] Cannot send email to ${user.email}`);
      console.log(`[FORGOT PASSWORD] Reset URL generated: ${resetUrl}`);
    }

    // Send SMS (placeholder - integrate with SMS service)
    // TODO: Integrate with SMS service (Twilio, AWS SNS, etc.)
    const smsMessage = `Password reset link: ${resetUrl} (Valid for 15 minutes)`;
    console.log(`SMS would be sent to ${user.phone}: ${smsMessage}`);

    // Always return success message to avoid revealing if user exists
    // Always include resetUrl in response (as backup even if email was sent)
    if (emailSent) {
      return res.json({ 
        message: 'If the email/phone exists, a reset link has been sent to your email and phone',
        resetUrl, 
        token,
        email: user.email,
        phone: user.phone,
        emailSent: true
      });
    }
    
    // Fallback: return resetUrl and token so user can proceed without SMTP
    let fallbackMessage = 'If the email/phone exists, a reset link has been sent. If you don\'t receive it, use the link below.';
    if (!smtpConfigured) {
      fallbackMessage += ' (Email service not configured - please contact administrator)';
    } else if (emailError) {
      fallbackMessage += ` (Email sending failed: ${emailError})`;
    }
    
    return res.json({ 
      message: fallbackMessage,
      resetUrl, 
      token,
      email: user.email,
      phone: user.phone,
      emailSent: false,
      smtpConfigured: smtpConfigured,
      emailError: emailError || (smtpConfigured ? null : 'SMTP not configured')
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Test SMTP configuration (for debugging)
router.post('/test-email', async (req, res) => {
  try {
    const { testEmail } = req.body;
    if (!testEmail) {
      return res.status(400).json({ message: 'testEmail is required' });
    }

    const smtpConfigured = process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS;
    
    if (!smtpConfigured) {
      return res.status(400).json({ 
        message: 'SMTP not configured',
        details: {
          SMTP_HOST: process.env.SMTP_HOST ? 'Set' : 'Missing',
          SMTP_USER: process.env.SMTP_USER ? 'Set' : 'Missing',
          SMTP_PASS: process.env.SMTP_PASS ? 'Set' : 'Missing'
        }
      });
    }

    console.log('[TEST EMAIL] Testing SMTP configuration...');
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT || 587),
      secure: process.env.SMTP_SECURE === 'true' || false,
      auth: { 
        user: process.env.SMTP_USER, 
        pass: process.env.SMTP_PASS 
      },
      tls: {
        rejectUnauthorized: false
      }
    });

    // Verify connection
    await transporter.verify();
    console.log('[TEST EMAIL] SMTP connection verified');

    // Send test email
    const info = await transporter.sendMail({
      from: process.env.FROM_EMAIL || 'no-reply@chanakyauniversity.edu.in',
      to: testEmail,
      subject: 'Test Email - Campus Complaint System',
      html: '<p>This is a test email from the Campus Complaint System.</p><p>If you receive this, SMTP is configured correctly!</p>'
    });

    console.log('[TEST EMAIL] Test email sent successfully');
    res.json({ 
      message: 'Test email sent successfully',
      messageId: info.messageId,
      response: info.response
    });
  } catch (error) {
    console.error('[TEST EMAIL] Error:', error.message);
    res.status(500).json({ 
      message: 'Failed to send test email',
      error: error.message,
      code: error.code,
      response: error.response
    });
  }
});

// Reset password with token
router.post('/reset', async (req, res) => {
  try {
    const { email, phone, token, newPassword } = req.body;
    if ((!email && !phone) || !token || !newPassword) {
      return res.status(400).json({ message: 'email or phone, token and newPassword are required' });
    }

    // Normalize email for lookup (students/faculty use name.courseyear@chanakyauniversity.edu.in format)
    const normalizedEmail = normalizeEmail(email);
    const user = normalizedEmail
      ? await User.findOne({ email: normalizedEmail, resetPasswordToken: token, resetPasswordExpires: { $gt: Date.now() } })
      : await User.findOne({ phone, resetPasswordToken: token, resetPasswordExpires: { $gt: Date.now() } });
    if (!user) {
      return res.status(400).json({ message: 'Invalid or expired reset token' });
    }

    user.password = newPassword; // will be validated and hashed by pre-save hook
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;
    await user.save();

    res.json({ message: 'Password has been reset successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

module.exports = router;

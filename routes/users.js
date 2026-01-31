const express = require('express');
const User = require('../models/User');
const Notification = require('../models/Notification');
const { auth, adminAuth } = require('../middleware/auth');

const router = express.Router();

// Get all users (Admin only)
router.get('/', adminAuth, async (req, res) => {
  try {
    const users = await User.find().select('-password').sort({ createdAt: -1 });
    res.json(users);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Create user (Admin only)
router.post('/', adminAuth, async (req, res) => {
  try {
    const { firstName, lastName, email, phone, password, role, department, school, studentId, courseYear } = req.body;
    
    const isAdmin = role === 'admin';
    
    // Validate required fields
    if (!firstName || !lastName || !phone || !password || !role) {
      return res.status(400).json({ message: 'Missing required fields' });
    }
    
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
        return res.status(400).json({ message: 'School is required for non-admin users' });
      }
      // Department is required for students and faculty
      if (!department) {
        return res.status(400).json({ message: 'Department is required for students and faculty' });
      }
    }
    
    if (!/^[6-9][0-9]{9}$/.test(phone)) {
      return res.status(400).json({ message: 'Phone must be a valid 10-digit Indian mobile number' });
    }
    
    const existing = await User.findOne({ $or: [{ email: normalizedEmail }, { phone }] });
    if (existing) return res.status(400).json({ message: 'User already exists with this email or phone' });
    
    const userData = {
      firstName, 
      lastName, 
      email: normalizedEmail, 
      phone, 
      password, 
      role, 
      department: role === 'student' ? department : (department || ''), 
      school: isAdmin ? '' : school, 
      studentId
    };
    
    // Only include courseYear if provided
    if (courseYear && courseYear.trim()) {
      userData.courseYear = courseYear.trim();
    }
    
    const user = new User(userData);
    await user.save();
    res.status(201).json({ id: user._id, email: user.email });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Update user (Admin only)
router.put('/:id', adminAuth, async (req, res) => {
  try {
    const update = { ...req.body };
    // Disallow direct password change here (use reset flow)
    delete update.password;
    const user = await User.findByIdAndUpdate(req.params.id, update, { new: true }).select('-password');
    if (!user) return res.status(404).json({ message: 'User not found' });
    res.json(user);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Delete user (Admin only)
router.delete('/:id', adminAuth, async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ message: 'User not found' });
    await User.findByIdAndDelete(req.params.id);
    res.json({ message: 'User deleted' });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get user notifications
router.get('/notifications', auth, async (req, res) => {
  try {
    const notifications = await Notification.find({ userId: req.user._id })
      .populate('complaintId', 'title status')
      .sort({ createdAt: -1 })
      .limit(50);
    
    res.json(notifications);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Mark notification as read
router.put('/notifications/:id/read', auth, async (req, res) => {
  try {
    const notification = await Notification.findById(req.params.id);
    
    if (!notification) {
      return res.status(404).json({ message: 'Notification not found' });
    }

    if (notification.userId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Access denied' });
    }

    notification.read = true;
    await notification.save();

    res.json(notification);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Mark all notifications as read
router.put('/notifications/read-all', auth, async (req, res) => {
  try {
    await Notification.updateMany(
      { userId: req.user._id, read: false },
      { $set: { read: true } }
    );

    res.json({ message: 'All notifications marked as read' });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

module.exports = router;

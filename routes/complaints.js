const express = require('express');
const Complaint = require('../models/Complaint');
const Notification = require('../models/Notification');
const { auth, adminAuth } = require('../middleware/auth');
const upload = require('../middleware/upload');
const path = require('path');
const { notifyUser } = require('../utils/notifications');

const router = express.Router();

// Create complaint (Student/Staff)
router.post('/', auth, upload.fields([
  { name: 'photos', maxCount: 5 },
  { name: 'video', maxCount: 1 },
  { name: 'voice', maxCount: 1 }
]), async (req, res) => {
  try {
    const { title, description, category, subcategory, priority } = req.body;

    const photos = req.files && req.files['photos'] ? req.files['photos'].map(file => `/uploads/${file.filename}`) : [];
    const video = req.files && req.files['video'] ? [`/uploads/${req.files['video'][0].filename}`] : [];
    const voice = req.files && req.files['voice'] ? [`/uploads/${req.files['voice'][0].filename}`] : [];

    const complaint = new Complaint({
      title,
      description,
      category: category || 'other',
      subcategory: subcategory || '',
      priority: priority || 'medium',
      userId: req.user._id,
      department: req.user.department,
      school: req.user.school,
      photos: photos,
      video: video,
      voice: voice
    });

    await complaint.save();

    // Create notification for all admins
    const User = require('../models/User');
    const admins = await User.find({ role: 'admin' });
    for (const admin of admins) {
      const adminNotification = new Notification({
        userId: admin._id,
        complaintId: complaint._id,
        message: `New complaint "${title}" has been submitted from ${req.user.school} - ${req.user.department}`,
        type: 'status_update'
      });
      await adminNotification.save();
    }

    // Create notification for faculty members in the same school and department
    const facultyMembers = await User.find({
      role: 'staff',
      school: req.user.school,
      department: req.user.department
    });

    const complaintDate = new Date();
    const formattedDate = complaintDate.toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });

    for (const faculty of facultyMembers) {
      const facultyNotification = new Notification({
        userId: faculty._id,
        complaintId: complaint._id,
        message: `New complaint "${title}" from ${req.user.school} - ${req.user.department} submitted on ${formattedDate}. Category: ${category}`,
        type: 'status_update'
      });
      await facultyNotification.save();

      // Send notification email and SMS to faculty (informational only)
      const emailSubject = `Notification: New Complaint Received`;
      const emailMessage = `
        <h2>Notification: New Complaint</h2>
        <p>A new complaint has been submitted in your department.</p>
        <p><strong>Title:</strong> ${title}</p>
        <p><strong>School:</strong> ${req.user.school}</p>
        <p><strong>Department:</strong> ${req.user.department}</p>
        <p><strong>Category:</strong> ${category}</p>
        <p><strong>Priority:</strong> ${priority}</p>
        <p><strong>Submitted on:</strong> ${formattedDate}</p>
        <p style="margin-top: 20px; padding: 15px; background: #f0f0f0; border-radius: 5px;">
          <strong>Note:</strong> This is a notification only. Please check your dashboard to view and manage this complaint.
        </p>
      `;
      const smsMessage = `Notification: New complaint "${title}" from ${req.user.school} - ${req.user.department}. Check your dashboard for details.`;
      
      await notifyUser(faculty, emailSubject, emailMessage);
      if (faculty.phone) {
        await notifyUser(faculty, emailSubject, smsMessage);
      }
    }

    // Send notification to student (email and SMS) - informational only
    const student = await User.findById(req.user._id);
    if (student) {
      const studentEmailSubject = `Notification: Complaint Submitted`;
      const studentEmailMessage = `
        <h2>Notification: Complaint Submitted Successfully</h2>
        <p>Your complaint has been received and will be reviewed by the faculty.</p>
        <p><strong>Title:</strong> ${title}</p>
        <p><strong>Category:</strong> ${category}</p>
        <p><strong>Priority:</strong> ${priority}</p>
        <p><strong>Submitted on:</strong> ${formattedDate}</p>
        <p><strong>Status:</strong> Pending</p>
        <p style="margin-top: 20px; padding: 15px; background: #f0f0f0; border-radius: 5px;">
          <strong>Note:</strong> This is a notification only. Please check your dashboard to track the status of your complaint.
        </p>
      `;
      const studentSMSMessage = `Notification: Your complaint "${title}" has been submitted. Check your dashboard for status updates.`;
      
      await notifyUser(student, studentEmailSubject, studentEmailMessage);
      if (student.phone) {
        await notifyUser(student, studentEmailSubject, studentSMSMessage);
      }
    }

    res.status(201).json(complaint);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get all complaints (with filters)
router.get('/', auth, async (req, res) => {
  try {
    let query = {};
    
    // Students can only see their own complaints
    if (req.user.role === 'student') {
      query.userId = req.user._id;
    }
    
    // Faculty see complaints from their school
    // If faculty has a department, they see complaints from their department and school
    // If faculty doesn't have a department, they see all complaints from their school
    if (req.user.role === 'staff') {
      if (req.user.department && req.user.department.trim() !== '') {
        // Faculty with department sees only their department complaints from their school
        query.$or = [
          { assignedTo: req.user._id },
          { department: req.user.department, school: req.user.school }
        ];
      } else {
        // Faculty without department sees all complaints from their school
        query.$or = [
          { assignedTo: req.user._id },
          { school: req.user.school }
        ];
      }
    }
    
    // Admins can see all complaints
    
    // Filter by status
    if (req.query.status) {
      query.status = req.query.status;
    }
    
    // Filter by category
    if (req.query.category) {
      query.category = req.query.category;
    }

    const complaints = await Complaint.find(query)
      .populate('userId', 'firstName lastName email role department school')
      .populate('assignedTo', 'firstName lastName email department school')
      .sort({ createdAt: -1 });

    res.json(complaints);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get single complaint
router.get('/:id', auth, async (req, res) => {
  try {
    const complaint = await Complaint.findById(req.params.id)
      .populate('userId', 'firstName lastName email role department school')
      .populate('assignedTo', 'firstName lastName email department school');

    if (!complaint) {
      return res.status(404).json({ message: 'Complaint not found' });
    }

    // Students can only see their own complaints
    if (req.user.role === 'student' && complaint.userId._id.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Access denied' });
    }
    
    // Staff can see complaints from their school/department
    if (req.user.role === 'staff') {
      const assignedToId = complaint.assignedTo ? 
        String(complaint.assignedTo._id || complaint.assignedTo) : 
        null;
      
      // Normalize strings for comparison (trim and case-insensitive)
      const complaintSchool = (complaint.school || '').trim().toLowerCase();
      const userSchool = (req.user.school || '').trim().toLowerCase();
      const complaintDept = (complaint.department || '').trim().toLowerCase();
      const userDept = (req.user.department || '').trim().toLowerCase();
      
      // Staff can see if:
      // 1. Complaint is from their school AND
      // 2. (Complaint is from their department OR faculty has no department OR complaint is assigned to them)
      const sameSchool = complaintSchool === userSchool;
      const sameDept = userDept === '' || complaintDept === userDept;
      const isAssigned = assignedToId === String(req.user._id);
      
      const hasAccess = sameSchool && (sameDept || isAssigned);
      
      if (!hasAccess) {
        return res.status(403).json({ message: 'Access denied' });
      }
    }

    res.json(complaint);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Update complaint status (Admin/Staff)
router.put('/:id/status', auth, async (req, res) => {
  try {
    const { status, adminNotes } = req.body;

    const complaint = await Complaint.findById(req.params.id);
    if (!complaint) {
      return res.status(404).json({ message: 'Complaint not found' });
    }

    // Check permissions
    if (req.user.role === 'staff') {
      // Staff can update complaints from their school/department
      const assignedToId = complaint.assignedTo ? 
        String(complaint.assignedTo._id || complaint.assignedTo) : 
        null;
      
      // Normalize strings for comparison (trim and case-insensitive)
      const complaintSchool = (complaint.school || '').trim().toLowerCase();
      const userSchool = (req.user.school || '').trim().toLowerCase();
      const complaintDept = (complaint.department || '').trim().toLowerCase();
      const userDept = (req.user.department || '').trim().toLowerCase();
      
      // Faculty can update if:
      // 1. Complaint is from their school AND
      // 2. (Complaint is from their department OR faculty has no department OR complaint is assigned to them)
      const sameSchool = complaintSchool === userSchool;
      const sameDept = userDept === '' || complaintDept === userDept;
      const isAssigned = assignedToId === String(req.user._id);
      
      const hasAccess = sameSchool && (sameDept || isAssigned);
      
      if (!hasAccess) {
        return res.status(403).json({ message: 'Access denied. You can only update complaints from your school and department.' });
      }
    } else if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Access denied' });
    }

    complaint.status = status || complaint.status;
    if (adminNotes) complaint.adminNotes = adminNotes;

    await complaint.save();

    // Get student user for notifications
    const User = require('../models/User');
    const student = await User.findById(complaint.userId);

    // Create notification for user with detailed information
    const updateDate = new Date();
    const formattedDate = updateDate.toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
    
    let notificationMessage = '';
    let emailSubject = '';
    let emailMessage = '';
    let smsMessage = '';
    
    if (status === 'resolved' || status === 'completed') {
      notificationMessage = `Your complaint "${complaint.title}" has been resolved on ${formattedDate}. ${adminNotes ? 'Admin Note: ' + adminNotes : ''}`;
      emailSubject = `Notification: Complaint Resolved`;
      emailMessage = `
        <h2>Notification: Your Complaint Has Been Resolved</h2>
        <p>Your complaint has been successfully resolved.</p>
        <p><strong>Title:</strong> ${complaint.title}</p>
        <p><strong>Status:</strong> ${status}</p>
        <p><strong>Resolved on:</strong> ${formattedDate}</p>
        ${adminNotes ? `<p><strong>Admin Note:</strong> ${adminNotes}</p>` : ''}
        <p style="margin-top: 20px; padding: 15px; background: #f0f0f0; border-radius: 5px;">
          <strong>Note:</strong> This is a notification only. Please check your dashboard to view full details and provide feedback.
        </p>
      `;
      smsMessage = `Notification: Your complaint "${complaint.title}" has been resolved. Check your dashboard for details and to provide feedback.`;
    } else {
      notificationMessage = `Your complaint "${complaint.title}" status has been updated to ${status} on ${formattedDate}.`;
      emailSubject = `Notification: Complaint Status Updated`;
      emailMessage = `
        <h2>Notification: Complaint Status Updated</h2>
        <p>Your complaint status has been updated.</p>
        <p><strong>Title:</strong> ${complaint.title}</p>
        <p><strong>New Status:</strong> ${status}</p>
        <p><strong>Updated on:</strong> ${formattedDate}</p>
        ${adminNotes ? `<p><strong>Admin Note:</strong> ${adminNotes}</p>` : ''}
        <p style="margin-top: 20px; padding: 15px; background: #f0f0f0; border-radius: 5px;">
          <strong>Note:</strong> This is a notification only. Please check your dashboard to view full details and updates.
        </p>
      `;
      smsMessage = `Notification: Your complaint "${complaint.title}" status updated to ${status}. Check your dashboard for details.`;
    }
    
    const notification = new Notification({
      userId: complaint.userId,
      complaintId: complaint._id,
      message: notificationMessage,
      type: 'status_update'
    });
    await notification.save();

    // Send email and SMS to student
    if (student) {
      await notifyUser(student, emailSubject, emailMessage);
      if (student.phone) {
        await notifyUser(student, emailSubject, smsMessage);
      }
    }

    res.json(complaint);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Assign complaint (Admin only)
router.put('/:id/assign', adminAuth, async (req, res) => {
  try {
    const { assignedTo } = req.body;

    const complaint = await Complaint.findById(req.params.id);
    if (!complaint) {
      return res.status(404).json({ message: 'Complaint not found' });
    }

    complaint.assignedTo = assignedTo;
    await complaint.save();

    // Create notification
    const notification = new Notification({
      userId: complaint.userId,
      complaintId: complaint._id,
      message: `Your complaint "${complaint.title}" has been assigned`,
      type: 'assignment'
    });
    await notification.save();

    res.json(complaint);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Update complaint (Admin/Staff can update status)
router.put('/:id', auth, async (req, res) => {
  try {
    const { title, description, category, subcategory, priority, status, adminNotes, assignedTo } = req.body;

    const complaint = await Complaint.findById(req.params.id);
    if (!complaint) {
      return res.status(404).json({ message: 'Complaint not found' });
    }

    // Check permissions
    if (req.user.role === 'staff') {
      // Staff can update complaints from their school/department
      const assignedToId = complaint.assignedTo ? 
        String(complaint.assignedTo._id || complaint.assignedTo) : 
        null;
      
      // Normalize strings for comparison (trim and case-insensitive)
      const complaintSchool = (complaint.school || '').trim().toLowerCase();
      const userSchool = (req.user.school || '').trim().toLowerCase();
      const complaintDept = (complaint.department || '').trim().toLowerCase();
      const userDept = (req.user.department || '').trim().toLowerCase();
      
      // Faculty can update if:
      // 1. Complaint is from their school AND
      // 2. (Complaint is from their department OR faculty has no department OR complaint is assigned to them)
      const sameSchool = complaintSchool === userSchool;
      const sameDept = userDept === '' || complaintDept === userDept;
      const isAssigned = assignedToId === String(req.user._id);
      
      const hasAccess = sameSchool && (sameDept || isAssigned);
      
      if (!hasAccess) {
        return res.status(403).json({ message: 'Access denied. You can only update complaints from your school and department.' });
      }
      
      // Faculty can update status and admin notes
      if (status) complaint.status = status;
      if (adminNotes) complaint.adminNotes = adminNotes;
    } else if (req.user.role === 'admin') {
      // Admin can update everything
      if (title) complaint.title = title;
      if (description) complaint.description = description;
      if (category) complaint.category = category;
      if (subcategory !== undefined) complaint.subcategory = subcategory;
      if (priority) complaint.priority = priority;
      if (status) complaint.status = status;
      if (adminNotes) complaint.adminNotes = adminNotes;
      if (assignedTo !== undefined) complaint.assignedTo = assignedTo;
    } else {
      return res.status(403).json({ message: 'Access denied' });
    }

    await complaint.save();

    // Create notification for user when status changes
    if (status && status !== complaint.status) {
      const Notification = require('../models/Notification');
      const resolutionDate = new Date();
      const formattedDate = resolutionDate.toLocaleDateString('en-US', { 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
      
      let notificationMessage = '';
      if (status === 'resolved' || status === 'completed') {
        notificationMessage = `Your complaint "${complaint.title}" has been resolved on ${formattedDate}. ${complaint.adminNotes ? 'Admin Note: ' + complaint.adminNotes : ''}`;
      } else {
        notificationMessage = `Your complaint "${complaint.title}" status has been updated to ${status} on ${formattedDate}.`;
      }
      
      const notification = new Notification({
        userId: complaint.userId,
        complaintId: complaint._id,
        message: notificationMessage,
        type: 'status_update'
      });
      await notification.save();
    }

    res.json(complaint);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Delete complaint (Admin only)
router.delete('/:id', adminAuth, async (req, res) => {
  try {
    const complaint = await Complaint.findById(req.params.id);
    if (!complaint) {
      return res.status(404).json({ message: 'Complaint not found' });
    }

    await Complaint.findByIdAndDelete(req.params.id);
    res.json({ message: 'Complaint deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Submit feedback (Student only, for all complaint statuses)
router.post('/:id/feedback', auth, async (req, res) => {
  try {
    const { rating, comment } = req.body;
    const complaint = await Complaint.findById(req.params.id);
    
    if (!complaint) {
      return res.status(404).json({ message: 'Complaint not found' });
    }

    // Check if user owns the complaint
    if (complaint.userId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Access denied' });
    }

    // Allow feedback for all statuses - removed restriction

    // Check if feedback already exists
    if (complaint.feedback && complaint.feedback.rating) {
      return res.status(400).json({ message: 'Feedback already submitted' });
    }

    complaint.feedback = {
      rating: rating,
      comment: comment || '',
      submittedAt: new Date()
    };

    await complaint.save();

    res.json(complaint);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get statistics (Admin only)
router.get('/stats/summary', adminAuth, async (req, res) => {
  try {
    const total = await Complaint.countDocuments();
    const pending = await Complaint.countDocuments({ status: 'pending' });
    const progressed = await Complaint.countDocuments({ status: 'progressed' });
    const inProgress = await Complaint.countDocuments({ status: 'in-progress' });
    const resolved = await Complaint.countDocuments({ status: 'resolved' });
    const completed = await Complaint.countDocuments({ status: 'completed' });
    const rejected = await Complaint.countDocuments({ status: 'rejected' });

    res.json({
      total,
      pending,
      progressed,
      inProgress,
      resolved,
      completed,
      rejected
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

module.exports = router;

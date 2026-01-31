const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  firstName: {
    type: String,
    required: true,
    trim: true
  },
  lastName: {
    type: String,
    required: true,
    trim: true
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true
  },
  phone: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    match: [/^[6-9][0-9]{9}$/, 'Phone must be a valid 10-digit Indian mobile number']
  },
  password: {
    type: String,
    required: true,
    minlength: 8,
    maxlength: 13
  },
  role: {
    type: String,
    enum: ['student', 'staff', 'admin'],
    default: 'student'
  },
  department: {
    type: String,
    required: function() { return this.role === 'student' || this.role === 'staff'; },
    trim: true
  },
  school: {
    type: String,
    required: function() { return this.role !== 'admin'; },
    trim: true
  },
  studentId: {
    type: String,
    trim: true
  },
  courseYear: {
    type: String,
    trim: true
  },
  // Password reset fields
  resetPasswordToken: {
    type: String
  },
  resetPasswordExpires: {
    type: Date
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Validate password policy and hash before saving
userSchema.pre('save', async function(next) {
  if (this.isModified('password')) {
    const password = this.password || '';
    // Policy: 8-13 chars, at least 1 uppercase, 1 lowercase, 1 number, 1 special !@#$%&*
    const allowedChars = /^[A-Za-z0-9!@#$%&*]{8,13}$/;
    const hasUpper = /[A-Z]/.test(password);
    const hasLower = /[a-z]/.test(password);
    const hasNumber = /[0-9]/.test(password);
    const hasSpecial = /[!@#$%&*]/.test(password);
    if (!allowedChars.test(password) || !hasUpper || !hasLower || !hasNumber || !hasSpecial) {
      return next(new Error('Password must be 8-13 chars, include at least 1 uppercase, 1 lowercase, 1 number, and 1 special (!@#$%&*), and only contain letters, numbers, and allowed specials.'));
    }
    this.password = await bcrypt.hash(this.password, 10);
  }
  next();
});

// Compare password method
userSchema.methods.comparePassword = async function(candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

module.exports = mongoose.model('User', userSchema);

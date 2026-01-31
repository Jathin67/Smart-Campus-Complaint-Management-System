const mongoose = require('mongoose');

const complaintSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    required: true
  },
  category: {
    type: String,
    enum: ['hostel', 'classroom', 'washrooms', 'security', 'parking', 'campus', 'academics', 'canteen', 'food-court', 'transportation', 'library', 'others'],
    required: true
  },
  subcategory: {
    type: String,
    default: ''
  },
  priority: {
    type: String,
    enum: ['low', 'medium', 'high', 'urgent'],
    default: 'medium'
  },
  status: {
    type: String,
    enum: ['pending', 'progressed', 'in-progress', 'resolved', 'completed', 'rejected'],
    default: 'pending'
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  // Denormalized fields to enable efficient faculty filtering
  department: {
    type: String,
    required: true,
    trim: true
  },
  school: {
    type: String,
    required: true,
    trim: true
  },
  assignedTo: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  photos: [{
    type: String
  }],
  video: [{
    type: String
  }],
  voice: [{
    type: String
  }],
  adminNotes: {
    type: String,
    default: ''
  },
  resolutionNotes: {
    type: String,
    default: ''
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  },
  resolvedAt: {
    type: Date
  },
  feedback: {
    rating: {
      type: Number,
      min: 1,
      max: 5
    },
    comment: {
      type: String,
      trim: true
    },
    submittedAt: {
      type: Date
    }
  }
});

// Update the updatedAt field before saving
complaintSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  if (this.status === 'resolved' && !this.resolvedAt) {
    this.resolvedAt = Date.now();
  }
  next();
});

module.exports = mongoose.model('Complaint', complaintSchema);

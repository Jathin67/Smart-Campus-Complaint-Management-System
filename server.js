const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const app = express();

// Validate critical configuration
const DEFAULT_JWT_FALLBACK = 'your_super_secret_jwt_key_change_this_in_production';
if ((process.env.NODE_ENV === 'production') && (!process.env.JWT_SECRET || process.env.JWT_SECRET === DEFAULT_JWT_FALLBACK)) {
  // Fail fast in production if insecure JWT secret is used
  console.error('FATAL: JWT_SECRET is not set securely in production.');
  process.exit(1);
}
if (!process.env.JWT_SECRET || process.env.JWT_SECRET === DEFAULT_JWT_FALLBACK) {
  console.warn('Warning: Using default/weak JWT secret. Set JWT_SECRET in .env');
}

// Middleware
// CORS configuration: restrict if FRONTEND_BASE_URL provided
const allowedOrigin = process.env.FRONTEND_BASE_URL;
app.use(cors(allowedOrigin ? { origin: allowedOrigin, credentials: true } : {}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/complaints', require('./routes/complaints'));
app.use('/api/users', require('./routes/users'));

// Serve static files from frontend
app.use(express.static(path.join(__dirname, 'public')));

// MongoDB Connection
let mongoURI = process.env.MONGODB_URI || 'mongodb://localhost:27017/complaint_management';

// Properly encode password if it contains special characters like @
if (mongoURI.includes('mongodb+srv://')) {
  const protocolMatch = mongoURI.match(/^mongodb\+srv:\/\/(.+)$/);
  if (protocolMatch) {
    const afterProtocol = protocolMatch[1];
    const lastAt = afterProtocol.lastIndexOf('@');
    if (lastAt > 0) {
      const beforeAt = afterProtocol.substring(0, lastAt);
      const afterAt = afterProtocol.substring(lastAt + 1);
      const colonIndex = beforeAt.indexOf(':');
      if (colonIndex > 0) {
        const username = beforeAt.substring(0, colonIndex);
        let password = beforeAt.substring(colonIndex + 1);
        if (password.includes('@') && !password.includes('%40')) {
          password = encodeURIComponent(password);
          mongoURI = `mongodb+srv://${username}:${password}@${afterAt}`;
        }
      }
    }
  }
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

// Connect to MongoDB
mongoose.connect(mongoURI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  serverSelectionTimeoutMS: 30000,
  socketTimeoutMS: 45000,
  connectTimeoutMS: 30000,
  maxPoolSize: 10,
  retryWrites: true,
  w: 'majority'
})
.then(() => {
  console.log('MongoDB connected');
})
.catch(err => {
  console.error('MongoDB connection failed:', err.message);
  process.exit(1);
});

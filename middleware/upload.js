const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadPath = path.join(__dirname, '../uploads');
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const fileFilter = (req, file, cb) => {
  // Allow images, audio, and video files
  const allowedImageTypes = /jpeg|jpg|png|gif|webp/;
  const allowedAudioTypes = /mp3|wav|m4a|ogg|webm/;
  const allowedVideoTypes = /mp4|webm|mov|avi|mkv/;
  const extname = path.extname(file.originalname).toLowerCase();
  
  const isImage = allowedImageTypes.test(extname) || file.mimetype.startsWith('image/');
  const isAudio = allowedAudioTypes.test(extname) || file.mimetype.startsWith('audio/');
  const isVideo = allowedVideoTypes.test(extname) || file.mimetype.startsWith('video/');

  if (isImage || isAudio || isVideo) {
    return cb(null, true);
  } else {
    cb(new Error('Only image, audio, and video files are allowed!'));
  }
};

const upload = multer({
  storage: storage,
  limits: { 
    fileSize: 100 * 1024 * 1024 // 100MB limit for videos
  },
  fileFilter: fileFilter
});

module.exports = upload;

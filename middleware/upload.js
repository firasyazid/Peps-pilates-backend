const multer = require('multer');
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const cloudinary = require('../utils/cloudinary');

const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'peps-pilates',
    allowed_formats: ['jpg', 'jpeg', 'png', 'gif', 'mp4', 'webm', 'ogg'],
  },
});

const upload = multer({ storage: storage });

module.exports = upload;

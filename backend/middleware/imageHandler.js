// backend/middleware/imageHandler.js
// Images are received via multer (memory storage),
// compressed with sharp, then stored as BYTEA in PostgreSQL.
// No file system writes — images live entirely in the database.

const multer = require('multer');
const sharp  = require('sharp');

// ── multer: store in memory (not disk) ───────────────────────────────────────
const memoryStorage = multer.memoryStorage();

const imageFilter = (req, file, cb) => {
  const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'];
  if (allowed.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error(`File type not allowed: ${file.mimetype}. Use JPEG, PNG, or WebP.`), false);
  }
};

const MAX_SIZE_MB = parseInt(process.env.MAX_IMAGE_SIZE_MB || '8');
const MAX_FILES   = parseInt(process.env.MAX_IMAGES_PER_ITEM || '5');

// Single image upload (avatar)
const uploadSingle = multer({
  storage:    memoryStorage,
  fileFilter: imageFilter,
  limits: { fileSize: MAX_SIZE_MB * 1024 * 1024, files: 1 },
});

// Multiple images upload (crops, services, listings)
const uploadMultiple = multer({
  storage:    memoryStorage,
  fileFilter: imageFilter,
  limits: { fileSize: MAX_SIZE_MB * 1024 * 1024, files: MAX_FILES },
});

// ── compressImage ─────────────────────────────────────────────────────────────
// Resizes to max 800x800, converts to JPEG 80%, returns Buffer + metadata.
const compressImage = async (buffer, maxWidth = 800, maxHeight = 800) => {
  const processed = await sharp(buffer)
    .resize({
      width:  maxWidth,
      height: maxHeight,
      fit:    sharp.fit.inside,
      withoutEnlargement: true,
    })
    .jpeg({ quality: 80, progressive: true })
    .toBuffer({ resolveWithObject: true });

  return {
    data:      processed.data,             // Buffer — store this as BYTEA
    mimeType:  'image/jpeg',
    width:     processed.info.width,
    height:    processed.info.height,
    sizeBytes: processed.info.size,
  };
};

// ── processUploadedFiles middleware ───────────────────────────────────────────
// Runs after multer. Compresses every file in req.files and attaches
// processed metadata back as req.processedImages.
const processUploadedFiles = async (req, res, next) => {
  try {
    const files = req.files || (req.file ? [req.file] : []);
    if (!files.length) return next();

    req.processedImages = await Promise.all(
      files.map(async (file) => {
        const compressed = await compressImage(file.buffer);
        return {
          ...compressed,
          originalName: file.originalname,
        };
      })
    );
    next();
  } catch (err) {
    console.error('Image processing error:', err.message);
    res.status(422).json({ error: 'Image processing failed: ' + err.message });
  }
};

// ── processUploadedFile middleware (single file) ──────────────────────────────
const processUploadedFile = async (req, res, next) => {
  try {
    if (!req.file) return next();
    const compressed = await compressImage(req.file.buffer);
    req.processedImage = { ...compressed, originalName: req.file.originalname };
    next();
  } catch (err) {
    res.status(422).json({ error: 'Image processing failed: ' + err.message });
  }
};

module.exports = {
  uploadSingle,
  uploadMultiple,
  compressImage,
  processUploadedFiles,
  processUploadedFile,
};

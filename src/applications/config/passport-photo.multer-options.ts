import { UnsupportedMediaTypeException } from '@nestjs/common';
import type { MulterOptions } from '@nestjs/platform-express/multer/interfaces/multer-options.interface';
import { memoryStorage } from 'multer';

const PASSPORT_PHOTO_ACCEPT = ['image/jpeg', 'image/png'];
const PASSPORT_PHOTO_MAX_BYTES = 2 * 1024 * 1024; // 2 MB — mirrors the frontend's own limit

// Kept in memory (not written to disk) — the buffer is streamed straight to
// Cloudinary in ApplicationsService, so no local file ever exists.
export const passportPhotoMulterOptions: MulterOptions = {
  storage: memoryStorage(),
  fileFilter: (_req, file, callback) => {
    if (!PASSPORT_PHOTO_ACCEPT.includes(file.mimetype)) {
      callback(new UnsupportedMediaTypeException('Please upload a Jpeg or PNG image'), false);
      return;
    }
    callback(null, true);
  },
  limits: { fileSize: PASSPORT_PHOTO_MAX_BYTES },
};

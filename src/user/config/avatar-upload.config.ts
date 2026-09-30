import { diskStorage } from 'multer';
import { extname, join } from 'path';
import { existsSync, mkdirSync } from 'fs';
import { BadRequestException } from '@nestjs/common';

const UPLOAD_DIR = join(process.cwd(), 'uploads', 'avatars');
const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_FILE_SIZE = 2 * 1024 * 1024; // 2MB

export const avatarUploadOptions = {
  storage: diskStorage({
    destination: (_req: any, _file: any, cb: any) => {
      // Khác với documents (./uploads có sẵn từ trước), thư mục con
      // "avatars" chưa chắc đã tồn tại — tự tạo nếu chưa có
      if (!existsSync(UPLOAD_DIR)) {
        mkdirSync(UPLOAD_DIR, { recursive: true });
      }
      cb(null, UPLOAD_DIR);
    },
    filename: (_req: any, file: Express.Multer.File, cb: any) => {
      // Theo đúng convention đặt tên đã dùng ở DocumentController
      const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
      cb(null, `${uniqueSuffix}${extname(file.originalname)}`);
    },
  }),
  limits: { fileSize: MAX_FILE_SIZE },
  fileFilter: (_req: any, file: Express.Multer.File, cb: any) => {
    file.originalname = Buffer.from(file.originalname, 'latin1').toString('utf8');
    if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
      return cb(new BadRequestException('Only JPEG, PNG, or WEBP images are allowed'), false);
    }
    cb(null, true);
  },
};

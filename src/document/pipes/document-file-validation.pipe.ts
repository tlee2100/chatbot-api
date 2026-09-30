import { PipeTransform, Injectable, BadRequestException } from '@nestjs/common';
import { extname } from 'path';
import * as fs from 'fs';

@Injectable()
export class DocumentFileValidationPipe
  implements PipeTransform<Express.Multer.File, Promise<Express.Multer.File>>
{
  async transform(file: Express.Multer.File): Promise<Express.Multer.File> {
    if (!file) {
      throw new BadRequestException('File is required');
    }

    const ext = extname(file.originalname).toLowerCase();
    const isValid = await this.validateFileContent(file.path, ext);
    if (!isValid) {
      if (fs.existsSync(file.path)) {
        try {
          fs.unlinkSync(file.path);
        } catch {
          // ignore error during cleanup
        }
      }
      throw new BadRequestException(
        'File content does not match its extension or contains invalid data',
      );
    }

    return file;
  }

  private async validateFileContent(filePath: string, ext: string): Promise<boolean> {
    let fd: fs.promises.FileHandle | undefined;
    try {
      fd = await fs.promises.open(filePath, 'r');
      const buffer = Buffer.alloc(512);
      const { bytesRead } = await fd.read(buffer, 0, 512, 0);

      if (ext === '.pdf') {
        if (bytesRead < 5) return false;
        const pdfMagic = Buffer.from([0x25, 0x50, 0x44, 0x46, 0x2d]); // %PDF-
        return buffer.subarray(0, 5).equals(pdfMagic);
      }

      if (ext === '.txt') {
        for (let i = 0; i < bytesRead; i += 1) {
          if (buffer[i] === 0x00) {
            return false;
          }
        }
        return true;
      }

      return false;
    } catch {
      return false;
    } finally {
      if (fd) await fd.close();
    }
  }
}

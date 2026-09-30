import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  Request,
  UseInterceptors,
  UploadedFile,
  UseGuards,
  BadRequestException,
  Delete,
} from '@nestjs/common';
import { Paginate, ApiPaginationQuery } from 'nestjs-paginate';
import type { PaginateQuery } from 'nestjs-paginate';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { AuthGuard } from '@nestjs/passport';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiConsumes, ApiBody } from '@nestjs/swagger';
import { DocumentService } from './document.service';
import { UploadDocumentDto } from './dto/upload-document.dto';
import type { AuthenticatedRequest } from '../auth/interfaces/authenticated-request.interface';
import { DocumentFileValidationPipe } from './pipes/document-file-validation.pipe';

const ALLOWED_EXTENSIONS = ['.txt', '.pdf'];
const ALLOWED_MIME_TYPES = ['text/plain', 'application/pdf'];

@ApiTags('Document')
@Controller('documents')
export class DocumentController {
  constructor(private readonly documentService: DocumentService) {}

  @ApiOperation({ summary: 'Upload a document (.txt or .pdf) for a site' })
  @ApiBearerAuth('access-token')
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: { type: 'string', format: 'binary' },
        siteId: { type: 'number' },
      },
    },
  })
  @UseGuards(AuthGuard('jwt'))
  @UseInterceptors(
    FileInterceptor('file', {
      // Declare where the file is saved
      storage: diskStorage({
        destination: './uploads',
        filename: (req, file, callback) => {
          const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
          callback(null, `${uniqueSuffix}${extname(file.originalname)}`);
        },
      }),
      //
      fileFilter: (req, file, callback) => {
        file.originalname = Buffer.from(file.originalname, 'latin1').toString('utf8');
        const ext = extname(file.originalname).toLowerCase();
        const mimeType = file.mimetype;
        if (!ALLOWED_EXTENSIONS.includes(ext) || !ALLOWED_MIME_TYPES.includes(mimeType)) {
          callback(
            new BadRequestException('Only .txt and .pdf files with correct MIME types are allowed'),
            false,
          );
          return;
        }
        callback(null, true);
      },
      limits: { fileSize: 10 * 1024 * 1024 },
    }),
  )
  @Post('upload')
  async upload(
    @UploadedFile(DocumentFileValidationPipe) file: Express.Multer.File,
    @Body() dto: UploadDocumentDto,
    @Request() req: AuthenticatedRequest,
  ) {
    return this.documentService.uploadAndQueue(file, dto.siteId, req.user.id, req.user.role);
  }

  @ApiOperation({ summary: 'Get a single document by id' })
  @ApiBearerAuth('access-token')
  @UseGuards(AuthGuard('jwt'))
  @Get(':id')
  async findOne(@Param('id') id: number) {
    return this.documentService.findOne(id);
  }

  @ApiOperation({ summary: 'Get all documents' })
  @ApiBearerAuth('access-token')
  @ApiPaginationQuery({
    sortableColumns: ['id', 'filename', 'status', 'uploadedAt'],
    searchableColumns: ['filename'],
    defaultSortBy: [['uploadedAt', 'DESC']],
  })
  @UseGuards(AuthGuard('jwt'))
  @Get()
  async findAll(@Paginate() query: PaginateQuery, @Request() req: AuthenticatedRequest) {
    return this.documentService.findAll(query, req.user.id, req.user.role);
  }

  @ApiOperation({ summary: 'Delete a document' })
  @ApiBearerAuth('access-token')
  @UseGuards(AuthGuard('jwt'))
  @Delete(':id')
  async remove(@Param('id') id: number, @Request() req: AuthenticatedRequest) {
    await this.documentService.remove(id, req.user.id, req.user.role);
    return { success: true };
  }
}

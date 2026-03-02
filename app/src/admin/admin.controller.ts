import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Response } from 'express';
import { AdminService } from './admin.service';
import { Public } from '../decorators/public.decorator';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';

interface MulterFile {
  fieldname: string;
  originalname: string;
  encoding: string;
  mimetype: string;
  size: number;
  destination: string;
  filename: string;
  path: string;
  buffer: Buffer;
}

@Public()
@UseGuards(JwtAuthGuard)
@Controller('api/admin')
export class AdminController {
  constructor(private adminService: AdminService) {}

  @Get('media')
  async getMedia(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
    @Query('type') type?: string,
    @Query('sort') sort?: string,
    @Query('order') order?: 'ASC' | 'DESC',
  ) {
    return this.adminService.getMedia({
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
      search,
      type,
      sort,
      order,
    });
  }

  @Get('stats')
  async getStats() {
    return this.adminService.getStats();
  }

  @Get('cleanup/orphaned')
  async getOrphanedFiles() {
    return this.adminService.getOrphanedFiles();
  }

  @Post('cleanup/orphaned')
  async deleteOrphanedFiles() {
    return this.adminService.deleteOrphanedFiles();
  }

  @Get('cleanup/large')
  async getLargeFiles(@Query('threshold') threshold?: string) {
    return this.adminService.getLargeFiles(
      threshold ? parseInt(threshold, 10) : 10 * 1024 * 1024,
    );
  }

  @Get('cleanup/old')
  async getOldFiles(@Query('days') days?: string) {
    return this.adminService.getOldFiles(days ? parseInt(days, 10) : 30);
  }

  @Post('upload')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: 200 * 1024 * 1024 },
      fileFilter: (_req, file, cb) => {
        if (!file.originalname.match(/\.(jpg|jpeg|png|gif|mp4|mp3|ogg|webp|wav)$/)) {
          return cb(
            new Error('Only image, video, and audio files are allowed!'),
            false,
          );
        }
        cb(null, true);
      },
    }),
  )
  async uploadFile(@UploadedFile() file: MulterFile) {
    if (!file) {
      throw new BadRequestException('No file uploaded');
    }
    return this.adminService.createMedia(file);
  }

  @Get('stats/history')
  async getUploadHistory(@Query('days') days?: string) {
    return this.adminService.getUploadHistory(days ? parseInt(days, 10) : 30);
  }

  @Post('download')
  async batchDownload(@Body() body: { ids: string[] }, @Res() res: Response) {
    const archive = await this.adminService.createZipStream(body.ids);
    res.set({
      'Content-Type': 'application/zip',
      'Content-Disposition': 'attachment; filename="media-download.zip"',
    });
    archive.pipe(res);
  }

  @Post('sync')
  async syncFiles() {
    return this.adminService.syncFilesFromDisk();
  }

  @Get('media/:id')
  async getMediaById(@Param('id') id: string) {
    return this.adminService.getMediaById(id);
  }

  @Delete('media/:id')
  async deleteMedia(@Param('id') id: string) {
    return this.adminService.deleteMedia(id);
  }

  @Post('media/bulk-delete')
  async bulkDelete(@Body() body: { ids: string[] }) {
    return this.adminService.bulkDelete(body.ids);
  }
}

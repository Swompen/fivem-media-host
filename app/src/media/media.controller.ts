import {
  Controller,
  Get,
  Post,
  Param,
  Delete,
  UseInterceptors,
  UploadedFile,
  Res,
  BadRequestException,
  ParseUUIDPipe,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Response } from 'express';
import { MediaService } from './media.service';
import { CreateMediaDto } from './dto/create-media.dto';
import { ConfigService } from '@nestjs/config';

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

@Controller('api/media')
export class MediaController {
  constructor(
    private readonly mediaService: MediaService,
    private readonly configService: ConfigService,
  ) {}

  @Post('upload')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: {
        fileSize: 200 * 1024 * 1024, // 200MB
      },
    }),
  )
  async uploadFile(@UploadedFile() file: MulterFile) {
    if (!file) {
      throw new BadRequestException('No file uploaded');
    }

    let type = 'unknown';
    if (file.mimetype.startsWith('image/')) {
      type = 'image';
    } else if (file.mimetype.startsWith('video/')) {
      type = 'video';
    } else if (file.mimetype.startsWith('audio/')) {
      type = 'audio';
    }

    const createMediaDto: CreateMediaDto = {
      originalname: file.originalname,
      filename: file.filename,
      path: `media/${file.filename}`,
      mimetype: file.mimetype,
      size: file.size,
      type,
    };

    const media = await this.mediaService.create(createMediaDto);
    const baseUrl = this.configService.get('BASE_URL');

    return {
      message: 'File uploaded successfully',
      media: {
        ...media,
        url: `${baseUrl}/media/${file.filename}`,
        directLink: `${baseUrl}/api/media/${media.id}`,
        success: true,
      },
    };
  }

  @Get()
  async findAll() {
    const media = await this.mediaService.findAll();
    const baseUrl = this.configService.get('BASE_URL');

    return media.map((item) => ({
      ...item,
      url: `${baseUrl}/media/${item.filename}`,
      directLink: `${baseUrl}/api/media/${item.id}`,
    }));
  }

  @Get(':id')
  async findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @Res() res: Response,
  ) {
    const media = await this.mediaService.incrementViews(id);
    return res.redirect(`/media/${media.filename}`);
  }

  @Get('info/:id')
  async getInfo(@Param('id', ParseUUIDPipe) id: string) {
    const media = await this.mediaService.findOne(id);
    const baseUrl = this.configService.get('BASE_URL');

    return {
      ...media,
      url: `${baseUrl}/media/${media.filename}`,
      directLink: `${baseUrl}/api/media/${media.id}`,
    };
  }

  @Delete(':id')
  async remove(@Param('id', ParseUUIDPipe) id: string) {
    await this.mediaService.remove(id);
    return { message: 'Media deleted successfully' };
  }
}

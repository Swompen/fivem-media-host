import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MulterModule } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { v4 as uuidv4 } from 'uuid';
import { MediaEntity } from '../media/entities/media.entity';
import { AdminService } from './admin.service';
import { AdminController } from './admin.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([MediaEntity]),
    MulterModule.register({
      storage: diskStorage({
        destination: './uploads',
        filename: (_req, file, cb) => {
          const randomName = uuidv4();
          cb(null, `${randomName}${extname(file.originalname)}`);
        },
      }),
      fileFilter: (_req, file, cb) => {
        if (
          !file.originalname.match(
            /\.(jpg|jpeg|png|gif|mp4|mp3|ogg|webp|wav)$/i,
          )
        ) {
          return cb(
            new Error('Only image, video, and audio files are allowed!'),
            false,
          );
        }
        cb(null, true);
      },
      limits: {
        fileSize: 200 * 1024 * 1024,
      },
    }),
  ],
  controllers: [AdminController],
  providers: [AdminService],
})
export class AdminModule {}

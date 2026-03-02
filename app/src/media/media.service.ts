import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreateMediaDto } from './dto/create-media.dto';
import { MediaEntity } from './entities/media.entity';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class MediaService {
  constructor(
    @InjectRepository(MediaEntity)
    private mediaRepository: Repository<MediaEntity>,
  ) {}

  async create(createMediaDto: CreateMediaDto): Promise<MediaEntity> {
    const media = this.mediaRepository.create(createMediaDto);
    return this.mediaRepository.save(media);
  }

  async findAll(): Promise<MediaEntity[]> {
    return this.mediaRepository.find();
  }

  async findOne(id: string): Promise<MediaEntity> {
    const media = await this.mediaRepository.findOne({ where: { id } });
    if (!media) {
      throw new NotFoundException(`Media with ID "${id}" not found`);
    }
    return media;
  }

  async incrementViews(id: string): Promise<MediaEntity> {
    const media = await this.findOne(id);
    media.views += 1;
    return this.mediaRepository.save(media);
  }

  async remove(id: string): Promise<void> {
    const media = await this.findOne(id);

    // Lösche die Datei vom Dateisystem
    const filePath = path.join(process.cwd(), 'uploads', media.filename);
    try {
      fs.unlinkSync(filePath);
    } catch (error) {
      console.error(`Failed to delete file: ${filePath}`, error);
    }

    await this.mediaRepository.remove(media);
  }
}

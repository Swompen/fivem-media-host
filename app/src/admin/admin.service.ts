import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, LessThan, MoreThan, Repository } from 'typeorm';
import { MediaEntity } from '../media/entities/media.entity';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs';
import * as path from 'path';
import * as mime from 'mime-types';
import * as archiver from 'archiver';

@Injectable()
export class AdminService {
  private uploadsDir = path.join(process.cwd(), 'uploads');

  constructor(
    @InjectRepository(MediaEntity)
    private mediaRepository: Repository<MediaEntity>,
    private configService: ConfigService,
  ) {}

  async getMedia(query: {
    page?: number;
    limit?: number;
    search?: string;
    type?: string;
    sort?: string;
    order?: 'ASC' | 'DESC';
  }) {
    const page = query.page || 1;
    const limit = Math.min(query.limit || 20, 100);
    const sort = query.sort || 'createdAt';
    const order = query.order || 'DESC';

    const qb = this.mediaRepository.createQueryBuilder('media');

    if (query.search) {
      qb.where('media.originalname LIKE :search', {
        search: `%${query.search}%`,
      });
    }

    if (query.type) {
      qb.andWhere('media.type = :type', { type: query.type });
    }

    qb.orderBy(`media.${sort}`, order);
    qb.skip((page - 1) * limit);
    qb.take(limit);

    const [items, total] = await qb.getManyAndCount();
    const baseUrl = this.configService.get('BASE_URL', 'http://localhost:3000');

    return {
      items: items.map((item) => ({
        ...item,
        url: `${baseUrl}/api/media/${item.id}`,
        directLink: `${baseUrl}/media/${item.filename}`,
      })),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async getMediaById(id: string) {
    const media = await this.mediaRepository.findOne({ where: { id } });
    if (!media) {
      throw new NotFoundException('Media not found');
    }
    const baseUrl = this.configService.get('BASE_URL', 'http://localhost:3000');
    return {
      ...media,
      url: `${baseUrl}/api/media/${media.id}`,
      directLink: `${baseUrl}/media/${media.filename}`,
    };
  }

  async deleteMedia(id: string) {
    const media = await this.mediaRepository.findOne({ where: { id } });
    if (!media) {
      throw new NotFoundException('Media not found');
    }

    const filePath = path.join(this.uploadsDir, media.filename);
    try {
      fs.unlinkSync(filePath);
    } catch (err) {
      // File may already be missing
    }

    await this.mediaRepository.remove(media);
    return { message: 'Media deleted successfully' };
  }

  async bulkDelete(ids: string[]) {
    const media = await this.mediaRepository.find({ where: { id: In(ids) } });

    for (const item of media) {
      const filePath = path.join(this.uploadsDir, item.filename);
      try {
        fs.unlinkSync(filePath);
      } catch (err) {
        // File may already be missing
      }
    }

    await this.mediaRepository.remove(media);
    return { message: `Deleted ${media.length} files`, count: media.length };
  }

  async getStats() {
    const totalFiles = await this.mediaRepository.count();

    const sizeResult = await this.mediaRepository
      .createQueryBuilder('media')
      .select('SUM(media.size)', 'totalSize')
      .getRawOne();

    const typeBreakdown = await this.mediaRepository
      .createQueryBuilder('media')
      .select('media.type', 'type')
      .addSelect('COUNT(*)', 'count')
      .addSelect('SUM(media.size)', 'size')
      .groupBy('media.type')
      .getRawMany();

    return {
      totalFiles,
      totalSize: parseInt(sizeResult?.totalSize || '0', 10),
      typeBreakdown: typeBreakdown.map((t) => ({
        type: t.type,
        count: parseInt(t.count, 10),
        size: parseInt(t.size || '0', 10),
      })),
    };
  }

  async getOrphanedFiles() {
    const allDbFiles = await this.mediaRepository.find({
      select: ['filename'],
    });
    const dbFilenames = new Set(allDbFiles.map((m) => m.filename));

    let diskFiles: string[] = [];
    try {
      diskFiles = fs.readdirSync(this.uploadsDir);
    } catch (err) {
      return [];
    }

    return diskFiles
      .filter((f) => !dbFilenames.has(f))
      .map((filename) => {
        const filePath = path.join(this.uploadsDir, filename);
        try {
          const stat = fs.statSync(filePath);
          return {
            filename,
            size: stat.size,
            modifiedAt: stat.mtime,
          };
        } catch {
          return { filename, size: 0, modifiedAt: null };
        }
      });
  }

  async deleteOrphanedFiles() {
    const orphaned = await this.getOrphanedFiles();
    let deleted = 0;

    for (const file of orphaned) {
      try {
        fs.unlinkSync(path.join(this.uploadsDir, file.filename));
        deleted++;
      } catch (err) {
        // skip files that can't be deleted
      }
    }

    return { message: `Deleted ${deleted} orphaned files`, count: deleted };
  }

  async syncFilesFromDisk() {
    const allDbFiles = await this.mediaRepository.find({
      select: ['filename'],
    });
    const dbFilenames = new Set(allDbFiles.map((m) => m.filename));

    let diskFiles: string[] = [];
    try {
      diskFiles = fs.readdirSync(this.uploadsDir);
    } catch {
      return { message: 'Uploads directory not found', count: 0 };
    }

    const newFiles = diskFiles.filter((f) => !dbFilenames.has(f));
    let imported = 0;

    for (const filename of newFiles) {
      const filePath = path.join(this.uploadsDir, filename);
      try {
        const stat = fs.statSync(filePath);
        if (!stat.isFile()) continue;

        const mimetype =
          mime.lookup(filename) || 'application/octet-stream';
        let type = 'image';
        if (mimetype.startsWith('video/')) type = 'video';
        else if (mimetype.startsWith('audio/')) type = 'audio';

        const media = this.mediaRepository.create({
          originalname: filename,
          filename,
          path: `uploads/${filename}`,
          mimetype,
          size: stat.size,
          type,
          views: 0,
        });
        await this.mediaRepository.save(media);
        imported++;
      } catch {
        // skip files that can't be read
      }
    }

    return {
      message: `Imported ${imported} files from disk`,
      count: imported,
    };
  }

  async createMedia(file: {
    originalname: string;
    filename: string;
    mimetype: string;
    size: number;
  }) {
    let type = 'unknown';
    if (file.mimetype.startsWith('image/')) type = 'image';
    else if (file.mimetype.startsWith('video/')) type = 'video';
    else if (file.mimetype.startsWith('audio/')) type = 'audio';

    const media = this.mediaRepository.create({
      originalname: file.originalname,
      filename: file.filename,
      path: `media/${file.filename}`,
      mimetype: file.mimetype,
      size: file.size,
      type,
      views: 0,
    });

    const saved = await this.mediaRepository.save(media);
    const baseUrl = this.configService.get('BASE_URL', 'http://localhost:3000');

    return {
      ...saved,
      url: `${baseUrl}/api/media/${saved.id}`,
      directLink: `${baseUrl}/media/${saved.filename}`,
    };
  }

  async getUploadHistory(days: number) {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);

    const results = await this.mediaRepository
      .createQueryBuilder('media')
      .select("DATE(media.createdAt)", 'date')
      .addSelect('COUNT(*)', 'count')
      .addSelect('SUM(media.size)', 'size')
      .where('media.createdAt >= :cutoff', { cutoff })
      .groupBy('date')
      .orderBy('date', 'ASC')
      .getRawMany();

    // Fill in missing days with zeros
    const dataMap = new Map<string, { count: number; size: number }>();
    for (const row of results) {
      dataMap.set(row.date, {
        count: parseInt(row.count, 10),
        size: parseInt(row.size || '0', 10),
      });
    }

    const history: { date: string; count: number; size: number }[] = [];
    const current = new Date(cutoff);
    const today = new Date();
    while (current <= today) {
      const dateStr = current.toISOString().split('T')[0];
      const entry = dataMap.get(dateStr);
      history.push({
        date: dateStr,
        count: entry?.count || 0,
        size: entry?.size || 0,
      });
      current.setDate(current.getDate() + 1);
    }

    return history;
  }

  async createZipStream(ids: string[]) {
    const media = await this.mediaRepository.find({
      where: { id: In(ids) },
    });

    const archive = archiver('zip', { zlib: { level: 5 } });

    for (const item of media) {
      const filePath = path.join(this.uploadsDir, item.filename);
      if (fs.existsSync(filePath)) {
        archive.file(filePath, { name: item.originalname });
      }
    }

    archive.finalize();
    return archive;
  }

  async getLargeFiles(threshold: number) {
    const media = await this.mediaRepository.find({
      where: { size: MoreThan(threshold) },
      order: { size: 'DESC' },
    });

    const baseUrl = this.configService.get('BASE_URL', 'http://localhost:3000');
    return media.map((item) => ({
      ...item,
      url: `${baseUrl}/api/media/${item.id}`,
      directLink: `${baseUrl}/media/${item.filename}`,
    }));
  }

  async getOldFiles(days: number) {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);

    const media = await this.mediaRepository.find({
      where: { createdAt: LessThan(cutoff) },
      order: { createdAt: 'ASC' },
    });

    const baseUrl = this.configService.get('BASE_URL', 'http://localhost:3000');
    return media.map((item) => ({
      ...item,
      url: `${baseUrl}/api/media/${item.id}`,
      directLink: `${baseUrl}/media/${item.filename}`,
    }));
  }
}

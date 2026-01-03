import { Injectable, BadRequestException, NotFoundException, ForbiddenException, InternalServerErrorException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { File } from 'src/database/file.entity';
import sharp from 'sharp';
import * as path from 'path';
import { SharingService } from 'src/sharing/providers/sharing.service';
import { S3StorageService } from 'src/common/s3-storage.service';
import { Readable } from 'stream';

@Injectable()
export class PreviewService {
  private readonly THUMBNAIL_SIZE = 300;
  private readonly SUPPORTED_IMAGE_TYPES = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp', '.tiff'];

  constructor(
    @InjectRepository(File)
    private readonly fileRepository: Repository<File>,
    private readonly sharingService: SharingService,
    private readonly s3StorageService: S3StorageService,
  ) {}

  async getThumbnail(userId: string, fileId: string): Promise<{ buffer: Buffer; contentType: string }> {
    // Verify file access
    const file = await this.fileRepository.findOne({
      where: { id: fileId },
      relations: ['user'],
    });

    if (!file) throw new NotFoundException('File not found');

    // Check permissions
    if (file.user.id !== userId) {
      const ok = await this.sharingService.hasPermission(userId, 'file', file.id, 'view');
      if (!ok) throw new ForbiddenException('You do not have permission to view this file');
    }

    // Check if file type is supported
    const ext = path.extname(file.name).toLowerCase();
    if (!this.SUPPORTED_IMAGE_TYPES.includes(ext)) {
      throw new BadRequestException('File type not supported for thumbnail generation');
    }

    if (!file.storagePath) {
      throw new NotFoundException('File data not found');
    }

    // Check if thumbnail already exists in S3
    const thumbnailKey = this.s3StorageService.generateThumbnailKey(fileId);
    
    if (await this.s3StorageService.fileExists(thumbnailKey)) {
      const buffer = await this.s3StorageService.getFileBuffer(thumbnailKey);
      return { buffer, contentType: 'image/webp' };
    }

    // Generate thumbnail
    try {
      // Download original file from S3
      const fileBuffer = await this.s3StorageService.getFileBuffer(file.storagePath);
      
      const buffer = await sharp(fileBuffer)
        .resize(this.THUMBNAIL_SIZE, this.THUMBNAIL_SIZE, {
          fit: 'inside',
          withoutEnlargement: true,
        })
        .webp({ quality: 80 })
        .toBuffer();

      // Cache the thumbnail in S3
      await this.s3StorageService.uploadFile(thumbnailKey, buffer, 'image/webp');

      return { buffer, contentType: 'image/webp' };
    } catch (error) {
      throw new InternalServerErrorException(`Failed to generate thumbnail: ${error.message}`);
    }
  }

  async getPreview(userId: string, fileId: string): Promise<{ stream: Readable; contentType: string; size?: number }> {
    // Verify file access
    const file = await this.fileRepository.findOne({
      where: { id: fileId },
      relations: ['user'],
    });

    if (!file) throw new NotFoundException('File not found');

    // Check permissions
    if (file.user.id !== userId) {
      const ok = await this.sharingService.hasPermission(userId, 'file', file.id, 'view');
      if (!ok) throw new ForbiddenException('You do not have permission to view this file');
    }

    if (!file.storagePath) {
      throw new NotFoundException('File data not found');
    }

    // Determine content type based on extension
    const ext = path.extname(file.name).toLowerCase();
    const contentType = this.getContentType(ext);

    // Download from S3
    const { stream, contentLength } = await this.s3StorageService.downloadFile(file.storagePath);
    
    return { stream, contentType, size: contentLength || Number(file.size) || undefined };
  }

  isImageFile(filename: string): boolean {
    const ext = path.extname(filename).toLowerCase();
    return this.SUPPORTED_IMAGE_TYPES.includes(ext);
  }

  isTextFile(filename: string): boolean {
    const ext = path.extname(filename).toLowerCase();
    const textExtensions = ['.txt', '.md', '.json', '.xml', '.csv', '.log', '.js', '.ts', '.jsx', '.tsx', '.css', '.scss', '.html', '.yml', '.yaml'];
    return textExtensions.includes(ext);
  }

  isPdfFile(filename: string): boolean {
    return path.extname(filename).toLowerCase() === '.pdf';
  }

  isVideoFile(filename: string): boolean {
    const ext = path.extname(filename).toLowerCase();
    const videoExtensions = ['.mp4', '.webm', '.ogg', '.mov', '.avi', '.mkv'];
    return videoExtensions.includes(ext);
  }

  isAudioFile(filename: string): boolean {
    const ext = path.extname(filename).toLowerCase();
    const audioExtensions = ['.mp3', '.wav', '.ogg', '.m4a', '.flac'];
    return audioExtensions.includes(ext);
  }

  private getContentType(ext: string): string {
    const mimeTypes: { [key: string]: string } = {
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.gif': 'image/gif',
      '.webp': 'image/webp',
      '.bmp': 'image/bmp',
      '.tiff': 'image/tiff',
      '.pdf': 'application/pdf',
      '.txt': 'text/plain',
      '.md': 'text/markdown',
      '.json': 'application/json',
      '.xml': 'application/xml',
      '.csv': 'text/csv',
      '.mp4': 'video/mp4',
      '.webm': 'video/webm',
      '.ogg': 'video/ogg',
      '.mp3': 'audio/mpeg',
      '.wav': 'audio/wav',
      '.m4a': 'audio/mp4',
    };

    return mimeTypes[ext] || 'application/octet-stream';
  }

  async getFileMetadata(userId: string, fileId: string): Promise<any> {
    const file = await this.fileRepository.findOne({
      where: { id: fileId },
      relations: ['user'],
    });

    if (!file) throw new NotFoundException('File not found');

    // Check permissions
    if (file.user.id !== userId) {
      const ok = await this.sharingService.hasPermission(userId, 'file', file.id, 'view');
      if (!ok) throw new ForbiddenException('You do not have permission to view this file');
    }

    const metadata: any = {
      id: file.id,
      name: file.name,
      size: file.size,
      createdAt: file.createdAt,
      updatedAt: file.updatedAt,
      isImage: this.isImageFile(file.name),
      isText: this.isTextFile(file.name),
      isPdf: this.isPdfFile(file.name),
      isVideo: this.isVideoFile(file.name),
      isAudio: this.isAudioFile(file.name),
    };

    // Get image dimensions if it's an image
    if (metadata.isImage && file.storagePath) {
      try {
        const fileBuffer = await this.s3StorageService.getFileBuffer(file.storagePath);
        const imageMetadata = await sharp(fileBuffer).metadata();
        metadata.width = imageMetadata.width;
        metadata.height = imageMetadata.height;
        metadata.format = imageMetadata.format;
      } catch (error) {
        // Ignore metadata extraction errors
      }
    }

    return metadata;
  }
}

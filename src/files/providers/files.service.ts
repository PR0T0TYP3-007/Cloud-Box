import { Injectable, BadRequestException, NotFoundException, ConflictException, InternalServerErrorException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { File } from 'src/database/file.entity';
import { Folder } from 'src/database/folder.entity';
import { FileVersion } from 'src/database/file-version.entity';
import * as crypto from 'crypto';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { FolderService } from 'src/folders/providers/folders.service';
import { Logger, ForbiddenException } from '@nestjs/common';
import { SharingService } from 'src/sharing/providers/sharing.service';
import { Users } from 'src/database/user.entity';
import { DEFAULT_STORAGE_QUOTA_BYTES } from 'src/common/storage.constants';
import { S3StorageService } from 'src/common/s3-storage.service';
import { Readable } from 'stream';

@Injectable()
export class FilesService {
  private readonly logger = new Logger('FilesService');

  constructor(
    @InjectRepository(File)
    private readonly fileRepository: Repository<File>,

    @InjectRepository(Folder)
    private readonly folderRepository: Repository<Folder>,

    @InjectRepository(FileVersion)
    private readonly versionRepository: Repository<FileVersion>,

    @InjectRepository(Users)
    private readonly userRepository: Repository<Users>,

    private readonly folderService: FolderService,

    private readonly sharingService: SharingService,

    private readonly s3StorageService: S3StorageService,
  ) {}

  private async getUserQuota(userId: string): Promise<number> {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    return user?.storageQuota ? Number(user.storageQuota) : DEFAULT_STORAGE_QUOTA_BYTES;
  }

  private async assertWithinQuota(userId: string, incomingBytes: number, currentFileSize = 0): Promise<void> {
    const quota = await this.getUserQuota(userId);
    const used = await this.getUserUsedStorage(userId);
    const projected = used - currentFileSize + incomingBytes;
    if (projected > quota) {
      throw new ForbiddenException('Storage quota exceeded. Each account is limited to 5 GB.');
    }
  }

  /**
   * Accepts the raw multer files and the JSON paths string and performs validation
   * and delegates to uploadFilesWithPaths. Keeps controller thin.
   */
  async uploadFilesMultipart(userId: string, files: any[], pathsJson: string, baseFolderId?: string) {
    if (!userId) throw new BadRequestException('Missing user id');
    const paths: string[] = [];
    try {
      const parsed = JSON.parse(pathsJson || '[]');
      if (!Array.isArray(parsed)) throw new Error('paths must be an array');
      for (const p of parsed) {
        if (typeof p !== 'string') throw new Error('paths must be array of strings');
        paths.push(p);
      }
    } catch (err) {
      throw new BadRequestException('Invalid paths JSON');
    }

    if (!Array.isArray(files) || files.length === 0) throw new BadRequestException('No files provided');
    if (paths.length !== files.length) throw new BadRequestException('paths must match files length');

    const input = files.map((f, idx) => ({ relativePath: paths[idx], buffer: f.buffer }));
    this.logger.debug(`Starting multipart upload of ${input.length} files for user ${userId}`);
    return this.uploadFilesWithPaths(userId, input, baseFolderId);
  }

  /**
   * Return a readable stream and metadata for a file validated for the user.
   */
  async getFileStream(userId: string, fileId: string): Promise<{ stream: Readable; name: string; size?: number; fileId: string }> {
    const file = await this.getFileForDownload(userId, fileId);
    if (!file.storagePath) throw new NotFoundException('File data not found');
    
    // Download from S3
    const { stream, contentLength } = await this.s3StorageService.downloadFile(file.storagePath);
    
    return { stream, name: file.name, size: contentLength || Number(file.size), fileId: file.id };
  }
  async createFile(userId: string, folderId: string | null, data: { name: string; size: string }): Promise<File> {
    if (!userId) throw new BadRequestException('Missing user id');
    if (!data || !data.name) throw new BadRequestException('File name is required');

    try {
      const { IsNull } = await import('typeorm');

      // Validate folder when provided
      let folder: Folder | null = null;
      if (folderId) {
        folder = await this.folderRepository.findOne({ where: { id: folderId }, relations: ['user'] });
        if (!folder) throw new NotFoundException('Folder not found');
        if (folder.user.id !== userId) throw new BadRequestException('Cannot create file in a folder you do not own');

        // check duplicate in folder
        const existing = await this.fileRepository.findOne({ where: { folder: { id: folderId }, name: data.name } });
        if (existing) throw new ConflictException('A file with that name already exists in this folder');
      } else {
        // check duplicate at root for user
        const existingRoot = await this.fileRepository.findOne({ where: { user: { id: userId }, folder: IsNull(), name: data.name } });
        if (existingRoot) throw new ConflictException('A file with that name already exists at root');
      }

      const incomingSize = Number(data.size) || 0;
      await this.assertWithinQuota(userId, incomingSize);

      const toCreate: Partial<File> = {
        name: data.name,
        size: data.size,
        folder: folder ?? null,
        user: { id: userId } as any,
      };

      const file = this.fileRepository.create(toCreate as File);
      return await this.fileRepository.save(file);
    } catch (err) {
      if (err instanceof BadRequestException || err instanceof NotFoundException || err instanceof ConflictException) throw err;
      console.error('Error creating file:', err);
      throw new InternalServerErrorException('Failed to create file');
    }
  }

  async uploadFile(userId: string, folderId: string | null, uploadFile: { originalname: string; buffer: Buffer }): Promise<{ file: File; version: FileVersion }> {
    if (!userId) throw new BadRequestException('Missing user id');
    if (!uploadFile || !uploadFile.originalname) throw new BadRequestException('No file uploaded');

    try {
      // Validate folder if provided
      let folder: Folder | null = null;
      if (folderId) {
        folder = await this.folderRepository.findOne({ where: { id: folderId }, relations: ['user'] });
        if (!folder) throw new NotFoundException('Folder not found');
        if (folder.user.id !== userId) {
          const ok = await this.sharingService.hasPermission(userId, 'folder', folder.id, 'edit');
          if (!ok) throw new ForbiddenException('Cannot upload file to a folder you do not own');
        }
      }
      // Note: We allow duplicate file names - they will create new versions

      const incomingSize = uploadFile.buffer?.length ?? 0;
      await this.assertWithinQuota(userId, incomingSize);

      // prepare storage - generate S3 key
      const fileId = uuidv4();
      const ext = path.extname(uploadFile.originalname);
      const s3Key = this.s3StorageService.generateS3Key(userId, fileId, ext);

      // Upload to S3
      await this.s3StorageService.uploadFile(s3Key, uploadFile.buffer);

      // compute checksum and size
      const checksum = crypto.createHash('sha256').update(uploadFile.buffer).digest('hex');
      const size = uploadFile.buffer.length.toString();

      // create or update File entity
      const { IsNull } = await import('typeorm');
      const whereCondition: any = {
        user: { id: userId },
        name: uploadFile.originalname,
      };
      if (folder) {
        whereCondition.folder = { id: folder.id };
      } else {
        whereCondition.folder = IsNull();
      }
      let file = await this.fileRepository.findOne({ where: whereCondition });

      if (!file) {
        file = this.fileRepository.create({ name: uploadFile.originalname, size, folder: folder ?? null, user: { id: userId } as any, storagePath: s3Key });
        file = await this.fileRepository.save(file);
      } else {
        // increment version and update size/storagePath
        file.currentVersion = (file.currentVersion ?? 1) + 1;
        file.size = size;
        file.storagePath = s3Key;
        file = await this.fileRepository.save(file);
      }

      // create file version
      const versionNumber = file.currentVersion ?? 1;
      const version = this.versionRepository.create({ file: file as any, version: versionNumber, storageKey: s3Key, checksum, size });
      const savedVersion = await this.versionRepository.save(version);

      // ensure file.currentVersion matches saved version
      file.currentVersion = savedVersion.version;
      await this.fileRepository.save(file);

      return { file, version: savedVersion };
    } catch (err) {
      if (err instanceof BadRequestException || err instanceof NotFoundException || err instanceof ForbiddenException) throw err;
      console.error('Error uploading file:', err);
      throw new InternalServerErrorException('Failed to upload file');
    }
  }

  /**
   * Upload multiple files where each file has a relativePath like "a/b/c.txt".
   * This will ensure parent folders exist (creating them if needed) and call
   * uploadFile for each file.
   * @param baseFolderId - Optional base folder ID to create structure under (if not provided, uses root)
   */
  async uploadFilesWithPaths(userId: string, filesWithPaths: { relativePath: string; buffer: Buffer }[], baseFolderId?: string): Promise<{ successes: any[]; errors: { path: string; error: string }[] }> {
    if (!userId) throw new BadRequestException('Missing user id');
    if (!Array.isArray(filesWithPaths) || filesWithPaths.length === 0) throw new BadRequestException('No files provided');

    const successes: any[] = [];
    const errors: { path: string; error: string }[] = [];

    // Get the base folder (either provided or root)
    let baseFolder: Folder;
    if (baseFolderId) {
      const folder = await this.folderRepository.findOne({ where: { id: baseFolderId, isDeleted: false } as any, relations: ['user'] });
      if (!folder) throw new NotFoundException('Base folder not found');
      if (folder.user.id !== userId) throw new ForbiddenException('Cannot upload to a folder you do not own');
      baseFolder = folder;
    } else {
      baseFolder = await this.folderService.createRootFolder(userId);
    }

    for (const entry of filesWithPaths) {
      try {
        const cleaned = entry.relativePath.replace(/\\/g, '/');
        const dirname = path.posix.dirname(cleaned);
        const filename = path.posix.basename(cleaned);

        // ensure path, dirname may be '.' for root
        let parentFolder: Folder;
        if (dirname && dirname !== '.' && dirname !== '') {
          // Create folder structure under the base folder
          parentFolder = await this.folderService.ensurePath(userId, dirname, baseFolder.id);
        } else {
          parentFolder = baseFolder;
        }

        const result = await this.uploadFile(userId, parentFolder.id, { originalname: filename, buffer: entry.buffer });
        successes.push({ path: entry.relativePath, fileId: result.file.id, versionId: result.version.id });
      } catch (err) {
        console.error('uploadFilesWithPaths error for', entry.relativePath, err);
        errors.push({ path: entry.relativePath, error: err?.message ?? 'unknown error' });
      }
    }

    return { successes, errors };
  }

  // Get file entity for download; validates ownership
  async getFileForDownload(userId: string, fileId: string): Promise<File> {
    if (!userId) throw new BadRequestException('Missing user id');
    if (!fileId) throw new BadRequestException('Missing file id');

    const file = await this.fileRepository.findOne({ where: { id: fileId, isDeleted: false } as any, relations: ['user', 'folder'] });
    if (!file) throw new NotFoundException('File not found');
    if (file.user.id !== userId) {
      const ok = await this.sharingService.hasPermission(userId, 'file', file.id, 'view');
      if (!ok) throw new ForbiddenException('File does not belong to the authenticated user');
    }
    return file;
  }

  async renameFile(userId: string, fileId: string, newName: string): Promise<File> {
    if (!userId) throw new BadRequestException('Missing user id');
    if (!fileId || !newName) throw new BadRequestException('Missing params');

    const file = await this.fileRepository.findOne({ where: { id: fileId }, relations: ['user', 'folder'] });
    if (!file) throw new NotFoundException('File not found');
    if (file.user.id !== userId) {
      const ok = await this.sharingService.hasPermission(userId, 'file', file.id, 'edit');
      if (!ok) throw new ForbiddenException('File does not belong to the authenticated user');
    }

    // Check duplicate in target folder
    const { IsNull } = await import('typeorm');
    const where: any = { name: newName, user: { id: userId } };
    if (file.folder) where.folder = { id: file.folder.id };
    else where.folder = IsNull();

    const existing = await this.fileRepository.findOne({ where });
    if (existing && existing.id !== file.id) throw new ConflictException('A file with that name already exists in the target location');

    file.name = newName;
    return await this.fileRepository.save(file);
  }

  async deleteFile(userId: string, fileId: string): Promise<void> {
    if (!userId) throw new BadRequestException('Missing user id');
    if (!fileId) throw new BadRequestException('Missing file id');

    const file = await this.fileRepository.findOne({ where: { id: fileId }, relations: ['user'] });
    if (!file) throw new NotFoundException('File not found');
    if (file.user.id !== userId) {
      const ok = await this.sharingService.hasPermission(userId, 'file', file.id, 'edit');
      if (!ok) throw new ForbiddenException('File does not belong to the authenticated user');
    }
    // Soft-delete: mark file as deleted so it appears in trash
    file.isDeleted = true;
    try {
      await this.fileRepository.save(file);
    } catch (err) {
      console.error('Failed to soft-delete file record', err);
      throw new InternalServerErrorException('Failed to delete file');
    }
  }

  async restoreFile(userId: string, fileId: string): Promise<File> {
    if (!userId) throw new BadRequestException('Missing user id');
    if (!fileId) throw new BadRequestException('Missing file id');

    const file = await this.fileRepository.findOne({ where: { id: fileId }, relations: ['user'] });
    if (!file) throw new NotFoundException('File not found');
    if (file.user.id !== userId) {
      const ok = await this.sharingService.hasPermission(userId, 'file', file.id, 'edit');
      if (!ok) throw new ForbiddenException('File does not belong to the authenticated user');
    }

    const incomingSize = Number(file.size) || 0;
    await this.assertWithinQuota(userId, incomingSize);

    file.isDeleted = false;
    try {
      return await this.fileRepository.save(file);
    } catch (err) {
      console.error('Failed to restore file', err);
      throw new InternalServerErrorException('Failed to restore file');
    }
  }

  async permanentlyDeleteFile(userId: string, fileId: string): Promise<void> {
    if (!userId) throw new BadRequestException('Missing user id');
    if (!fileId) throw new BadRequestException('Missing file id');

    const file = await this.fileRepository.findOne({ where: { id: fileId }, relations: ['user', 'versions'] });
    if (!file) throw new NotFoundException('File not found');
    if (file.user.id !== userId) {
      throw new ForbiddenException('File does not belong to the authenticated user');
    }

    // Delete all versions from storage
    if (file.versions && file.versions.length > 0) {
      for (const version of file.versions) {
        await this.storageAdapter.deleteFile(version.storageKey);
      }
    }

    // Delete from database
    await this.fileRepository.remove(file);
  }

  async getUserUsedStorage(userId: string): Promise<number> {
    if (!userId) throw new BadRequestException('Missing user id');
    try {
      const qb = this.fileRepository.createQueryBuilder('file')
        .select('SUM(CAST(file.size AS bigint))', 'sum')
        .where('file.userId = :userId', { userId })
        .andWhere('file.isDeleted = false');

      const raw = await qb.getRawOne();
      const sum = raw?.sum ?? null;
      return sum ? Number(sum) : 0;
    } catch (err) {
      console.error('Failed to compute user used storage', err);
      throw new InternalServerErrorException('Failed to compute storage usage');
    }
  }

  async moveFile(userId: string, fileId: string, targetFolderId: string | null): Promise<File> {
    if (!userId) throw new BadRequestException('Missing user id');
    if (!fileId) throw new BadRequestException('Missing file id');

    const file = await this.fileRepository.findOne({ where: { id: fileId }, relations: ['user', 'folder'] });
    if (!file) throw new NotFoundException('File not found');
    if (file.user.id !== userId) {
      const ok = await this.sharingService.hasPermission(userId, 'file', file.id, 'edit');
      if (!ok) throw new ForbiddenException('File does not belong to the authenticated user');
    }

    let targetFolder: Folder | null = null;
    if (targetFolderId) {
      targetFolder = await this.folderRepository.findOne({ where: { id: targetFolderId }, relations: ['user'] });
      if (!targetFolder) throw new NotFoundException('Target folder not found');
      if (targetFolder.user.id !== userId) {
        const ok = await this.sharingService.hasPermission(userId, 'folder', targetFolder.id, 'edit');
        if (!ok) throw new ForbiddenException('Cannot move file to a folder you do not own');
      }
    }

    // Check duplicate in target location
    const { IsNull } = await import('typeorm');
    const where: any = { name: file.name, user: { id: userId } };
    if (targetFolder) where.folder = { id: targetFolder.id };
    else where.folder = IsNull();

    const existing = await this.fileRepository.findOne({ where });
    if (existing && existing.id !== file.id) throw new ConflictException('A file with that name already exists in the target location');

    file.folder = targetFolder ?? null;
    return await this.fileRepository.save(file);
  }

  /**
   * Clean up all S3 files and thumbnails for a user before account deletion
   * This prevents orphaned files in S3 bucket
   */
  async cleanupUserS3Files(userId: string): Promise<{ deletedFiles: number; deletedThumbnails: number; errors: string[] }> {
    if (!userId) throw new BadRequestException('Missing user id');

    const deletedFiles = 0;
    const deletedThumbnails = 0;
    const errors: string[] = [];

    try {
      this.logger.log(`Starting S3 cleanup for user ${userId}`);

      // Get all files for the user (including soft-deleted ones)
      const files = await this.fileRepository.find({ 
        where: { user: { id: userId } }, 
        select: ['id', 'storagePath', 'name'] 
      });

      this.logger.log(`Found ${files.length} files to clean up`);

      // Delete each file from S3
      for (const file of files) {
        if (file.storagePath) {
          try {
            await this.s3StorageService.deleteFile(file.storagePath);
            this.logger.debug(`Deleted S3 file: ${file.storagePath}`);
          } catch (error) {
            this.logger.error(`Failed to delete S3 file ${file.storagePath}:`, error.message);
            errors.push(`Failed to delete file ${file.name}: ${error.message}`);
          }
        }

        // Delete thumbnail if exists
        const thumbnailKey = this.s3StorageService.generateThumbnailKey(file.id);
        try {
          const exists = await this.s3StorageService.fileExists(thumbnailKey);
          if (exists) {
            await this.s3StorageService.deleteFile(thumbnailKey);
            this.logger.debug(`Deleted thumbnail: ${thumbnailKey}`);
          }
        } catch (error) {
          this.logger.error(`Failed to delete thumbnail ${thumbnailKey}:`, error.message);
          // Don't add to errors for thumbnails as they're optional
        }
      }

      this.logger.log(`S3 cleanup completed for user ${userId}. Files: ${files.length}, Errors: ${errors.length}`);

      return { 
        deletedFiles: files.length, 
        deletedThumbnails: files.length, // Approximate, as not all files have thumbnails
        errors 
      };
    } catch (error) {
      this.logger.error(`S3 cleanup failed for user ${userId}:`, error.stack);
      throw new InternalServerErrorException('Failed to cleanup user files from S3');
    }
  }
}

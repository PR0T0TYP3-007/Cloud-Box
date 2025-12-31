import { Injectable, BadRequestException, NotFoundException, ConflictException, InternalServerErrorException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { File } from 'src/database/file.entity';
import { Folder } from 'src/database/folder.entity';
import { FileVersion } from 'src/database/file-version.entity';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { FolderService } from 'src/folders/providers/folders.service';
import { Logger, ForbiddenException } from '@nestjs/common';
import { SharingService } from 'src/sharing/providers/sharing.service';

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

    private readonly folderService: FolderService,

    private readonly sharingService: SharingService,
  ) {}

  /**
   * Accepts the raw multer files and the JSON paths string and performs validation
   * and delegates to uploadFilesWithPaths. Keeps controller thin.
   */
  async uploadFilesMultipart(userId: string, files: any[], pathsJson: string) {
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
    return this.uploadFilesWithPaths(userId, input);
  }

  /**
   * Return a readable stream and metadata for a file validated for the user.
   */
  async getFileStream(userId: string, fileId: string): Promise<{ stream: fs.ReadStream; name: string; size?: number }> {
    const file = await this.getFileForDownload(userId, fileId);
    if (!file.storagePath || !fs.existsSync(file.storagePath)) throw new NotFoundException('File data not found');
    const stream = fs.createReadStream(file.storagePath);
    return { stream, name: file.name, size: Number(file.size) || undefined };
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

        // check duplicate file name
        const existing = await this.fileRepository.findOne({ where: { folder: { id: folderId }, name: uploadFile.originalname } });
        if (existing) throw new ConflictException('A file with that name already exists in this folder');
      } else {
        const { IsNull } = await import('typeorm');
        const existingRoot = await this.fileRepository.findOne({ where: { user: { id: userId }, folder: IsNull(), name: uploadFile.originalname } });
        if (existingRoot) throw new ConflictException('A file with that name already exists at root');
      }

      // prepare storage
      const uploadsRoot = path.resolve(process.cwd(), 'uploads');
      const userDir = path.join(uploadsRoot, userId);
      if (!fs.existsSync(userDir)) fs.mkdirSync(userDir, { recursive: true });

      const fileId = uuidv4();
      const ext = path.extname(uploadFile.originalname);
      const storageFileName = `${fileId}${ext}`;
      const storagePath = path.join(userDir, storageFileName);

      // write file
      fs.writeFileSync(storagePath, uploadFile.buffer);

      // compute checksum and size
      const checksum = crypto.createHash('sha256').update(uploadFile.buffer).digest('hex');
      const size = uploadFile.buffer.length.toString();

      // create or update File entity
      let file = await this.fileRepository.findOne({ where: { user: { id: userId }, folder: folder ? { id: folder.id } : null, name: uploadFile.originalname } as any });

      if (!file) {
        file = this.fileRepository.create({ name: uploadFile.originalname, size, folder: folder ?? null, user: { id: userId } as any, storagePath: storagePath });
        file = await this.fileRepository.save(file);
      } else {
        // increment version and update size/storagePath
        file.currentVersion = (file.currentVersion ?? 1) + 1;
        file.size = size;
        file.storagePath = storagePath;
        file = await this.fileRepository.save(file);
      }

      // create file version
      const versionNumber = file.currentVersion ?? 1;
      const version = this.versionRepository.create({ file: file as any, version: versionNumber, storageKey: storagePath, checksum, size });
      const savedVersion = await this.versionRepository.save(version);

      // ensure file.currentVersion matches saved version
      file.currentVersion = savedVersion.version;
      await this.fileRepository.save(file);

      return { file, version: savedVersion };
    } catch (err) {
      if (err instanceof BadRequestException || err instanceof NotFoundException || err instanceof ConflictException) throw err;
      console.error('Error uploading file:', err);
      throw new InternalServerErrorException('Failed to upload file');
    }
  }

  /**
   * Upload multiple files where each file has a relativePath like "a/b/c.txt".
   * This will ensure parent folders exist (creating them if needed) and call
   * uploadFile for each file.
   */
  async uploadFilesWithPaths(userId: string, filesWithPaths: { relativePath: string; buffer: Buffer }[]): Promise<{ successes: any[]; errors: { path: string; error: string }[] }> {
    if (!userId) throw new BadRequestException('Missing user id');
    if (!Array.isArray(filesWithPaths) || filesWithPaths.length === 0) throw new BadRequestException('No files provided');

    const successes: any[] = [];
    const errors: { path: string; error: string }[] = [];

    for (const entry of filesWithPaths) {
      try {
        const cleaned = entry.relativePath.replace(/\\/g, '/');
        const dirname = path.posix.dirname(cleaned);
        const filename = path.posix.basename(cleaned);

        // ensure path, dirname may be '.' for root
        let parentFolder: Folder;
        if (dirname && dirname !== '.' && dirname !== '') {
          parentFolder = await this.folderService.ensurePath(userId, dirname);
        } else {
          parentFolder = await this.folderService.createRootFolder(userId);
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

    const file = await this.fileRepository.findOne({ where: { id: fileId }, relations: ['user', 'folder'] });
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

    // Delete versions and remove storage files
    const versions = await this.versionRepository.find({ where: { file: { id: fileId } } });
    for (const v of versions) {
      try {
        if (v.storageKey && fs.existsSync(v.storageKey)) {
          fs.unlinkSync(v.storageKey);
        }
      } catch (err) {
        console.warn('Failed to remove storage file for version', v.id, err);
      }
      try {
        await this.versionRepository.remove(v);
      } catch (err) {
        console.warn('Failed to remove file version record', v.id, err);
      }
    }

    try {
      await this.fileRepository.remove(file);
    } catch (err) {
      console.error('Failed to remove file record', err);
      throw new InternalServerErrorException('Failed to delete file');
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
}

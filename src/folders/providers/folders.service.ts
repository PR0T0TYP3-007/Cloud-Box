import { Injectable, BadRequestException, NotFoundException, ConflictException, InternalServerErrorException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Folder } from "src/database/folder.entity";
import { Repository } from "typeorm";
import { File } from 'src/database/file.entity';
import { FileVersion } from 'src/database/file-version.entity';
import * as fs from 'fs';
import * as path from 'path';
import archiver from 'archiver';
import { SharingService } from 'src/sharing/providers/sharing.service';
import { ForbiddenException } from '@nestjs/common';
import { Users } from 'src/database/user.entity';
import { DEFAULT_STORAGE_QUOTA_BYTES } from 'src/common/storage.constants';
import type { Archiver } from 'archiver';

@Injectable()
export class FolderService {
  constructor(
    @InjectRepository(Folder)
    private folderRepository: Repository<Folder>,

    @InjectRepository(File)
    private readonly fileRepository: Repository<File>,

    @InjectRepository(FileVersion)
    private readonly versionRepository: Repository<FileVersion>,

    @InjectRepository(Users)
    private readonly userRepository: Repository<Users>,

    private readonly sharingService: SharingService,
  ) {}

  async listForUser(userId: string): Promise<Folder[]> {
    if (!userId) throw new BadRequestException('Missing user id');
    try {
      return this.folderRepository.find({ where: { user: { id: userId } }, relations: ['children', 'parent'] });
    } catch (err) {
      throw new InternalServerErrorException('Failed to list folders');
    }
  }

  private async computeFolderSize(folderId: string): Promise<number> {
    // BFS to collect subtree folder ids
    const queue = [folderId];
    const all: string[] = [];
    while (queue.length) {
      const fid = queue.shift()!
      all.push(fid);
      const children = await this.folderRepository.find({ where: { parent: { id: fid }, isDeleted: false } as any });
      for (const c of children) queue.push(c.id);
    }

    if (all.length === 0) return 0;

    const qb = this.fileRepository.createQueryBuilder('file')
      .select('SUM(CAST(file.size AS bigint))', 'sum')
      .where('file.folderId IN (:...ids)', { ids: all })
      .andWhere('file.isDeleted = false');

    const raw = await qb.getRawOne();
    const sum = raw?.sum ?? null;
    return sum ? Number(sum) : 0;
  }

  async getFolderView(userId: string, folderId?: string): Promise<{ parentName: string | null; folder: { id: string; name: string; parentId: string | null; createdAt: Date; size: number }; folders: { id: string; name: string; size: number; parentId: string | null; createdAt: Date }[]; files: { id: string; name: string; size: number; currentVersion: number; createdAt: Date; updatedAt: Date; folderId: string | null }[]; storage: { used: number; quota: number } }> {
    if (!userId) throw new BadRequestException('Missing user id');

    try {
      const { IsNull } = await import('typeorm');

      let folder: Folder | null = null;

      if (folderId) {
        folder = await this.folderRepository.findOne({ where: { id: folderId, isDeleted: false } as any, relations: ['parent', 'children', 'user'] });
        if (!folder) throw new NotFoundException('Folder not found');
        if (folder.user.id !== userId) {
          const ok = await this.sharingService.hasPermission(userId, 'folder', folder.id, 'view');
          if (!ok) throw new ForbiddenException('Folder does not belong to the authenticated user');
        }
      } else {
        // Use the user's root folder
        folder = await this.folderRepository.findOne({ where: { user: { id: userId }, parent: IsNull(), isDeleted: false } as any, relations: ['children'] });
        if (!folder) throw new NotFoundException('Root folder not found for this user');
      }

      const parentName = folder.parent ? folder.parent.name : null;
      const user = await this.userRepository.findOne({ where: { id: userId } });
      const quota = user?.storageQuota ? Number(user.storageQuota) : DEFAULT_STORAGE_QUOTA_BYTES;

      // Fetch files within this folder (exclude soft-deleted)
      // For root folder (no parent), files have folder = null
      // For subfolders, files have folder = { id: folder.id }
      const isRootFolder = !folder.parent;
      let files: any[];
      if (isRootFolder) {
        files = await this.fileRepository.find({ where: { user: { id: userId }, folder: IsNull(), isDeleted: false } as any });
      } else {
        files = await this.fileRepository.find({ where: { folder: { id: folder.id }, isDeleted: false } as any });
      }
      const filesData = (files || []).map((f) => ({ id: f.id, name: f.name, size: Number(f.size) || 0, currentVersion: f.currentVersion, createdAt: f.createdAt, updatedAt: f.updatedAt, folderId: f.folder?.id ?? null }));

      // compute sizes for child folders
      const foldersWithSize: { id: string; name: string; size: number; parentId: string | null; createdAt: Date }[] = [];
      const activeChildren = (folder.children || []).filter((c) => !c.isDeleted);
      for (const child of activeChildren) {
        const size = await this.computeFolderSize(child.id);
        foldersWithSize.push({ id: child.id, name: child.name, size, parentId: folder.id, createdAt: child.createdAt });
      }

      const folderSize = await this.computeFolderSize(folder.id);

      // compute user's total used storage
      const usedQb = this.fileRepository.createQueryBuilder('file')
        .select('SUM(CAST(file.size AS bigint))', 'sum')
        .where('file.userId = :userId', { userId })
        .andWhere('file.isDeleted = false');
      const usedRaw = await usedQb.getRawOne();
      const used = usedRaw?.sum ? Number(usedRaw.sum) : 0;

      return {
        parentName,
        folder: { id: folder.id, name: folder.name, parentId: folder.parent?.id ?? null, createdAt: folder.createdAt, size: folderSize },
        folders: foldersWithSize,
        files: filesData,
        storage: { used, quota },
      };
    } catch (err) {
      if (err instanceof BadRequestException || err instanceof NotFoundException) throw err;
      console.error('Error fetching folder view:', err);
      throw new InternalServerErrorException('Failed to fetch folder view');
    }
  }

  async createFolder(userId: string, createFolderData: { name: string; parentId?: string }): Promise<Folder> {
    if (!userId) throw new BadRequestException('Missing user id');
    if (!createFolderData || !createFolderData.name) throw new BadRequestException('Folder name is required');

    try {
      const { IsNull } = await import('typeorm');
      let parent: Folder | null = null;

      if (createFolderData.parentId) {
        // Validate parent exists and belongs to user
        parent = await this.folderRepository.findOne({ where: { id: createFolderData.parentId }, relations: ['user'] });
        if (!parent) throw new NotFoundException('Parent folder not found');
        if (parent.user.id !== userId) throw new BadRequestException('Cannot create folder under a folder you do not own');
      } else {
        // No parentId means create under root folder
        parent = await this.folderRepository.findOne({ where: { user: { id: userId }, parent: IsNull(), isDeleted: false } as any });
        if (!parent) throw new NotFoundException('Root folder not found for this user');
      }

      const where: any = { name: createFolderData.name, user: { id: userId }, parent: { id: parent.id } };

      // Check for existing folder - if it exists, reuse it (idempotent behavior like Windows Explorer)
      const existing = await this.folderRepository.findOne({ where });
      if (existing) {
        return existing; // Reuse existing folder instead of throwing error
      }

      const toCreate: Partial<Folder> = {
        name: createFolderData.name,
        parent: parent,
        user: { id: userId } as any,
      };

      const folder = this.folderRepository.create(toCreate as Folder);
      return await this.folderRepository.save(folder);
    } catch (err) {
      if (err instanceof BadRequestException || err instanceof NotFoundException) throw err;
      console.error('Error creating folder:', err);
      throw new InternalServerErrorException('Failed to create folder');
    }
  }

  async createRootFolder(userId: string, name = 'root'): Promise<Folder> {
    if (!userId) throw new BadRequestException('Missing user id');
    try {
      const { IsNull } = await import('typeorm');
      const existingRoot = await this.folderRepository.findOne({ where: { user: { id: userId }, parent: IsNull() } });
      if (existingRoot) return existingRoot;

      const toCreate: Partial<Folder> = {
        name,
        parent: null,
        user: { id: userId } as any,
      };
      const folder = this.folderRepository.create(toCreate as Folder);
      return await this.folderRepository.save(folder);
    } catch (err) {
      console.error('Error creating root folder:', err);
      throw new InternalServerErrorException('Failed to create root folder');
    }
  }

  /**
   * Ensure the folder path exists for a user. `path` is a POSIX-style path
   * relative to the user's root, e.g. "Photos/Vacation/2024".
   * Returns the Folder entity for the final segment. This is idempotent and
   * will reuse existing folders if present.
   * @param baseFolderId - Optional base folder ID to create path under (if not provided, uses root)
   */
  async ensurePath(userId: string, pathStr: string, baseFolderId?: string): Promise<Folder> {
    if (!userId) throw new BadRequestException('Missing user id');
    if (!pathStr || typeof pathStr !== 'string') throw new BadRequestException('Invalid path');

    const segments = pathStr.split('/').filter((s) => s && s.trim().length > 0);
    
    // Get the starting folder (either provided base or root)
    let parent: Folder;
    if (baseFolderId) {
      const folder = await this.folderRepository.findOne({ where: { id: baseFolderId, isDeleted: false } as any, relations: ['user'] });
      if (!folder) throw new NotFoundException('Base folder not found');
      if (folder.user.id !== userId) throw new ForbiddenException('Cannot create folders under a folder you do not own');
      parent = folder;
    } else {
      parent = await this.createRootFolder(userId);
    }

    if (segments.length === 0) return parent;

    for (const segment of segments) {
      // try to find existing child
      let child = await this.folderRepository.findOne({ where: { name: segment, parent: { id: parent.id }, user: { id: userId } } });
      if (child) {
        parent = child;
        continue;
      }

      // create new folder under parent. Handle potential unique constraint races by retrying lookup on failure
      try {
        const toCreate: Partial<Folder> = {
          name: segment,
          parent: parent,
          user: { id: userId } as any,
        };
        const created = this.folderRepository.create(toCreate as Folder);
        child = await this.folderRepository.save(created);
        parent = child;
      } catch (err) {
        // If someone else created it concurrently, refetch. Otherwise rethrow.
        console.warn('ensurePath: create failed, retrying lookup', err);
        const retry = await this.folderRepository.findOne({ where: { name: segment, parent: { id: parent.id }, user: { id: userId } } });
        if (retry) {
          parent = retry;
        } else {
          console.error('ensurePath: failed to create folder segment and could not find existing one', err);
          throw new InternalServerErrorException('Failed to ensure folder path');
        }
      }
    }

    return parent;
  }

  async renameFolder(userId: string, folderId: string, newName: string): Promise<Folder> {
    if (!userId) throw new BadRequestException('Missing user id');
    if (!folderId || !newName) throw new BadRequestException('Missing params');

    const folder = await this.folderRepository.findOne({ where: { id: folderId }, relations: ['user', 'parent'] });
    if (!folder) throw new NotFoundException('Folder not found');
    if (folder.user.id !== userId) {
      const ok = await this.sharingService.hasPermission(userId, 'folder', folder.id, 'edit');
      if (!ok) throw new ForbiddenException('Folder does not belong to the authenticated user');
    }

    const { IsNull } = await import('typeorm');
    const where: any = { name: newName, user: { id: userId } };
    if (folder.parent) where.parent = { id: folder.parent.id };
    else where.parent = IsNull();

    const existing = await this.folderRepository.findOne({ where });
    if (existing && existing.id !== folder.id) throw new ConflictException('A folder with that name already exists in this location');

    folder.name = newName;
    return await this.folderRepository.save(folder);
  }

  async moveFolder(userId: string, folderId: string, targetFolderId: string | null): Promise<Folder> {
    if (!userId) throw new BadRequestException('Missing user id');
    if (!folderId) throw new BadRequestException('Missing folder id');

    const folder = await this.folderRepository.findOne({ where: { id: folderId }, relations: ['user', 'parent'] });
    if (!folder) throw new NotFoundException('Folder not found');
        if (folder.user.id !== userId) {
          const ok = await this.sharingService.hasPermission(userId, 'folder', folder.id, 'view');
          if (!ok) throw new ForbiddenException('Folder does not belong to the authenticated user');
        }
    // Do not allow moving the root folder
    if (!folder.parent) throw new BadRequestException('Cannot move root folder');

    let target: Folder | null = null;
    if (targetFolderId) {
      if (targetFolderId === folderId) throw new BadRequestException('Cannot move folder into itself');
      target = await this.folderRepository.findOne({ where: { id: targetFolderId }, relations: ['user', 'parent'] });
      if (!target) throw new NotFoundException('Target folder not found');
      if (target.user.id !== userId) {
        const ok = await this.sharingService.hasPermission(userId, 'folder', target.id, 'edit');
        if (!ok) throw new ForbiddenException('Cannot move folder to a folder you do not own');
      }

      // Prevent moving into own subtree
      let cur: Folder | null = target;
      while (cur) {
        if (cur.id === folder.id) throw new BadRequestException('Cannot move folder into its own subtree');
        cur = cur.parent ? await this.folderRepository.findOne({ where: { id: cur.parent.id }, relations: ['parent'] }) : null;
      }
    }

    // Check duplicate folder name in target
    const { IsNull } = await import('typeorm');
    const where: any = { name: folder.name, user: { id: userId } };
    if (target) where.parent = { id: target.id };
    else where.parent = IsNull();

    const existing = await this.folderRepository.findOne({ where });
    if (existing && existing.id !== folder.id) throw new ConflictException('A folder with that name already exists in the target location');

    folder.parent = target ?? null;
    return await this.folderRepository.save(folder);
  }

  async getAncestors(userId: string, folderId: string): Promise<{ id: string; name: string; parentId: string | null }[]> {
    if (!userId) throw new BadRequestException('Missing user id');
    if (!folderId) throw new BadRequestException('Missing folder id');

    const folder = await this.folderRepository.findOne({ where: { id: folderId }, relations: ['user', 'parent'] });
    if (!folder) throw new NotFoundException('Folder not found');
    if (folder.user.id !== userId) {
      const ok = await this.sharingService.hasPermission(userId, 'folder', folder.id, 'view');
      if (!ok) throw new ForbiddenException('Folder does not belong to the authenticated user');
    }

    const ancestors: { id: string; name: string; parentId: string | null }[] = [];
    let cur: Folder | null = folder;
    while (cur) {
      ancestors.unshift({ id: cur.id, name: cur.name, parentId: cur.parent ? cur.parent.id : null });
      cur = cur.parent ? await this.folderRepository.findOne({ where: { id: cur.parent.id }, relations: ['parent'] }) : null;
    }

    return ancestors;
  }

  async deleteFolder(userId: string, folderId: string, recursive = false): Promise<void> {
    if (!userId) throw new BadRequestException('Missing user id');
    if (!folderId) throw new BadRequestException('Missing folder id');

    const folder = await this.folderRepository.findOne({ where: { id: folderId }, relations: ['user', 'children', 'parent'] });
    if (!folder) throw new NotFoundException('Folder not found');
    if (folder.user.id !== userId) {
      const ok = await this.sharingService.hasPermission(userId, 'folder', folder.id, 'edit');
      if (!ok) throw new ForbiddenException('Folder does not belong to the authenticated user');
    }

    // Do not allow deleting root
    if (!folder.parent) throw new BadRequestException('Cannot delete root folder');

    // If not recursive, ensure empty (no subfolders and no files)
    const hasFiles = await this.fileRepository.findOne({ where: { folder: { id: folderId }, isDeleted: false } as any });
    if (!recursive && ((folder.children && folder.children.length > 0) || hasFiles)) {
      throw new ConflictException('Folder is not empty; use recursive=true to delete recursively');
    }

    // Collect subtree folder ids
    const queue = [folder.id];
    const allFolderIds: string[] = [];
    while (queue.length) {
      const fid = queue.shift()!;
      allFolderIds.push(fid);
      const children = await this.folderRepository.find({ where: { parent: { id: fid } } });
      for (const c of children) queue.push(c.id);
    }

    // Soft-delete files inside each folder (mark isDeleted)
    for (const fid of allFolderIds) {
      const files = await this.fileRepository.find({ where: { folder: { id: fid } } });
      for (const f of files) {
        try {
          f.isDeleted = true;
          await this.fileRepository.save(f);
        } catch (err) {
          console.warn('Failed to mark file as deleted during folder delete', f.id, err);
        }
      }
    }

    // Soft-delete folders (mark isDeleted)
    for (const fid of allFolderIds.reverse()) {
      try {
        const f = await this.folderRepository.findOne({ where: { id: fid } });
        if (f) {
          f.isDeleted = true;
          await this.folderRepository.save(f);
        }
      } catch (err) {
        console.warn('Failed to mark folder as deleted during recursive delete', fid, err);
      }
    }
  }

  async restoreFolder(userId: string, folderId: string): Promise<Folder> {
    if (!userId) throw new BadRequestException('Missing user id');
    if (!folderId) throw new BadRequestException('Missing folder id');

    const folder = await this.folderRepository.findOne({ where: { id: folderId }, relations: ['user', 'children', 'parent'] });
    if (!folder) throw new NotFoundException('Folder not found');
    if (folder.user.id !== userId) {
      const ok = await this.sharingService.hasPermission(userId, 'folder', folder.id, 'edit');
      if (!ok) throw new ForbiddenException('Folder does not belong to the authenticated user');
    }

    // Restore this folder and its descendants
    const queue = [folder.id];
    const allFolderIds: string[] = [];
    while (queue.length) {
      const fid = queue.shift()!;
      allFolderIds.push(fid);
      const children = await this.folderRepository.find({ where: { parent: { id: fid } } });
      for (const c of children) queue.push(c.id);
    }

    // Restore folders
    for (const fid of allFolderIds) {
      try {
        const f = await this.folderRepository.findOne({ where: { id: fid } });
        if (f) {
          f.isDeleted = false;
          await this.folderRepository.save(f);
        }
      } catch (err) {
        console.warn('Failed to restore folder during restoreFolder', fid, err);
      }
    }

    // Restore files inside these folders
    for (const fid of allFolderIds) {
      try {
        const files = await this.fileRepository.find({ where: { folder: { id: fid } } });
        for (const file of files) {
          file.isDeleted = false;
          await this.fileRepository.save(file);
        }
      } catch (err) {
        console.warn('Failed to restore files during restoreFolder', fid, err);
      }
    }

    return await this.folderRepository.findOne({ where: { id: folderId } }) as Folder;
  }

  async permanentlyDeleteFolder(userId: string, folderId: string): Promise<void> {
    if (!userId) throw new BadRequestException('Missing user id');
    if (!folderId) throw new BadRequestException('Missing folder id');

    const folder = await this.folderRepository.findOne({ where: { id: folderId }, relations: ['user'] });
    if (!folder) throw new NotFoundException('Folder not found');
    if (folder.user.id !== userId) {
      throw new ForbiddenException('Folder does not belong to the authenticated user');
    }

    // Get all descendant folders
    const queue = [folder.id];
    const allFolderIds: string[] = [];
    while (queue.length) {
      const fid = queue.shift()!;
      allFolderIds.push(fid);
      const children = await this.folderRepository.find({ where: { parent: { id: fid } } });
      for (const c of children) queue.push(c.id);
    }

    // Delete all files in these folders from storage and database
    for (const fid of allFolderIds) {
      const files = await this.fileRepository.find({ where: { folder: { id: fid } }, relations: ['versions'] });
      for (const file of files) {
        // Delete file versions from storage
        if (file.versions && file.versions.length > 0) {
          for (const version of file.versions) {
            try {
              await this.storageAdapter.deleteFile(version.storageKey);
            } catch (err) {
              console.warn('Failed to delete file from storage:', version.storageKey, err);
            }
          }
        }
        // Delete file from database
        await this.fileRepository.remove(file);
      }
    }

    // Delete all folders from database (in reverse order to avoid constraint issues)
    for (let i = allFolderIds.length - 1; i >= 0; i--) {
      const f = await this.folderRepository.findOne({ where: { id: allFolderIds[i] } });
      if (f) {
        await this.folderRepository.remove(f);
      }
    }
  }

  async downloadFolderAsZip(userId: string, folderId: string): Promise<{ zipStream: Archiver; folderName: string }> {
    if (!userId) throw new BadRequestException('Missing user id');
    if (!folderId) throw new BadRequestException('Missing folder id');

    // Get the folder and verify permissions
    const folder = await this.folderRepository.findOne({
      where: { id: folderId },
      relations: ['user'],
    });

    if (!folder) throw new NotFoundException('Folder not found');

    // Check permissions
    if (folder.user.id !== userId) {
      const ok = await this.sharingService.hasPermission(userId, 'folder', folder.id, 'view');
      if (!ok) throw new ForbiddenException('You do not have permission to download this folder');
    }

    // Create archiver instance
    const archive = archiver('zip', {
      zlib: { level: 9 }, // Maximum compression
    });

    // Handle archiver errors
    archive.on('error', (err) => {
      throw new InternalServerErrorException(`Failed to create zip: ${err.message}`);
    });

    // Recursively add folder contents
    await this.addFolderToArchive(archive, folder.id, '');

    // Finalize the archive (this triggers the 'end' event)
    archive.finalize();

    return { zipStream: archive, folderName: folder.name };
  }

  private async addFolderToArchive(archive: Archiver, folderId: string, basePath: string): Promise<void> {
    // Get all files in this folder
    const files = await this.fileRepository.find({
      where: { folder: { id: folderId }, isDeleted: false },
    });

    // Add files to archive
    for (const file of files) {
      if (file.storagePath && fs.existsSync(file.storagePath)) {
        const filePath = basePath ? `${basePath}/${file.name}` : file.name;
        archive.file(file.storagePath, { name: filePath });
      }
    }

    // Get all subfolders
    const subfolders = await this.folderRepository.find({
      where: { parent: { id: folderId }, isDeleted: false },
    });

    // Recursively add subfolders
    for (const subfolder of subfolders) {
      const subPath = basePath ? `${basePath}/${subfolder.name}` : subfolder.name;
      await this.addFolderToArchive(archive, subfolder.id, subPath);
    }
  }
}

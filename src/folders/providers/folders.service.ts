import { Injectable, BadRequestException, NotFoundException, ConflictException, InternalServerErrorException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Folder } from "src/database/folder.entity";
import { Repository } from "typeorm";
import { File } from 'src/database/file.entity';
import { FileVersion } from 'src/database/file-version.entity';
import * as fs from 'fs';
import { SharingService } from 'src/sharing/providers/sharing.service';
import { ForbiddenException } from '@nestjs/common';

@Injectable()
export class FolderService {
  constructor(
    @InjectRepository(Folder)
    private folderRepository: Repository<Folder>,

    @InjectRepository(File)
    private readonly fileRepository: Repository<File>,

    @InjectRepository(FileVersion)
    private readonly versionRepository: Repository<FileVersion>,

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

  async getFolderView(userId: string, folderId?: string): Promise<{ parentName: string | null; folder: { id: string; name: string }; children: { id: string; name: string }[] }> {
    if (!userId) throw new BadRequestException('Missing user id');

    try {
      const { IsNull } = await import('typeorm');

      let folder: Folder | null = null;

      if (folderId) {
        folder = await this.folderRepository.findOne({ where: { id: folderId }, relations: ['parent', 'children', 'user'] });
        if (!folder) throw new NotFoundException('Folder not found');
        if (folder.user.id !== userId) {
          const ok = await this.sharingService.hasPermission(userId, 'folder', folder.id, 'edit');
          if (!ok) throw new ForbiddenException('Folder does not belong to the authenticated user');
        }
      } else {
        // Use the user's root folder
        folder = await this.folderRepository.findOne({ where: { user: { id: userId }, parent: IsNull() }, relations: ['children'] });
        if (!folder) throw new NotFoundException('Root folder not found for this user');
      }

      const parentName = folder.parent ? folder.parent.name : null;
      const children = (folder.children || []).map((c) => ({ id: c.id, name: c.name }));

      return { parentName, folder: { id: folder.id, name: folder.name }, children };
    } catch (err) {
      if (err instanceof BadRequestException || err instanceof NotFoundException) throw err;
      console.error('Error fetching folder view:', err);
      throw new InternalServerErrorException('Failed to fetch folder view');
    }
  }

  async createFolder(userId: string, createFolderData: { name: string; parentId: string }): Promise<Folder> {
    if (!userId) throw new BadRequestException('Missing user id');
    if (!createFolderData || !createFolderData.name) throw new BadRequestException('Folder name is required');
    if (!createFolderData.parentId) throw new BadRequestException('parentId is required for non-root folders');

    try {
      // Validate parent exists and belongs to user
      const parent = await this.folderRepository.findOne({ where: { id: createFolderData.parentId }, relations: ['user'] });
      if (!parent) throw new NotFoundException('Parent folder not found');
      if (parent.user.id !== userId) throw new BadRequestException('Cannot create folder under a folder you do not own');

      const { IsNull } = await import('typeorm');
      const where: any = { name: createFolderData.name, user: { id: userId }, parent: { id: parent.id } };

      const existing = await this.folderRepository.findOne({ where });
      if (existing) throw new ConflictException('A folder with that name already exists in this location');

      const toCreate: Partial<Folder> = {
        name: createFolderData.name,
        parent: parent,
        user: { id: userId } as any,
      };

      const folder = this.folderRepository.create(toCreate as Folder);
      return await this.folderRepository.save(folder);
    } catch (err) {
      if (err instanceof BadRequestException || err instanceof NotFoundException || err instanceof ConflictException) throw err;
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
   */
  async ensurePath(userId: string, pathStr: string): Promise<Folder> {
    if (!userId) throw new BadRequestException('Missing user id');
    if (!pathStr || typeof pathStr !== 'string') throw new BadRequestException('Invalid path');

    const segments = pathStr.split('/').filter((s) => s && s.trim().length > 0);
    if (segments.length === 0) return this.createRootFolder(userId);

    // start from root
    let parent = await this.createRootFolder(userId);

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

  async deleteFolder(userId: string, folderId: string, recursive = false): Promise<void> {
    if (!userId) throw new BadRequestException('Missing user id');
    if (!folderId) throw new BadRequestException('Missing folder id');

    const folder = await this.folderRepository.findOne({ where: { id: folderId }, relations: ['user', 'children'] });
    if (!folder) throw new NotFoundException('Folder not found');
    if (folder.user.id !== userId) {
      const ok = await this.sharingService.hasPermission(userId, 'folder', folder.id, 'edit');
      if (!ok) throw new ForbiddenException('Folder does not belong to the authenticated user');
    }

    // Do not allow deleting root
    if (!folder.parent) throw new BadRequestException('Cannot delete root folder');

    // If not recursive, ensure empty (no subfolders and no files)
    const hasFiles = await this.fileRepository.findOne({ where: { folder: { id: folderId } } });
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

    // Delete files and versions inside each folder
    for (const fid of allFolderIds) {
      const files = await this.fileRepository.find({ where: { folder: { id: fid } } });
      for (const f of files) {
        // delete versions' storage files
        const versions = await this.versionRepository.find({ where: { file: { id: f.id } } });
        for (const v of versions) {
          try {
            if (v.storageKey && fs.existsSync(v.storageKey)) {
              fs.unlinkSync(v.storageKey);
            }
          } catch (err) {
            console.warn('Failed to remove storage file for version during folder delete', v.id, err);
          }
          try { await this.versionRepository.remove(v); } catch (err) { console.warn('Failed to remove version record during folder delete', v.id, err); }
        }
        try { await this.fileRepository.remove(f); } catch (err) { console.warn('Failed to remove file record during folder delete', f.id, err); }
      }
    }

    // Remove folder rows (bottom-up)
    // Sort by dependency: deeper folders should be removed first
    for (const fid of allFolderIds.reverse()) {
      try {
        const f = await this.folderRepository.findOne({ where: { id: fid } });
        if (f) await this.folderRepository.remove(f);
      } catch (err) {
        console.warn('Failed to remove folder during recursive delete', fid, err);
      }
    }
  }
}


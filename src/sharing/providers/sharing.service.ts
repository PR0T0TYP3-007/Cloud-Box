import { Injectable, BadRequestException, NotFoundException, ConflictException, ForbiddenException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { UserShare, ItemType, Permission } from 'src/database/user-share.entity';
import { Users } from 'src/database/user.entity';
import { File } from 'src/database/file.entity';
import { Folder } from 'src/database/folder.entity';

@Injectable()
export class SharingService {
  private readonly logger = new Logger('SharingService');

  constructor(
    @InjectRepository(UserShare)
    private readonly shareRepository: Repository<UserShare>,

    @InjectRepository(Users)
    private readonly usersRepository: Repository<Users>,

    @InjectRepository(File)
    private readonly fileRepository: Repository<File>,

    @InjectRepository(Folder)
    private readonly folderRepository: Repository<Folder>,
  ) {}

  private matchesPermission(required: Permission | 'viewOrEdit', actual: Permission): boolean {
    if (required === 'edit') return actual === 'edit';
    return actual === 'view' || actual === 'edit';
  }

  private async getFolderAncestorIds(folderId: string): Promise<string[]> {
    const ids: string[] = [];
    let cur = await this.folderRepository.findOne({ where: { id: folderId, isDeleted: false } as any, relations: ['parent'] });
    while (cur?.parent) {
      ids.push(cur.parent.id);
      cur = await this.folderRepository.findOne({ where: { id: cur.parent.id, isDeleted: false } as any, relations: ['parent'] });
    }
    return ids;
  }

  private async hasFolderShare(userId: string, folderId: string, required: Permission | 'viewOrEdit'): Promise<boolean> {
    const direct = await this.shareRepository.findOne({ where: { itemId: folderId, itemType: 'folder', sharedWith: { id: userId } } as any });
    if (direct && this.matchesPermission(required, direct.permission)) return true;

    const ancestorIds = await this.getFolderAncestorIds(folderId);
    if (ancestorIds.length === 0) return false;

    const ancestorShare = await this.shareRepository.findOne({ where: { sharedWith: { id: userId }, itemType: 'folder', itemId: In(ancestorIds) } as any });
    if (!ancestorShare) return false;
    return this.matchesPermission(required, ancestorShare.permission);
  }

  async createShare(ownerId: string, itemType: ItemType, itemId: string, targetEmail: string, permission: Permission): Promise<UserShare> {
    if (!ownerId || !itemType || !itemId || !targetEmail || !permission) throw new BadRequestException('Missing params');

    // validate item exists and owner
    if (itemType === 'file') {
      const f = await this.fileRepository.findOne({ where: { id: itemId, isDeleted: false } as any, relations: ['user'] });
      if (!f) throw new NotFoundException('File not found');
      if (f.user.id !== ownerId) throw new ForbiddenException('Not owner of the file');
    } else {
      const fo = await this.folderRepository.findOne({ where: { id: itemId, isDeleted: false } as any, relations: ['user'] });
      if (!fo) throw new NotFoundException('Folder not found');
      if (fo.user.id !== ownerId) throw new ForbiddenException('Not owner of the folder');
    }

    const target = await this.usersRepository.findOne({ where: { email: targetEmail } });
    if (!target) throw new NotFoundException('Target user not found');

    const existing = await this.shareRepository.findOne({ where: { itemId, itemType, sharedWith: { id: target.id } } as any });
    if (existing) throw new ConflictException('Share already exists for this user and item');

    const payload: any = { itemId, itemType, owner: { id: ownerId } as any, sharedWith: { id: target.id } as any, permission };
    const saved = await this.shareRepository.save(payload as any);
    return saved as UserShare;
  }

  async hasPermission(userId: string, itemType: ItemType, itemId: string, required: Permission | 'viewOrEdit'): Promise<boolean> {
    if (!userId) throw new BadRequestException('Missing user id');

    if (itemType === 'file') {
      const f = await this.fileRepository.findOne({ where: { id: itemId, isDeleted: false } as any, relations: ['user', 'folder'] });
      if (!f) return false;
      if (f.user.id === userId) return true;

      // direct file share
      const share = await this.shareRepository.findOne({ where: { itemId, itemType: 'file', sharedWith: { id: userId } } as any });
      if (share && this.matchesPermission(required, share.permission)) return true;

      // inherited from containing folder or its ancestors
      if (f.folder?.id) {
        return await this.hasFolderShare(userId, f.folder.id, required);
      }
      return false;
    }

    // itemType === 'folder'
    const fo = await this.folderRepository.findOne({ where: { id: itemId, isDeleted: false } as any, relations: ['user'] });
    if (!fo) return false;
    if (fo.user.id === userId) return true;

    // direct folder share
    const share = await this.shareRepository.findOne({ where: { itemId, itemType: 'folder', sharedWith: { id: userId } } as any });
    if (share && this.matchesPermission(required, share.permission)) return true;

    // inherited from ancestor folders
    return await this.hasFolderShare(userId, itemId, required);
  }

  async listSharedWithMe(userId: string) {
    if (!userId) throw new BadRequestException('Missing user id');
    const shares = await this.shareRepository.find({ where: { sharedWith: { id: userId } } as any, relations: ['owner', 'sharedWith'] });

    const result: any[] = [];
    for (const s of shares) {
      let itemObj: any = null;
      if (s.itemType === 'file') {
        const f = await this.fileRepository.findOne({ where: { id: s.itemId, isDeleted: false } as any, relations: ['user'] });
        if (f) itemObj = { id: f.id, name: f.name, ownerId: f.user.id };
      } else {
        const fo = await this.folderRepository.findOne({ where: { id: s.itemId, isDeleted: false } as any, relations: ['user'] });
        if (fo) itemObj = { id: fo.id, name: fo.name, ownerId: fo.user.id };
      }

      result.push({
        id: s.id,
        itemId: s.itemId,
        itemType: s.itemType,
        ownerId: s.owner?.id,
        sharedWithId: s.sharedWith?.id,
        permission: s.permission,
        createdAt: s.createdAt,
        owner: s.owner ? { email: s.owner.email } : undefined,
        sharedWith: s.sharedWith ? { email: s.sharedWith.email } : undefined,
        item: itemObj,
      });
    }
    return result;
  }

  async listSentShares(ownerId: string) {
    if (!ownerId) throw new BadRequestException('Missing user id');
    const shares = await this.shareRepository.find({ where: { owner: { id: ownerId } } as any, relations: ['sharedWith'] });
    return shares;
  }

  async revokeShare(ownerId: string, shareId: string): Promise<void> {
    if (!ownerId || !shareId) throw new BadRequestException('Missing params');
    const s = await this.shareRepository.findOne({ where: { id: shareId }, relations: ['owner'] });
    if (!s) throw new NotFoundException('Share not found');
    if (s.owner.id !== ownerId) throw new ForbiddenException('Not the owner of this share');
    await this.shareRepository.remove(s);
  }
}

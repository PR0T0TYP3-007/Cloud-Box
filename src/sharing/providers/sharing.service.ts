import { Injectable, BadRequestException, NotFoundException, ConflictException, ForbiddenException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
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

  async createShare(ownerId: string, itemType: ItemType, itemId: string, targetEmail: string, permission: Permission): Promise<UserShare> {
    if (!ownerId || !itemType || !itemId || !targetEmail || !permission) throw new BadRequestException('Missing params');

    // validate item exists and owner
    if (itemType === 'file') {
      const f = await this.fileRepository.findOne({ where: { id: itemId }, relations: ['user'] });
      if (!f) throw new NotFoundException('File not found');
      if (f.user.id !== ownerId) throw new ForbiddenException('Not owner of the file');
    } else {
      const fo = await this.folderRepository.findOne({ where: { id: itemId }, relations: ['user'] });
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

    // owner always has permissions
    if (itemType === 'file') {
      const f = await this.fileRepository.findOne({ where: { id: itemId }, relations: ['user'] });
      if (!f) return false;
      if (f.user.id === userId) return true;
    } else {
      const fo = await this.folderRepository.findOne({ where: { id: itemId }, relations: ['user'] });
      if (!fo) return false;
      if (fo.user.id === userId) return true;
    }

    // check share
    const share = await this.shareRepository.findOne({ where: { itemId, itemType, sharedWith: { id: userId } } as any, relations: ['sharedWith'] });
    if (!share) return false;

    if (required === 'viewOrEdit') return ['view', 'edit'].includes(share.permission);
    if (required === 'view') return ['view', 'edit'].includes(share.permission);
    return share.permission === 'edit';
  }

  async listSharedWithMe(userId: string) {
    if (!userId) throw new BadRequestException('Missing user id');
    const shares = await this.shareRepository.find({ where: { sharedWith: { id: userId } } as any });

    // Enrich with item metadata
    const result: Array<{ share: UserShare; item: { id: string; name: string; ownerId: string } | null }> = [];
    for (const s of shares) {
      if (s.itemType === 'file') {
        const f = await this.fileRepository.findOne({ where: { id: s.itemId }, relations: ['user'] });
        result.push({ share: s, item: f ? { id: f.id, name: f.name, ownerId: f.user.id } : null });
      } else {
        const fo = await this.folderRepository.findOne({ where: { id: s.itemId }, relations: ['user'] });
        result.push({ share: s, item: fo ? { id: fo.id, name: fo.name, ownerId: fo.user.id } : null });
      }
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

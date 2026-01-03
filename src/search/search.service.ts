import { Injectable, BadRequestException, InternalServerErrorException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { File } from 'src/database/file.entity';
import { Folder } from 'src/database/folder.entity';

@Injectable()
export class SearchService {
  constructor(
    @InjectRepository(File)
    private readonly fileRepository: Repository<File>,

    @InjectRepository(Folder)
    private readonly folderRepository: Repository<Folder>,
  ) {}

  async searchForUser(userId: string, q: string) {
    if (!userId) throw new BadRequestException('Missing user id');
    if (!q || q.trim().length === 0) throw new BadRequestException('Missing query');

    try {
      const { ILike } = await import('typeorm');

      const files = await this.fileRepository.find({
        where: { user: { id: userId }, name: ILike(`%${q}%`), isDeleted: false } as any,
        relations: ['folder'],
        take: 200,
      });

      const folders = await this.folderRepository.find({
        where: { user: { id: userId }, name: ILike(`%${q}%`), isDeleted: false } as any,
        take: 200,
      });

      return {
        files: files.map((f) => ({ id: f.id, name: f.name, folderId: f.folder ? f.folder.id : null, size: Number(f.size) || 0 })),
        folders: folders.map((fo) => ({ id: fo.id, name: fo.name })),
      };
    } catch (err) {
      console.error('Search failed:', err);
      throw new InternalServerErrorException('Search failed');
    }
  }
}

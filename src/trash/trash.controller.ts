import { Controller, Get } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CurrentUser } from 'src/auth/decorators';
import { Folder } from 'src/database/folder.entity';
import { File } from 'src/database/file.entity';

@Controller('trash')
export class TrashController {
  constructor(
    @InjectRepository(Folder)
    private readonly folderRepository: Repository<Folder>,
    @InjectRepository(File)
    private readonly fileRepository: Repository<File>,
  ) {}

  @Get()
  async getTrash(@CurrentUser() user: any) {
    const userId = user?.sub ?? user?.id;
    const folders = await this.folderRepository.find({ where: { user: { id: userId }, isDeleted: true } as any });
    const files = await this.fileRepository.find({ where: { user: { id: userId }, isDeleted: true } as any });

    const foldersData = folders.map((f) => ({ id: f.id, name: f.name, createdAt: f.createdAt }));
    const filesData = files.map((f) => ({ id: f.id, name: f.name, size: Number(f.size) || 0, createdAt: f.createdAt }));

    return { message: 'OK', data: { folders: foldersData, files: filesData } };
  }
}

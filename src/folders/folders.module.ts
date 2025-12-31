import { Module } from '@nestjs/common';
import { FoldersController } from './folders.controller';
import { FolderService } from './providers/folders.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Folder } from 'src/database/folder.entity';
import { SharingModule } from 'src/sharing/sharing.module';
import { File } from 'src/database/file.entity';
import { FileVersion } from 'src/database/file-version.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Folder, File, FileVersion]), SharingModule],
  controllers: [FoldersController],
  providers: [FolderService],
  exports: [FolderService],
})
export class FoldersModule {}

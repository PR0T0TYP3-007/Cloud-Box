import { Module } from '@nestjs/common';
import { FoldersController } from './folders.controller';
import { FolderService } from './providers/folders.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Folder } from 'src/database/folder.entity';
import { SharingModule } from 'src/sharing/sharing.module';
import { File } from 'src/database/file.entity';
import { FileVersion } from 'src/database/file-version.entity';
import { Users } from 'src/database/user.entity';
import { S3StorageService } from 'src/common/s3-storage.service';

@Module({
  imports: [TypeOrmModule.forFeature([Folder, File, FileVersion, Users]), SharingModule],
  controllers: [FoldersController],
  providers: [FolderService, S3StorageService],
  exports: [FolderService],
})
export class FoldersModule {}

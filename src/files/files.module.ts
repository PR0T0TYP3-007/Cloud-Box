import { Module, forwardRef } from '@nestjs/common';
import { FilesController } from './files.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { File } from 'src/database/file.entity';
import { Folder } from 'src/database/folder.entity';
import { FileVersion } from 'src/database/file-version.entity';
import { Users } from 'src/database/user.entity';
import { FilesService } from './providers/files.service';
import { FoldersModule } from 'src/folders/folders.module';
import { SharingModule } from 'src/sharing/sharing.module';
import { ActivityModule } from 'src/activity/activity.module';
import { PreviewService } from './providers/preview.service';
import { S3StorageService } from 'src/common/s3-storage.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([File, Folder, FileVersion, Users]),
    forwardRef(() => FoldersModule),
    forwardRef(() => ActivityModule),
    SharingModule,
  ],
  controllers: [FilesController],
  providers: [FilesService, PreviewService, S3StorageService],
  exports: [FilesService, PreviewService],
})
export class FilesModule {}

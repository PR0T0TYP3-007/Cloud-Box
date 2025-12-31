import { Module, forwardRef } from '@nestjs/common';
import { FilesController } from './files.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { File } from 'src/database/file.entity';
import { Folder } from 'src/database/folder.entity';
import { FileVersion } from 'src/database/file-version.entity';
import { FilesService } from './providers/files.service';
import { FoldersModule } from 'src/folders/folders.module';
import { SharingModule } from 'src/sharing/sharing.module';

@Module({
  imports: [TypeOrmModule.forFeature([File, Folder, FileVersion]), forwardRef(() => FoldersModule), SharingModule],
  controllers: [FilesController],
  providers: [FilesService],
  exports: [FilesService],
})
export class FilesModule {}

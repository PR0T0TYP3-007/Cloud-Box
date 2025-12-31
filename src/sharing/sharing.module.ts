import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserShare } from 'src/database/user-share.entity';
import { Users } from 'src/database/user.entity';
import { File } from 'src/database/file.entity';
import { Folder } from 'src/database/folder.entity';
import { SharingService } from './providers/sharing.service';
import { SharingController } from './sharing.controller';

@Module({
  imports: [TypeOrmModule.forFeature([UserShare, Users, File, Folder])],
  providers: [SharingService],
  controllers: [SharingController],
  exports: [SharingService],
})
export class SharingModule {}

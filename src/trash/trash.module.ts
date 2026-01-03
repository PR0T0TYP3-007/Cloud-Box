import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TrashController } from './trash.controller';
import { Folder } from 'src/database/folder.entity';
import { File } from 'src/database/file.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Folder, File])],
  controllers: [TrashController],
})
export class TrashModule {}

import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { TypeOrmModule} from '@nestjs/typeorm';
import { Users } from './database/user.entity';
import { Folder } from './database/folder.entity';
import { File } from './database/file.entity';
import { FileVersion } from './database/file-version.entity';
import { Share } from './database/share.entity';
import { SyncState } from './database/sync-state.entity';
import { APP_GUARD } from '@nestjs/core';
import { JwtAuthGuard } from './auth/guards';
import { FoldersModule } from './folders/folders.module';
import { FilesModule } from './files/files.module';
import { VersionsModule } from './versions/versions.module';
import { SyncModule } from './sync/sync.module';
import { SharingModule } from './sharing/sharing.module';

@Module({
  imports: [
    AuthModule, 
    UsersModule, 
    TypeOrmModule.forRoot(
      {
        type: 'postgres',
        entities: [Users, Folder, File, FileVersion, Share, SyncState],
        synchronize: true,
        database: 'DropBoxClone',
        host: 'localhost',
        port: 5432,
        username: 'postgres',
        password: '2099'
      }
    ), FoldersModule, FilesModule, VersionsModule, SyncModule, SharingModule],
  controllers: [AppController],
  providers: [AppService, { provide: APP_GUARD, useClass: JwtAuthGuard }],
})
export class AppModule {}

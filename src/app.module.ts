import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { TypeOrmModule} from '@nestjs/typeorm';
import { Users } from './database/user.entity';
import { UserShare } from './database/user-share.entity';
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
import { TrashModule } from './trash/trash.module';
import { SearchModule } from './search/search.module';
import { ActivityModule } from './activity/activity.module';
import { ActivityLog } from './database/activity-log.entity';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    AuthModule, 
    UsersModule, 
    TypeOrmModule.forRoot(
      process.env.DATABASE_URL
        ? {
            type: 'postgres',
            url: process.env.DATABASE_URL,
            entities: [Users, Folder, File, FileVersion, Share, SyncState, UserShare, ActivityLog],
            synchronize: true,
            ssl: { rejectUnauthorized: false },
          }
        : {
            type: 'postgres',
            host: process.env.DB_HOST || 'localhost',
            port: parseInt(process.env.DB_PORT || '5432'),
            username: process.env.DB_USERNAME || 'postgres',
            password: process.env.DB_PASSWORD,
            database: process.env.DB_DATABASE || 'DropBoxClone',
            entities: [Users, Folder, File, FileVersion, Share, SyncState, UserShare, ActivityLog],
            synchronize: true,
            ssl: false,
          }
    ), FoldersModule, FilesModule, VersionsModule, SyncModule, SharingModule, TrashModule, SearchModule, ActivityModule],
  controllers: [AppController],
  providers: [AppService, { provide: APP_GUARD, useClass: JwtAuthGuard }],
})
export class AppModule {}

import { Module, forwardRef } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { UsersModule } from 'src/users/users.module';
import { AuthService } from './providers/auth.service';
import { BcryptProvider } from './providers/bcrypt.provider';
import { HashingProvider } from './providers/hashing.provider';
import { JwtModule } from '@nestjs/jwt';
import { JwtAuthGuard } from './guards';
import { FoldersModule } from 'src/folders/folders.module';
import { FilesModule } from 'src/files/files.module';
import { ActivityModule } from 'src/activity/activity.module';

@Module({
  controllers: [AuthController],
  providers: [AuthService, JwtAuthGuard, {provide: HashingProvider, useClass: BcryptProvider}],
  imports: [
    forwardRef(() => UsersModule),
    forwardRef(() => FoldersModule),
    forwardRef(() => FilesModule),
    forwardRef(() => ActivityModule),
    JwtModule.register({
      secret: process.env.JWT_SECRET ?? 'change_this_secret',
      signOptions: { expiresIn: '1h' },
    }),
  ],
  exports: [AuthService, HashingProvider, JwtModule],
})
export class AuthModule {}

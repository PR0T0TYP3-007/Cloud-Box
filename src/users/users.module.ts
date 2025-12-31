import { forwardRef, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Users } from '../database/user.entity';
import { UserService } from './providers/users.service';
import { AuthModule } from 'src/auth/auth.module';



@Module({
  imports: [TypeOrmModule.forFeature([Users]),
  forwardRef(() => AuthModule)],
  providers: [UserService],
  exports: [UserService],
})
export class UsersModule {}

import { Inject, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Users } from '../../database/user.entity';
import { UserShare } from '../../database/user-share.entity';
import { HashingProvider } from 'src/auth/providers/hashing.provider';
import { forwardRef } from '@nestjs/common';
import { DEFAULT_STORAGE_QUOTA_BYTES } from 'src/common/storage.constants';

@Injectable()
export class UserService {
  // User service methods would go here

  constructor(
    @InjectRepository(Users)
    private readonly userRepository: Repository<Users>,

    @InjectRepository(UserShare)
    private readonly userShareRepository: Repository<UserShare>,

    @Inject(forwardRef(() => HashingProvider))
    private readonly hashingProvider: HashingProvider
  ) {}

    async createUser(createUser: Partial<Users>): Promise<Users | { message: string }> {
        const isExistingUser = await this.userRepository.findOneBy({ email: createUser.email });
        if (isExistingUser) {
            return { message: 'User already exists' };
        }
        try {
            const toCreate: Partial<Users> = {
                  ...createUser,
                  password: await this.hashingProvider.hash(createUser.password as string),
                  createdAt: new Date(),
                  storageQuota: (createUser as any).storageQuota ?? DEFAULT_STORAGE_QUOTA_BYTES.toString(),
            } as Partial<Users>;
            const saved = await this.userRepository.save(this.userRepository.create(toCreate));
            return saved;
        } catch (error) {
            console.error('Error creating user:', error);
            return { message: 'Error creating user' };
        }
    }

    async findOneUser(email: string): Promise<Users | null> {

    let existingUser: Users | null = null;

    try {
      existingUser = await this.userRepository.findOneBy({ email: email });
    } catch (error) {
      console.error('Error finding user:', error);
    }

    return existingUser;
    }

    async findUserById(id: string): Promise<Users | null> {
        try {
            return await this.userRepository.findOneBy({ id });
        } catch (error) {
            console.error('Error finding user by ID:', error);
            return null;
        }
    }

    async updateUserPassword(userId: string, newPasswordHash: string): Promise<boolean> {
        try {
            await this.userRepository.update({ id: userId }, { password: newPasswordHash });
            return true;
        } catch (error) {
            console.error('Error updating password:', error);
            return false;
        }
    }

    async deleteUser(userId: string): Promise<boolean> {
        try {
            // Manually delete user shares first (both as owner and sharedWith)
            await this.userShareRepository.delete({ owner: { id: userId } });
            await this.userShareRepository.delete({ sharedWith: { id: userId } });
            
            // Now delete the user (will cascade to files, folders, etc.)
            await this.userRepository.delete({ id: userId });
            return true;
        } catch (error) {
            console.error('Error deleting user:', error);
            return false;
        }
    }
}
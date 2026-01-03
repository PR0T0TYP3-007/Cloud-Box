import { forwardRef, Injectable, UnauthorizedException, Inject, InternalServerErrorException } from '@nestjs/common';
import { UserService } from 'src/users/providers/users.service';
import { HashingProvider } from './hashing.provider';
import { SignInDto } from '../dto/sign-in.dto';
import { SignUpDto } from '../dto/sign-up.dto';
import { Users } from 'src/database/user.entity';
import { JwtService } from '@nestjs/jwt';
import { FolderService } from 'src/folders/providers/folders.service';
import { FilesService } from 'src/files/providers/files.service';

@Injectable()
export class AuthService {
    // Authentication logic
    constructor(
        @Inject(forwardRef(() => UserService))
        private readonly userService: UserService,

        @Inject(HashingProvider)
        private readonly hashingProvider: HashingProvider,

        private readonly jwtService: JwtService,

        @Inject(forwardRef(() => FolderService))
        private readonly folderService: FolderService,

        @Inject(forwardRef(() => FilesService))
        private readonly filesService: FilesService,
    ) {}

    async SignUp(signUpData: SignUpDto): Promise<Users | { message: string }> {
        const user = await this.userService.createUser(signUpData);
        if (!user || (user as any).message) return user;

        try {
          // create user root folder
          await this.folderService.createRootFolder((user as Users).id, 'root');
        } catch (err) {
          console.error('Failed to create root folder for new user:', err);
          // If we fail to create root folder, signal error so it's visible to client
          throw new InternalServerErrorException('Failed to initialize user root folder');
        }

        return user;
    }

    async validateUser(email: string, password: string): Promise<Users> {
        const user = await this.userService.findOneUser(email);
        if (!user) throw new UnauthorizedException('Invalid credentials');

        const isMatch = await this.hashingProvider.compare(password, user.password);
        if (!isMatch) throw new UnauthorizedException('Invalid credentials');

        return user;
    }

    async SignIn(signInDto: SignInDto): Promise<{ access_token: string; user: Partial<Users> }> {
        const user = await this.validateUser(signInDto.email, signInDto.password);
        const payload = { sub: user.id, email: user.email };
        const token = this.jwtService.sign(payload);
        // Remove password before returning
        const { password, ...userWithoutPassword } = user as any;
        return { access_token: token, user: userWithoutPassword };
    }

    async getUserFromPayload(payload: { sub: number; email: string }): Promise<Users | null> {
        const user = await this.userService.findOneUser(payload.email);
        return user;
    }

    async changePassword(userId: string, currentPassword: string, newPassword: string): Promise<{ success: boolean; message: string }> {
        const user = await this.userService.findUserById(userId);
        if (!user) {
            return { success: false, message: 'User not found' };
        }

        // Verify current password
        const isMatch = await this.hashingProvider.compare(currentPassword, user.password);
        if (!isMatch) {
            return { success: false, message: 'Current password is incorrect' };
        }

        // Hash new password
        const newPasswordHash = await this.hashingProvider.hash(newPassword);
        
        // Update password
        const updated = await this.userService.updateUserPassword(userId, newPasswordHash);
        if (!updated) {
            return { success: false, message: 'Failed to update password' };
        }

        return { success: true, message: 'Password changed successfully' };
    }

    async deleteAccount(userId: string, password: string): Promise<{ success: boolean; message: string }> {
        const user = await this.userService.findUserById(userId);
        if (!user) {
            return { success: false, message: 'User not found' };
        }

        // Verify password before deletion
        const isMatch = await this.hashingProvider.compare(password, user.password);
        if (!isMatch) {
            return { success: false, message: 'Incorrect password' };
        }

        try {
            // Step 1: Delete all S3 files and thumbnails for this user
            console.log(`Cleaning up S3 files for user ${userId}...`);
            const cleanupResult = await this.filesService.cleanupUserS3Files(userId);
            console.log(`S3 cleanup completed: ${cleanupResult.deletedFiles} files deleted`);
            
            if (cleanupResult.errors.length > 0) {
                console.warn(`S3 cleanup had ${cleanupResult.errors.length} errors:`, cleanupResult.errors);
                // Continue with deletion even if some S3 files failed to delete
            }

            // Step 2: Delete user (this will cascade delete all DB records: files, folders, shares, etc.)
            const deleted = await this.userService.deleteUser(userId);
            if (!deleted) {
                return { success: false, message: 'Failed to delete account from database' };
            }

            return { success: true, message: 'Account and all associated data deleted successfully' };
        } catch (error) {
            console.error('Error during account deletion:', error);
            return { success: false, message: `Failed to delete account: ${error.message}` };
        }
    }
}  
import { forwardRef, Injectable, UnauthorizedException, Inject, InternalServerErrorException } from '@nestjs/common';
import { UserService } from 'src/users/providers/users.service';
import { HashingProvider } from './hashing.provider';
import { SignInDto } from '../dto/sign-in.dto';
import { SignUpDto } from '../dto/sign-up.dto';
import { Users } from 'src/database/user.entity';
import { JwtService } from '@nestjs/jwt';
import { FolderService } from 'src/folders/providers/folders.service';

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
}  
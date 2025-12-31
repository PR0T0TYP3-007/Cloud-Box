import { Inject, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Users } from '../../database/user.entity';
import { HashingProvider } from 'src/auth/providers/hashing.provider';
import { forwardRef } from '@nestjs/common';

@Injectable()
export class UserService {
  // User service methods would go here

  constructor(
    @InjectRepository(Users)
    private readonly userRepository: Repository<Users>,

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
}
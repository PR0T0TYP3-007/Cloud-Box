import { Controller, Post, Body, HttpCode, HttpStatus, UseGuards, Get } from '@nestjs/common';
import { AuthService } from './providers/auth.service';
import { SignUpDto } from './dto/sign-up.dto';
import { SignInDto } from './dto/sign-in.dto';
import { JwtAuthGuard } from './guards';
import { CurrentUser, Public } from './decorators';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('signup')
  @Public()
  async signUp(@Body() signUpDto: SignUpDto) {
    const user = await this.authService.SignUp(signUpDto);
    // If user is an entity with a password, remove it before returning
    if (user && typeof user === 'object' && 'password' in user) {
      const u = user as any;
      delete u.password;
    }
    return user;
  }

  @HttpCode(HttpStatus.OK)
  @Post('signin')
  @Public()
  async signIn(@Body() signInDto: SignInDto) {
    const result = await this.authService.SignIn(signInDto);
    return { message: 'Authenticated', ...result };
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  async me(@CurrentUser() payload: any) {
    const user = await this.authService.getUserFromPayload(payload);
    if (user && 'password' in user) delete (user as any).password;
    return user;
  }
}

import { Controller, Post, Body, HttpCode, HttpStatus, UseGuards, Get, Res, Req, Delete } from '@nestjs/common';
import { AuthService } from './providers/auth.service';
import { FilesService } from 'src/files/providers/files.service';
import { SignUpDto } from './dto/sign-up.dto';
import { SignInDto } from './dto/sign-in.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { JwtAuthGuard } from './guards';
import { CurrentUser, Public } from './decorators';
import type { Response, Request } from 'express';
import { DEFAULT_STORAGE_QUOTA_BYTES } from 'src/common/storage.constants';
import { ActivityService } from 'src/activity/providers/activity.service';
import { ActivityAction } from 'src/database/activity-log.entity';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly filesService: FilesService,
    private readonly activityService: ActivityService,
  ) {}

  @Post('signup')
  @Public()
  async signUp(@Body() signUpDto: SignUpDto, @Res({ passthrough: true }) res: Response, @Req() req: Request) {
    const user = await this.authService.SignUp(signUpDto);
    // If signup returned an error or message object, return it (sanitized)
    if (!user || (user as any).message) {
      if (user && typeof user === 'object' && 'password' in user) delete (user as any).password;
      return user;
    }

    // On successful sign-up, automatically sign the user in and set an HttpOnly cookie
    const result = await this.authService.SignIn({ email: signUpDto.email, password: signUpDto.password });
    const token = (result as any).access_token;
    if (token) {
      res.cookie('token', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 60 * 60 * 1000,
        path: '/',
      });
    }

    // Log signup activity
    await this.activityService.logActivity({
      user: (result as any).user,
      action: ActivityAction.USER_SIGNUP,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });

    return { message: 'Authenticated', data: { user: (result as any).user } };
  }

  @HttpCode(HttpStatus.OK)
  @Post('signin')
  @Public()
  async signIn(@Body() signInDto: SignInDto, @Res({ passthrough: true }) res: Response, @Req() req: Request) {
    const result = await this.authService.SignIn(signInDto);
    const token = (result as any).access_token;
    if (token) {
      res.cookie('token', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 60 * 60 * 1000,
        path: '/',
      });
    }

    // Log login activity
    await this.activityService.logActivity({
      user: (result as any).user,
      action: ActivityAction.USER_LOGIN,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });

    return { message: 'Authenticated', data: { user: (result as any).user } };
  }

  @Post('signout')
  @UseGuards(JwtAuthGuard)
  async signOut(@Res({ passthrough: true }) res: Response, @CurrentUser() payload: any, @Req() req: Request) {
    const user = await this.authService.getUserFromPayload(payload);
    
    // Log logout activity
    if (user) {
      await this.activityService.logActivity({
        user,
        action: ActivityAction.USER_LOGOUT,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      });
    }
    
    // Clear the authentication cookie for the client
    res.clearCookie('token', { path: '/' });
    return { message: 'Signed out', data: null };
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  async me(@CurrentUser() payload: any) {
    const user = await this.authService.getUserFromPayload(payload);
    if (!user) return { message: 'OK', data: null };
    if (user && 'password' in user) delete (user as any).password;
    // compute used storage
    const used = await this.filesService.getUserUsedStorage(user.id);
    const quota = Number((user as any).storageQuota || DEFAULT_STORAGE_QUOTA_BYTES);
    return { message: 'OK', data: { ...user, storage: { used, quota } } };
  }

  @Post('change-password')
  @UseGuards(JwtAuthGuard)
  async changePassword(
    @CurrentUser() payload: any,
    @Body() changePasswordDto: ChangePasswordDto,
    @Req() req: Request,
  ) {
    const user = await this.authService.getUserFromPayload(payload);
    if (!user) {
      return { message: 'User not found', data: null };
    }

    const result = await this.authService.changePassword(
      user.id,
      changePasswordDto.currentPassword,
      changePasswordDto.newPassword,
    );

    if (result.success) {
      // Log password change activity
      await this.activityService.logActivity({
        user,
        action: ActivityAction.USER_LOGIN, // Use LOGIN as closest match or add PASSWORD_CHANGE
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
        metadata: { action: 'password_change' },
      });
    }

    return {
      message: result.message,
      data: result.success ? { success: true } : null,
    };
  }

  @Delete('account')
  @UseGuards(JwtAuthGuard)
  async deleteAccount(
    @CurrentUser() payload: any,
    @Body('password') password: string,
    @Res({ passthrough: true }) res: Response,
    @Req() req: Request,
  ) {
    const user = await this.authService.getUserFromPayload(payload);
    if (!user) {
      return { message: 'User not found', data: null };
    }

    if (!password) {
      return { message: 'Password is required', data: null };
    }

    // Log account deletion activity before deletion
    await this.activityService.logActivity({
      user,
      action: ActivityAction.USER_LOGOUT, // Use LOGOUT as closest match or add ACCOUNT_DELETE
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      metadata: { action: 'account_deletion' },
    });

    const result = await this.authService.deleteAccount(user.id, password);

    if (result.success) {
      // Clear authentication cookie
      res.clearCookie('token', { path: '/' });
    }

    return {
      message: result.message,
      data: result.success ? { success: true } : null,
    };
  }
}

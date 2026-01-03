import { Controller, Post, Body, Inject, Get, Query, Delete, Param } from '@nestjs/common';
import { SharingService } from './providers/sharing.service';
import { CurrentUser } from 'src/auth/decorators';
import { CreateShareDto } from './dtos/create-share.dto';

@Controller('shares')
export class SharingController {
  constructor(
    @Inject(SharingService)
    private readonly sharingService: SharingService,
  ) {}

  @Post()
  async createShare(@CurrentUser() user: any, @Body() body: CreateShareDto) {
    const userId = user?.sub ?? user?.id;
    const s = await this.sharingService.createShare(userId, body.itemType, body.itemId, body.email, body.permission);
    return { message: 'Shared', data: { shareId: s.id } };
  }

  @Get('shared-with-me')
  async sharedWithMe(@CurrentUser() user: any) {
    const userId = user?.sub ?? user?.id;
    const list = await this.sharingService.listSharedWithMe(userId);
    return { message: 'OK', data: list };
  }

  @Get('sent')
  async sent(@CurrentUser() user: any) {
    const userId = user?.sub ?? user?.id;
    const list = await this.sharingService.listSentShares(userId);
    return { message: 'OK', data: list };
  }

  @Delete(':id')
  async revoke(@CurrentUser() user: any, @Param('id') id: string) {
    const userId = user?.sub ?? user?.id;
    await this.sharingService.revokeShare(userId, id);
    return { message: 'Revoked', data: null };
  }
}

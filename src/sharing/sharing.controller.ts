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
    return { message: 'Shared', shareId: s.id };
  }

  @Get('shared-with-me')
  async sharedWithMe(@CurrentUser() user: any) {
    const userId = user?.sub ?? user?.id;
    return this.sharingService.listSharedWithMe(userId);
  }

  @Get('sent')
  async sent(@CurrentUser() user: any) {
    const userId = user?.sub ?? user?.id;
    return this.sharingService.listSentShares(userId);
  }

  @Delete(':id')
  async revoke(@CurrentUser() user: any, @Param('id') id: string) {
    const userId = user?.sub ?? user?.id;
    await this.sharingService.revokeShare(userId, id);
    return { message: 'Revoked' };
  }
}

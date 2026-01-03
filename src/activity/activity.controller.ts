import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards';
import { ActivityService } from './providers/activity.service';

@Controller('activity')
@UseGuards(JwtAuthGuard)
export class ActivityController {
  constructor(private readonly activityService: ActivityService) {}

  @Get()
  async getActivity(
    @Req() req: any,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    const user = req.user;
    const userId = user?.sub ?? user?.id ?? user?.userId;
    
    if (!userId) {
      return {
        message: 'Unauthorized',
        data: { logs: [], total: 0, limit: 50, offset: 0 },
      };
    }

    const parsedLimit = limit ? parseInt(limit, 10) : 50;
    const parsedOffset = offset ? parseInt(offset, 10) : 0;

    const { logs, total } = await this.activityService.getUserActivity(
      userId,
      parsedLimit,
      parsedOffset,
    );

    return {
      message: 'OK',
      data: {
        logs,
        total,
        limit: parsedLimit,
        offset: parsedOffset,
      },
    };
  }

  @Get('recent')
  async getRecentActivity(@Req() req: any, @Query('limit') limit?: string) {
    const user = req.user;
    const userId = user?.sub ?? user?.id ?? user?.userId;
    const parsedLimit = limit ? parseInt(limit, 10) : 20;

    const logs = await this.activityService.getRecentActivity(
      userId,
      parsedLimit,
    );

    return {
      message: 'OK',
      data: logs,
    };
  }
}

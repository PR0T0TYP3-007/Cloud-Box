import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ActivityLog, ActivityAction } from '../../database/activity-log.entity';
import { Users } from '../../database/user.entity';

export interface LogActivityOptions {
  user: Users;
  action: ActivityAction;
  resourceType?: string;
  resourceId?: string;
  resourceName?: string;
  metadata?: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
}

@Injectable()
export class ActivityService {
  constructor(
    @InjectRepository(ActivityLog)
    private readonly activityLogRepository: Repository<ActivityLog>,
  ) {}

  async logActivity(options: LogActivityOptions): Promise<ActivityLog> {
    const log = this.activityLogRepository.create({
      userId: options.user.id,
      action: options.action,
      resourceType: options.resourceType || null,
      resourceId: options.resourceId || null,
      resourceName: options.resourceName || null,
      metadata: options.metadata || null,
      ipAddress: options.ipAddress || null,
      userAgent: options.userAgent || null,
    });

    return await this.activityLogRepository.save(log);
  }

  async getUserActivity(
    userId: string,
    limit: number = 50,
    offset: number = 0,
  ): Promise<{ logs: ActivityLog[]; total: number }> {
    const [logs, total] = await this.activityLogRepository.findAndCount({
      where: { userId },
      order: { createdAt: 'DESC' },
      take: limit,
      skip: offset,
    });

    return { logs, total };
  }

  async getRecentActivity(
    userId: string,
    limit: number = 20,
  ): Promise<ActivityLog[]> {
    return await this.activityLogRepository.find({
      where: { userId },
      order: { createdAt: 'DESC' },
      take: limit,
    });
  }
}

import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  CreateDateColumn,
  JoinColumn,
} from 'typeorm';
import { Users } from './user.entity';

export enum ActivityAction {
  FILE_UPLOAD = 'file_upload',
  FILE_DOWNLOAD = 'file_download',
  FILE_DELETE = 'file_delete',
  FILE_RESTORE = 'file_restore',
  FILE_RENAME = 'file_rename',
  FILE_MOVE = 'file_move',
  FOLDER_CREATE = 'folder_create',
  FOLDER_DELETE = 'folder_delete',
  FOLDER_RESTORE = 'folder_restore',
  FOLDER_RENAME = 'folder_rename',
  FOLDER_MOVE = 'folder_move',
  SHARE_CREATE = 'share_create',
  SHARE_REVOKE = 'share_revoke',
  USER_LOGIN = 'user_login',
  USER_LOGOUT = 'user_logout',
  USER_SIGNUP = 'user_signup',
  BATCH_DELETE = 'batch_delete',
  BATCH_MOVE = 'batch_move',
  BATCH_RESTORE = 'batch_restore',
}

@Entity('activity_logs')
export class ActivityLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Users, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: Users;

  @Column({ type: 'uuid', name: 'user_id' })
  userId: string;

  @Column({
    type: 'enum',
    enum: ActivityAction,
  })
  action: ActivityAction;

  @Column({ type: 'varchar', length: 50, name: 'resource_type', nullable: true })
  resourceType: string | null; // 'file', 'folder', 'share'

  @Column({ type: 'uuid', name: 'resource_id', nullable: true })
  resourceId: string | null;

  @Column({ type: 'text', name: 'resource_name', nullable: true })
  resourceName: string | null;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, any> | null;

  @Column({ type: 'inet', name: 'ip_address', nullable: true })
  ipAddress: string | null;

  @Column({ type: 'text', name: 'user_agent', nullable: true })
  userAgent: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}

import { Entity, OneToOne, JoinColumn, Column, PrimaryColumn } from 'typeorm';
import { Users } from './user.entity';

@Entity({ name: 'sync_state' })
export class SyncState {
  @PrimaryColumn('uuid', { name: 'user_id' })
  userId: string;

  @OneToOne(() => Users, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: Users;

  @Column({ type: 'timestamp', nullable: true, name: 'last_sync' })
  lastSync: Date | null;
}
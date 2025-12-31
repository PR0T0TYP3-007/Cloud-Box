import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { Users } from './user.entity';

export type ItemType = 'file' | 'folder';
export type Permission = 'view' | 'edit';

@Entity({ name: 'user_shares' })
export class UserShare {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', name: 'item_id' })
  itemId: string;

  @Column({ type: 'varchar', length: 10, name: 'item_type' })
  itemType: ItemType;

  @ManyToOne(() => Users, { nullable: false })
  @JoinColumn({ name: 'owner_id' })
  owner: Users;

  @ManyToOne(() => Users, { nullable: false })
  @JoinColumn({ name: 'shared_with' })
  sharedWith: Users;

  @Column({ type: 'varchar', length: 10 })
  permission: Permission;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}

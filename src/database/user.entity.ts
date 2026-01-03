import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';
import { DEFAULT_STORAGE_QUOTA_BYTES } from 'src/common/storage.constants';

@Entity({ name: 'users' })
export class Users {

  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  email: string;

  @Column()
  password: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @Column({ type: 'bigint', name: 'storage_quota', default: DEFAULT_STORAGE_QUOTA_BYTES.toString() })
  storageQuota: string; // bytes as string

}
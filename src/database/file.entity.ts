import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';
import { Users } from './user.entity';
import { Folder } from './folder.entity';

@Entity({ name: 'files' })
@Index('idx_files_user', ['user'])
@Index('idx_files_folder', ['folder'])
@Index('ux_file_folder_name', ['folder', 'name'], { unique: true, where: '"folderId" IS NOT NULL' })
@Index('ux_file_root_user_name', ['user', 'name'], { unique: true, where: '"folderId" IS NULL' })
export class File {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Users, { nullable: false, onDelete: 'CASCADE' })
  user: Users;

  @ManyToOne(() => Folder, { nullable: true, onDelete: 'SET NULL' })
  folder: Folder | null;

  @Column({ type: 'text' })
  name: string;

  @Column({ type: 'bigint' })
  size: string; // bigints are represented as strings by TypeORM/JS

  @Column({ type: 'integer', default: 1 })
  currentVersion: number;

  @Column({ type: 'boolean', default: false })
  isDeleted: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @Column({ type: 'text', name: 'storage_path', nullable: true })
  storagePath: string | null;
}
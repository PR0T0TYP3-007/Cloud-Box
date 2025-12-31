import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, OneToMany, CreateDateColumn, Index } from 'typeorm';
import { Users } from './user.entity';

@Entity({ name: 'folders' })
@Index('idx_folders_user', ['user'])
@Index('ux_folder_parent_user_name', ['parent', 'user', 'name'], { unique: true, where: '"parentId" IS NOT NULL' })
@Index('ux_folder_root_user_name', ['user', 'name'], { unique: true, where: '"parentId" IS NULL' })
export class Folder {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Users, { nullable: false, onDelete: 'CASCADE' })
  user: Users;

  @Column({ type: 'text' })
  name: string;

  @ManyToOne(() => Folder, (folder) => folder.children, { nullable: true, onDelete: 'SET NULL' })
  parent: Folder | null;

  @OneToMany(() => Folder, (folder) => folder.parent)
  children: Folder[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
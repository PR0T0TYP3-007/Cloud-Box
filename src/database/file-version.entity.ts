import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, CreateDateColumn, Unique } from 'typeorm';
import { File } from './file.entity';

@Entity({ name: 'file_versions' })
@Unique('uq_file_version', ['file', 'version'])
export class FileVersion {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => File, { nullable: false, onDelete: 'CASCADE' })
  file: File;

  @Column({ type: 'integer' })
  version: number;

  @Column({ type: 'text' })
  storageKey: string;

  @Column({ type: 'text' })
  checksum: string;

  @Column({ type: 'bigint' })
  size: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, CreateDateColumn, Index } from 'typeorm';
import { File } from './file.entity';

@Entity({ name: 'shares' })
export class Share {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => File, { nullable: false, onDelete: 'CASCADE' })
  file: File;

  @Column({ type: 'text', unique: true })
  token: string;

  @Column({ type: 'timestamp', nullable: true })
  expiresAt: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
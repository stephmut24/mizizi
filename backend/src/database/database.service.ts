import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Database from 'better-sqlite3';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { schema } from './schema';

type SqlValue = string | number | null;

@Injectable()
export class DatabaseService implements OnModuleInit, OnModuleDestroy {
  private connection!: Database.Database;

  constructor(private readonly config: ConfigService) {}

  onModuleInit() {
    const path = this.config.getOrThrow<string>('DB_PATH');
    mkdirSync(dirname(path), { recursive: true });
    mkdirSync(this.config.getOrThrow<string>('PHOTOS_DIR'), {
      recursive: true,
    });
    this.connection = new Database(path);
    try {
      this.connection.pragma('journal_mode = WAL');
      this.connection.pragma('foreign_keys = ON');
      this.connection.transaction(() => this.connection.exec(schema))();
    } catch (error) {
      this.connection.close();
      throw error;
    }
  }

  get<T>(sql: string, ...parameters: SqlValue[]): T | undefined {
    return this.connection.prepare<SqlValue[], T>(sql).get(...parameters);
  }

  all<T>(sql: string, ...parameters: SqlValue[]): T[] {
    return this.connection.prepare<SqlValue[], T>(sql).all(...parameters);
  }

  run(sql: string, ...parameters: SqlValue[]) {
    return this.connection.prepare<SqlValue[]>(sql).run(...parameters);
  }

  onModuleDestroy() {
    if (this.connection?.open) this.connection.close();
  }
}

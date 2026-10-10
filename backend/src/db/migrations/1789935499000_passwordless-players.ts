import type { ColumnDefinitions, MigrationBuilder } from 'node-pg-migrate';

export const shorthands: ColumnDefinitions | undefined = undefined;

// Players no longer register: a `users` row is an anonymous player identified by gang name.
// Games are created by the admin, who is not a database user.
export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.alterColumn('users', 'password_hash', { notNull: false });
  pgm.addColumn('users', {
    last_seen_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
  });
  pgm.alterColumn('games', 'creator_user_id', { notNull: false });
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.alterColumn('games', 'creator_user_id', { notNull: true });
  pgm.dropColumn('users', 'last_seen_at');
  pgm.alterColumn('users', 'password_hash', { notNull: true });
}

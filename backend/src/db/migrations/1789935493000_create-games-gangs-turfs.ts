import type { ColumnDefinitions, MigrationBuilder } from 'node-pg-migrate';

export const shorthands: ColumnDefinitions | undefined = undefined;

export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.createType('game_status', ['lobby', 'active', 'finished']);

  pgm.createTable('games', {
    id: {
      type: 'uuid',
      primaryKey: true,
      default: pgm.func('gen_random_uuid()'),
    },
    creator_user_id: {
      type: 'uuid',
      notNull: true,
      references: 'users(id)',
      onDelete: 'RESTRICT',
    },
    max_players: { type: 'integer', notNull: true },
    status: { type: 'game_status', notNull: true, default: 'lobby' },
    round_number: { type: 'integer', notNull: true, default: 1 },
    current_phase: { type: 'text', notNull: true, default: 'phase1' },
    phase_deadline: { type: 'timestamptz' },
    winner_gang_id: { type: 'uuid' },
    created_at: {
      type: 'timestamptz',
      notNull: true,
      default: pgm.func('now()'),
    },
    started_at: { type: 'timestamptz' },
  });

  pgm.addConstraint('games', 'games_max_players_check', {
    check: 'max_players BETWEEN 2 AND 8',
  });

  pgm.createTable('game_members', {
    game_id: {
      type: 'uuid',
      notNull: true,
      references: 'games(id)',
      onDelete: 'CASCADE',
    },
    user_id: {
      type: 'uuid',
      notNull: true,
      references: 'users(id)',
      onDelete: 'CASCADE',
    },
    joined_at: {
      type: 'timestamptz',
      notNull: true,
      default: pgm.func('now()'),
    },
  });

  pgm.addConstraint('game_members', 'game_members_pkey', {
    primaryKey: ['game_id', 'user_id'],
  });

  pgm.createTable('gangs', {
    id: {
      type: 'uuid',
      primaryKey: true,
      default: pgm.func('gen_random_uuid()'),
    },
    game_id: {
      type: 'uuid',
      notNull: true,
      references: 'games(id)',
      onDelete: 'CASCADE',
    },
    user_id: {
      type: 'uuid',
      notNull: true,
      references: 'users(id)',
      onDelete: 'CASCADE',
    },
    name: { type: 'text', notNull: true },
    money: { type: 'integer', notNull: true, default: 10000 },
    members: { type: 'integer', notNull: true, default: 20 },
    notoriety: { type: 'integer', notNull: true, default: 0 },
    created_at: {
      type: 'timestamptz',
      notNull: true,
      default: pgm.func('now()'),
    },
  });

  pgm.addConstraint('gangs', 'gangs_game_user_unique', {
    unique: ['game_id', 'user_id'],
  });
  pgm.addConstraint('gangs', 'gangs_game_name_unique', {
    unique: ['game_id', 'name'],
  });

  pgm.createTable('turfs', {
    id: {
      type: 'uuid',
      primaryKey: true,
      default: pgm.func('gen_random_uuid()'),
    },
    game_id: {
      type: 'uuid',
      notNull: true,
      references: 'games(id)',
      onDelete: 'CASCADE',
    },
    label: { type: 'text', notNull: true },
    owner_gang_id: { type: 'uuid', references: 'gangs(id)', onDelete: 'SET NULL' },
  });

  pgm.addConstraint('turfs', 'turfs_game_label_unique', {
    unique: ['game_id', 'label'],
  });
  pgm.addConstraint('games', 'games_winner_gang_fk', {
    foreignKeys: {
      columns: 'winner_gang_id',
      references: 'gangs(id)',
      onDelete: 'SET NULL',
    },
  });
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.dropTable('turfs');
  pgm.dropTable('gangs');
  pgm.dropTable('game_members');
  pgm.dropTable('games');
  pgm.dropType('game_status');
}

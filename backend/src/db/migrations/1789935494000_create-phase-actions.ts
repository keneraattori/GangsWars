import type { ColumnDefinitions, MigrationBuilder } from 'node-pg-migrate';

export const shorthands: ColumnDefinitions | undefined = undefined;

export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.createTable('phase_actions', {
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
    round_number: { type: 'integer', notNull: true },
    phase: { type: 'text', notNull: true },
    gang_id: {
      type: 'uuid',
      notNull: true,
      references: 'gangs(id)',
      onDelete: 'CASCADE',
    },
    action: { type: 'text', notNull: true },
    target_gang_id: { type: 'uuid', references: 'gangs(id)', onDelete: 'SET NULL' },
    target_turf_id: { type: 'uuid', references: 'turfs(id)', onDelete: 'SET NULL' },
    submitted_at: {
      type: 'timestamptz',
      notNull: true,
      default: pgm.func('now()'),
    },
  });

  pgm.addConstraint('phase_actions', 'phase_actions_unique_submission', {
    unique: ['game_id', 'round_number', 'phase', 'gang_id'],
  });
  pgm.addConstraint('phase_actions', 'phase_actions_phase_check', {
    check: "phase IN ('phase1', 'phase2')",
  });
  pgm.addConstraint('phase_actions', 'phase_actions_action_check', {
    check: "action IN ('beef', 'buzinezz', 'show_off', 'attack', 'earn', 'expand', 'recruit', 'protect')",
  });
  pgm.createIndex('phase_actions', ['game_id', 'round_number', 'phase']);
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.dropTable('phase_actions');
}

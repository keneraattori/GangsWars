import type { ColumnDefinitions, MigrationBuilder } from 'node-pg-migrate';

export const shorthands: ColumnDefinitions | undefined = undefined;

export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.createTable('action_results', {
    id: {
      type: 'uuid',
      primaryKey: true,
      default: pgm.func('gen_random_uuid()'),
    },
    phase_action_id: {
      type: 'uuid',
      notNull: true,
      references: 'phase_actions(id)',
      onDelete: 'CASCADE',
    },
    roll_result: { type: 'jsonb', notNull: true, default: '{}' },
    outcome: { type: 'jsonb', notNull: true, default: '{}' },
    resolved_at: {
      type: 'timestamptz',
      notNull: true,
      default: pgm.func('now()'),
    },
  });

  pgm.addConstraint('action_results', 'action_results_phase_action_unique', {
    unique: ['phase_action_id'],
  });
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.dropTable('action_results');
}

import type { ColumnDefinitions, MigrationBuilder } from 'node-pg-migrate';

export const shorthands: ColumnDefinitions | undefined = undefined;

export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.dropConstraint('phase_actions', 'phase_actions_action_check');
  pgm.addConstraint('phase_actions', 'phase_actions_action_check', {
    check: "action IN ('beef', 'buzinezz', 'show_off', 'attack', 'earn', 'expand', 'recruit', 'protect', 'skip')",
  });
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.dropConstraint('phase_actions', 'phase_actions_action_check');
  pgm.addConstraint('phase_actions', 'phase_actions_action_check', {
    check: "action IN ('beef', 'buzinezz', 'show_off', 'attack', 'earn', 'expand', 'recruit', 'protect')",
  });
}

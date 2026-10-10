import type { ColumnDefinitions, MigrationBuilder } from 'node-pg-migrate';

export const shorthands: ColumnDefinitions | undefined = undefined;

export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.addColumn('gangs', {
    character_id: { type: 'integer' },
  });
  pgm.sql(`
    WITH ranked_gangs AS (
      SELECT id, ROW_NUMBER() OVER (PARTITION BY game_id ORDER BY created_at, id) AS character_id
      FROM gangs
    )
    UPDATE gangs SET character_id = ranked_gangs.character_id
    FROM ranked_gangs WHERE gangs.id = ranked_gangs.id
  `);
  pgm.alterColumn('gangs', 'character_id', { notNull: true });
  pgm.addConstraint('gangs', 'gangs_character_id_check', {
    check: 'character_id BETWEEN 1 AND 21',
  });
  pgm.addConstraint('gangs', 'gangs_game_character_unique', {
    unique: ['game_id', 'character_id'],
  });
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.dropColumn('gangs', 'character_id');
}
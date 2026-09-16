import { sql } from 'drizzle-orm'
import {
  boolean,
  check,
  date,
  index,
  integer,
  pgSchema,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core'

const authSchema = pgSchema('auth')
export const authUsers = authSchema.table('users', {
  id: uuid('id').primaryKey(),
})

export const teams = pgTable('teams', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  slug: text('slug').notNull().unique(),
  timezone: text('timezone').notNull().default('Europe/Berlin'),
  createdBy: uuid('created_by')
    .notNull()
    .references(() => authUsers.id),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  lastUpdatedAt: timestamp('last_updated_at', { withTimezone: true }).notNull().defaultNow(),
  lastUpdatedBy: uuid('last_updated_by').references(() => authUsers.id),
})

export const memberships = pgTable(
  'memberships',
  {
    userId: uuid('user_id')
      .notNull()
      .references(() => authUsers.id, { onDelete: 'cascade' }),
    teamId: uuid('team_id')
      .notNull()
      .references(() => teams.id, { onDelete: 'cascade' }),
    role: text('role').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.userId, t.teamId] }),
    check('memberships_role_check', sql`${t.role} in ('trainer','player')`),
    index('memberships_team_idx').on(t.teamId),
    index('memberships_user_idx').on(t.userId),
  ],
)

export const invitations = pgTable(
  'invitations',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    teamId: uuid('team_id')
      .notNull()
      .references(() => teams.id, { onDelete: 'cascade' }),
    email: text('email').notNull(),
    role: text('role').notNull(),
    token: text('token').notNull().unique(),
    invitedBy: uuid('invited_by')
      .notNull()
      .references(() => authUsers.id),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    expiresAt: timestamp('expires_at', { withTimezone: true })
      .notNull()
      .default(sql`(now() + interval '14 days')`),
    acceptedAt: timestamp('accepted_at', { withTimezone: true }),
    playerId: uuid('player_id').references(() => players.id, { onDelete: 'set null' }),
  },
  (t) => [
    check('invitations_role_check', sql`${t.role} in ('trainer','player')`),
    check('invitations_player_id_role_check', sql`${t.playerId} is null or ${t.role} = 'player'`),
    uniqueIndex('invitations_team_email_open_uniq')
      .on(t.teamId, sql`lower(${t.email})`)
      .where(sql`${t.acceptedAt} is null`),
    index('invitations_email_open_idx').on(t.email).where(sql`${t.acceptedAt} is null`),
    index('invitations_token_idx').on(t.token),
    uniqueIndex('invitations_player_open_uniq')
      .on(t.playerId)
      .where(sql`${t.acceptedAt} is null and ${t.playerId} is not null`),
  ],
)

export const userProfiles = pgTable(
  'user_profiles',
  {
    id: uuid('id')
      .primaryKey()
      .references(() => authUsers.id, { onDelete: 'cascade' }),
    displayName: text('display_name'),
    avatarPath: text('avatar_path'),
  },
  (t) => [
    check(
      'user_profiles_display_name_len_check',
      sql`length(trim(regexp_replace(${t.displayName}, '[\\u200B-\\u200D\\uFEFF]', '', 'g'))) >= 2`,
    ),
  ],
)

export const players = pgTable(
  'players',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    teamId: uuid('team_id')
      .notNull()
      .references(() => teams.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    active: boolean('active').notNull().default(true),
    jerseyNumber: integer('jersey_number'),
    position: text('position'),
    linkedUserId: uuid('linked_user_id').references(() => authUsers.id, { onDelete: 'set null' }),
    photoConsent: boolean('photo_consent').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    createdBy: uuid('created_by').references(() => authUsers.id),
    lastUpdatedAt: timestamp('last_updated_at', { withTimezone: true }).notNull().defaultNow(),
    lastUpdatedBy: uuid('last_updated_by').references(() => authUsers.id),
  },
  (t) => [
    uniqueIndex('players_active_jersey_per_team_uniq')
      .on(t.teamId, t.jerseyNumber)
      .where(sql`${t.active} = true and ${t.jerseyNumber} is not null`),
    uniqueIndex('players_linked_user_per_team_uniq')
      .on(t.teamId, t.linkedUserId)
      .where(sql`${t.linkedUserId} is not null`),
    index('players_team_idx').on(t.teamId),
  ],
)

export const pointCategories = pgTable(
  'point_categories',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    teamId: uuid('team_id')
      .notNull()
      .references(() => teams.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    active: boolean('active').notNull().default(true),
    sortOrder: integer('sort_order').notNull(),
    valueMin: integer('value_min').notNull(),
    valueMax: integer('value_max').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    createdBy: uuid('created_by').references(() => authUsers.id),
    lastUpdatedAt: timestamp('last_updated_at', { withTimezone: true }).notNull().defaultNow(),
    lastUpdatedBy: uuid('last_updated_by').references(() => authUsers.id),
  },
  (t) => [
    check('point_categories_range_check', sql`${t.valueMax} >= ${t.valueMin}`),
    uniqueIndex('point_categories_team_name_uniq').on(t.teamId, t.name),
    index('point_categories_team_active_sort_idx').on(t.teamId, t.active, t.sortOrder),
  ],
)

export const trainings = pgTable(
  'trainings',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    teamId: uuid('team_id')
      .notNull()
      .references(() => teams.id, { onDelete: 'cascade' }),
    date: date('date').notNull(),
    title: text('title'),
    note: text('note'),
    status: text('status').notNull().default('draft'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    createdBy: uuid('created_by').references(() => authUsers.id),
    lastUpdatedAt: timestamp('last_updated_at', { withTimezone: true }).notNull().defaultNow(),
    lastUpdatedBy: uuid('last_updated_by').references(() => authUsers.id),
  },
  (t) => [
    // Future-date validation is enforced by the database trigger using the
    // team's configured IANA timezone; a cross-table CHECK cannot do that
    // without reintroducing a global UTC-based boundary.
    check('trainings_status_check', sql`${t.status} in ('draft','saved')`),
    index('trainings_team_date_idx').on(t.teamId, t.date.desc()),
  ],
)

export const trainingPhotos = pgTable(
  'training_photos',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    trainingId: uuid('training_id')
      .notNull()
      .references(() => trainings.id, { onDelete: 'cascade' }),
    storagePath: text('storage_path').notNull().unique(),
    contentType: text('content_type').notNull(),
    sizeBytes: integer('size_bytes').notNull(),
    uploadedBy: uuid('uploaded_by')
      .notNull()
      .references(() => authUsers.id),
    uploadedAt: timestamp('uploaded_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    check(
      'training_photos_content_type_check',
      sql`${t.contentType} in ('image/jpeg','image/png','image/heic','image/heif','image/webp')`,
    ),
    check(
      'training_photos_size_check',
      sql`${t.sizeBytes} > 0 and ${t.sizeBytes} <= 10485760`,
    ),
    index('training_photos_training_idx').on(t.trainingId),
  ],
)

export const pointEntries = pgTable(
  'point_entries',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    trainingId: uuid('training_id')
      .notNull()
      .references(() => trainings.id, { onDelete: 'cascade' }),
    playerId: uuid('player_id')
      .notNull()
      .references(() => players.id, { onDelete: 'restrict' }),
    categoryId: uuid('category_id')
      .notNull()
      .references(() => pointCategories.id, { onDelete: 'restrict' }),
    value: integer('value').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    createdBy: uuid('created_by').references(() => authUsers.id),
    lastUpdatedAt: timestamp('last_updated_at', { withTimezone: true }).notNull().defaultNow(),
    lastUpdatedBy: uuid('last_updated_by').references(() => authUsers.id),
  },
  (t) => [
    uniqueIndex('point_entries_training_player_category_uniq').on(
      t.trainingId,
      t.playerId,
      t.categoryId,
    ),
    index('point_entries_training_idx').on(t.trainingId),
    index('point_entries_player_idx').on(t.playerId),
  ],
)

export const teamSettings = pgTable('team_settings', {
  teamId: uuid('team_id')
    .primaryKey()
    .references(() => teams.id, { onDelete: 'cascade' }),
  seasonStart: date('season_start')
    .notNull()
    .default(sql`date_trunc('year', current_date)::date`),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  updatedBy: uuid('updated_by').references(() => authUsers.id),
})

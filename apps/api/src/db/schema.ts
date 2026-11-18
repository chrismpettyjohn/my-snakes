import {CollectionColor, CollectionIcon, DeviceKind, HomeRole, LogEventType, Sex, WebhookProviderName, type SensorRole} from '@snake/shared';
import {
  pgTable,
  pgMaterializedView,
  uuid,
  text,
  timestamp,
  doublePrecision,
  integer,
  date,
  jsonb,
  primaryKey,
  index,
  uniqueIndex,
  pgEnum,
} from 'drizzle-orm/pg-core';

const id = () => uuid('id').primaryKey().defaultRandom();
const createdAt = () => timestamp('created_at', {withTimezone: true}).notNull().defaultNow();

export const homeRole = pgEnum('home_role', HomeRole.options);
export const sex = pgEnum('sex', Sex.options);
export const deviceKind = pgEnum('device_kind', DeviceKind.options);
export const logType = pgEnum('log_type', LogEventType.options);
export const webhookProvider = pgEnum('webhook_provider', WebhookProviderName.options);

export const users = pgTable('users', {
  id: id(),
  discordId: text('discord_id').unique(),
  username: text('username'),
  email: text('email').notNull().unique(),
  displayName: text('display_name').notNull(),
  avatar: text('avatar'),
  discordAccessTokenEnc: text('discord_access_token_enc'),
  discordRefreshTokenEnc: text('discord_refresh_token_enc'),
  discordTokenExpiresAt: timestamp('discord_token_expires_at', {withTimezone: true}),
  goveeApiKeyEnc: text('govee_api_key_enc'),
  goveeAccountEmail: text('govee_account_email'),
  goveeLastSyncAt: timestamp('govee_last_sync_at', {withTimezone: true}),
  goveeLastError: text('govee_last_error'),
  createdAt: createdAt(),
});

export const homes = pgTable('homes', {
  id: id(),
  name: text('name').notNull(),
  icon: text('icon').$type<CollectionIcon>().notNull().default('house'),
  color: text('color').$type<CollectionColor>().notNull().default('indigo'),
  createdAt: createdAt(),
});

export const homeMembers = pgTable(
  'home_members',
  {
    homeId: uuid('home_id')
      .notNull()
      .references(() => homes.id, {onDelete: 'cascade'}),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, {onDelete: 'cascade'}),
    role: homeRole('role').notNull().default('member'),
    createdAt: createdAt(),
  },
  t => [primaryKey({columns: [t.homeId, t.userId]})],
);

export const snakes = pgTable(
  'snakes',
  {
    id: id(),
    homeId: uuid('home_id')
      .notNull()
      .references(() => homes.id, {onDelete: 'cascade'}),
    name: text('name').notNull(),
    species: text('species'),
    morph: text('morph'),
    sex: sex('sex').notNull().default('unknown'),
    hatchDate: date('hatch_date'),
    notes: text('notes'),
    photo: text('photo'),
    minTempF: doublePrecision('min_temp_f'),
    maxTempF: doublePrecision('max_temp_f'),
    minHumidity: doublePrecision('min_humidity'),
    maxHumidity: doublePrecision('max_humidity'),
    position: integer('position').notNull().default(0),
    createdAt: createdAt(),
  },
  t => [index('snakes_home_idx').on(t.homeId)],
);

export const snakeLogs = pgTable(
  'snake_logs',
  {
    id: id(),
    snakeId: uuid('snake_id')
      .notNull()
      .references(() => snakes.id, {onDelete: 'cascade'}),
    userId: uuid('user_id').references(() => users.id, {onDelete: 'set null'}),
    type: logType('type').notNull(),
    at: timestamp('at', {withTimezone: true}).notNull().defaultNow(),
    value: doublePrecision('value'),
    notes: text('notes'),
  },
  t => [index('snake_logs_snake_at_idx').on(t.snakeId, t.at)],
);

export const devices = pgTable(
  'devices',
  {
    id: id(),
    ownerId: uuid('owner_id')
      .notNull()
      .references(() => users.id, {onDelete: 'cascade'}),
    kind: deviceKind('kind').notNull(),
    name: text('name').notNull(),
    externalId: text('external_id'),
    model: text('model'),
    firmware: text('firmware'),
    lastError: text('last_error'),
    channelLabels: jsonb('channel_labels').$type<Record<string, string>>(),
    lastSeenAt: timestamp('last_seen_at', {withTimezone: true}),
    createdAt: createdAt(),
  },
  t => [index('devices_owner_idx').on(t.ownerId), uniqueIndex('devices_owner_kind_ext_idx').on(t.ownerId, t.kind, t.externalId)],
);

export const bridges = pgTable(
  'bridges',
  {
    id: id(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, {onDelete: 'cascade'}),
    tokenHash: text('token_hash').notNull().unique(),
    hostname: text('hostname'),
    lastSeenAt: timestamp('last_seen_at', {withTimezone: true}),
    createdAt: createdAt(),
  },
  t => [index('bridges_user_idx').on(t.userId)],
);

export const webhooks = pgTable(
  'webhooks',
  {
    id: id(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, {onDelete: 'cascade'}),
    deviceId: uuid('device_id')
      .notNull()
      .references(() => devices.id, {onDelete: 'cascade'}),
    provider: webhookProvider('provider').notNull(),
    apiKey: text('api_key').notNull().unique(),
    lastReceivedAt: timestamp('last_received_at', {withTimezone: true}),
    createdAt: createdAt(),
  },
  t => [index('webhooks_device_idx').on(t.deviceId), index('webhooks_user_idx').on(t.userId)],
);

export const snakeSensors = pgTable(
  'snake_sensors',
  {
    snakeId: uuid('snake_id')
      .notNull()
      .references(() => snakes.id, {onDelete: 'cascade'}),
    deviceId: uuid('device_id')
      .notNull()
      .references(() => devices.id, {onDelete: 'cascade'}),
    channel: text('channel').notNull(),
    role: text('role').$type<SensorRole>(),
  },
  t => [primaryKey({columns: [t.snakeId, t.deviceId, t.channel]}), index('snake_sensors_device_idx').on(t.deviceId, t.channel)],
);

export const readings = pgTable(
  'readings',
  {
    deviceId: uuid('device_id')
      .notNull()
      .references(() => devices.id, {onDelete: 'cascade'}),
    channel: text('channel').notNull(),
    metric: text('metric').notNull(),
    value: doublePrecision('value').notNull(),
    at: timestamp('at', {withTimezone: true}).notNull().defaultNow(),
  },
  t => [index('readings_device_at_idx').on(t.deviceId, t.at)],
);

export const readings5m = pgMaterializedView('readings_5m', {
  deviceId: uuid('device_id').notNull(),
  channel: text('channel').notNull(),
  metric: text('metric').notNull(),
  bucket: timestamp('bucket', {withTimezone: true}).notNull(),
  avg: doublePrecision('avg').notNull(),
  min: doublePrecision('min').notNull(),
  max: doublePrecision('max').notNull(),
}).existing();

export const rawUploads = pgTable('raw_uploads', {
  id: id(),
  deviceId: uuid('device_id').references(() => devices.id, {onDelete: 'cascade'}),
  contentType: text('content_type'),
  headers: jsonb('headers'),
  body: text('body').notNull(),
  receivedAt: timestamp('received_at', {withTimezone: true}).notNull().defaultNow(),
});

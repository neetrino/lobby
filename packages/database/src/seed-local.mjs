import { createRequire } from 'node:module';

import pg from 'pg';

const LOCAL_DATABASE_URL = 'postgresql://lobby:lobby@127.0.0.1:54329/lobby';
const RESERVATIONS_ONLY = process.env.SEED_RESERVATIONS_ONLY === 'true';
const DATABASE_URL = RESERVATIONS_ONLY ? process.env.DIRECT_URL : LOCAL_DATABASE_URL;
const TENANT_SUBDOMAIN = 'yerevan-mall';
const TENANT_NAME = 'Երևան Մոլ';
const OWNER_EMAIL = 'owner@yerevan-mall.test';
const RESERVATION_TENANT_SUBDOMAIN =
  process.env.SEED_RESERVATION_TENANT_SUBDOMAIN ?? TENANT_SUBDOMAIN;
const OWNER_NAME = 'Արմեն Ղազարյան';
const PASSWORD_MIN_LENGTH = 12;
const PASSWORD_MAX_LENGTH = 128;

const requireApi = createRequire(new URL('../../../apps/api/package.json', import.meta.url));
const argon2 = requireApi('argon2');

const contacts = [
  ['Աննա Հակոբյան', 'PERSON', 'anna.hakobyan@example.test', '+37491111001', false],
  ['Արամ Պետրոսյան', 'PERSON', 'aram.petrosyan@example.test', '+37491111002', false],
  ['Մարիամ Սարգսյան', 'PERSON', 'mariam.sargsyan@example.test', '+37491111003', false],
  ['Գոռ Ավետիսյան', 'PERSON', 'gor.avetisyan@example.test', '+37493111004', false],
  ['Նարե Գրիգորյան', 'PERSON', 'nare.grigoryan@example.test', '+37494111005', false],
  ['Տիգրան Մկրտչյան', 'PERSON', 'tigran.mkrtchyan@example.test', '+37495111006', false],
  ['Լիլիթ Կարապետյան', 'PERSON', 'lilit.karapetyan@example.test', '+37496111007', false],
  ['Հայկ Վարդանյան', 'PERSON', 'hayk.vardanyan@example.test', '+37497111008', false],
  ['Սոնա Մանուկյան', 'PERSON', 'sona.manukyan@example.test', '+37498111009', false],
  ['Դավիթ Հարությունյան', 'PERSON', 'davit.harutyunyan@example.test', '+37499111010', false],
  ['Երևան Մոլ ՍՊԸ', 'ORGANIZATION', 'office@yerevan-mall.example.test', '+37410555001', false],
  ['Արարատ Բանկ', 'ORGANIZATION', 'hello@ararat-bank.example.test', '+37410555002', false],
  ['Լուսինե Դավթյան', 'PERSON', 'lusine.davtyan@example.test', '+37491111011', true],
  ['Արմենակ Մովսիսյան', 'PERSON', 'armenak.movsisyan@example.test', '+37491111012', true],
  ['Հին Հաճախորդ ՍՊԸ', 'ORGANIZATION', 'archive@old-customer.example.test', '+37410555003', true],
];

assertSeedTarget(DATABASE_URL);
await seedLocalLobby();

function assertSeedTarget(connectionString) {
  if (connectionString === undefined || connectionString.length === 0) {
    throw new Error('DIRECT_URL is required for reservation-only seed.');
  }
  const url = new URL(connectionString);
  const localHost = url.hostname === '127.0.0.1' && url.port === '54329';
  if (!RESERVATIONS_ONLY && (!localHost || url.pathname !== '/lobby')) {
    throw new Error('Seed runs only against the local lobby database.');
  }
  if (
    RESERVATIONS_ONLY &&
    (process.env.SEED_RESERVATION_TENANT_SUBDOMAIN === undefined ||
      process.env.ALLOW_REMOTE_RESERVATION_SEED !== RESERVATION_TENANT_SUBDOMAIN)
  ) {
    throw new Error(
      'Remote reservation seed requires matching SEED_RESERVATION_TENANT_SUBDOMAIN and ALLOW_REMOTE_RESERVATION_SEED.',
    );
  }
}

async function seedLocalLobby() {
  const client = new pg.Client({ connectionString: DATABASE_URL });
  await client.connect();
  try {
    await client.query('BEGIN');
    if (RESERVATIONS_ONLY) {
      const reservationTenant = await requireReservationTenant(client);
      await ensureReservationsModule(client, reservationTenant.tenantId);
      const reservationCount = await seedReservations(
        client,
        reservationTenant.tenantId,
        reservationTenant.ownerId,
      );
      await client.query('COMMIT');
      console.log(
        JSON.stringify({
          reservationTenant: RESERVATION_TENANT_SUBDOMAIN,
          reservationsSeeded: reservationCount,
        }),
      );
      return;
    }
    const tenantId = await ensureTenant(client);
    const ownerId = await ensureOwner(client, tenantId);
    await ensureContactsModule(client, tenantId);
    const inserted = await insertContacts(client, tenantId, ownerId);
    const reservationTenant = await requireReservationTenant(client);
    await ensureReservationsModule(client, reservationTenant.tenantId);
    const reservationCount = await seedReservations(
      client,
      reservationTenant.tenantId,
      reservationTenant.ownerId,
    );
    await client.query('COMMIT');
    console.log(
      JSON.stringify({
        subdomain: TENANT_SUBDOMAIN,
        ownerEmail: OWNER_EMAIL,
        contactsInserted: inserted,
        reservationTenant: RESERVATION_TENANT_SUBDOMAIN,
        reservationsSeeded: reservationCount,
      }),
    );
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    await client.end();
  }
}

async function requireReservationTenant(client) {
  const result = await client.query(
    `SELECT t.id AS tenant_id, u.id AS owner_id
       FROM tenants t
       JOIN users u ON u.tenant_id = t.id
      WHERE t.subdomain = $1 AND u.role = 'OWNER' AND u.status = 'ACTIVE'
      ORDER BY u.created_at
      LIMIT 1`,
    [RESERVATION_TENANT_SUBDOMAIN],
  );
  if (result.rowCount === 0) {
    throw new Error(`Active Owner not found for ${RESERVATION_TENANT_SUBDOMAIN}.`);
  }
  return { tenantId: result.rows[0].tenant_id, ownerId: result.rows[0].owner_id };
}

async function ensureTenant(client) {
  const result = await client.query(
    `INSERT INTO tenants (name, subdomain, plan)
     VALUES ($1, $2, 'starter')
     ON CONFLICT (subdomain) DO UPDATE SET name = EXCLUDED.name
     RETURNING id`,
    [TENANT_NAME, TENANT_SUBDOMAIN],
  );
  return result.rows[0].id;
}

async function ensureOwner(client, tenantId) {
  const existing = await client.query(`SELECT id FROM users WHERE tenant_id = $1 AND email = $2`, [
    tenantId,
    OWNER_EMAIL,
  ]);
  if (existing.rowCount > 0) {
    return existing.rows[0].id;
  }
  const passwordHash = await hashOwnerPassword();
  const created = await client.query(
    `INSERT INTO users (tenant_id, email, name, password_hash, role)
     VALUES ($1, $2, $3, $4, 'OWNER')
     RETURNING id`,
    [tenantId, OWNER_EMAIL, OWNER_NAME, passwordHash],
  );
  return created.rows[0].id;
}

async function hashOwnerPassword() {
  const password = process.env.SEED_OWNER_PASSWORD ?? '';
  const length = password.length;
  if (length < PASSWORD_MIN_LENGTH || length > PASSWORD_MAX_LENGTH) {
    throw new Error('SEED_OWNER_PASSWORD must be 12 to 128 characters.');
  }
  return argon2.hash(password, {
    type: argon2.argon2id,
    memoryCost: 19_456,
    timeCost: 2,
    parallelism: 1,
    hashLength: 32,
  });
}

async function ensureContactsModule(client, tenantId) {
  await client.query(
    `INSERT INTO tenant_modules (tenant_id, module_key, status, updated_at)
     VALUES ($1, 'contacts', 'ENABLED', now())
     ON CONFLICT (tenant_id, module_key)
     DO UPDATE SET status = 'ENABLED', updated_at = now()`,
    [tenantId],
  );
}

async function ensureReservationsModule(client, tenantId) {
  await client.query(
    `INSERT INTO tenant_modules (tenant_id, module_key, status, updated_at)
     VALUES ($1, 'reservations', 'ENABLED', now())
     ON CONFLICT (tenant_id, module_key)
     DO UPDATE SET status = 'ENABLED', updated_at = now()`,
    [tenantId],
  );
}

async function insertContacts(client, tenantId, ownerId) {
  let inserted = 0;
  for (const contact of contacts) {
    const created = await client.query(
      `INSERT INTO contacts (
         tenant_id, name, type, email, phone, archived_at, created_by_user_id, owner_user_id
       )
       VALUES ($1, $2, $3, $4, $5, CASE WHEN $6 THEN now() ELSE NULL END, $7, $7)
       ON CONFLICT (tenant_id, email) DO NOTHING`,
      [tenantId, contact[0], contact[1], contact[2], contact[3], contact[4], ownerId],
    );
    inserted += created.rowCount;
  }
  return inserted;
}

async function seedReservations(client, tenantId, ownerId) {
  const location = await client.query(
    `INSERT INTO reservation_locations (tenant_id, name, timezone, address, updated_at)
     VALUES ($1, 'Lobby Restaurant', 'Asia/Yerevan', 'Yerevan Mall', now())
     ON CONFLICT (tenant_id, name)
     DO UPDATE SET timezone = EXCLUDED.timezone, address = EXCLUDED.address,
                   status = 'ACTIVE', updated_at = now()
     RETURNING id`,
    [tenantId],
  );
  const locationId = location.rows[0].id;

  for (let weekday = 0; weekday <= 6; weekday += 1) {
    await client.query(
      `INSERT INTO reservation_working_hours (
         tenant_id, location_id, weekday, opens_at, closes_at, is_closed
       ) VALUES ($1, $2, $3, TIME '10:00', TIME '23:00', false)
       ON CONFLICT (tenant_id, location_id, weekday)
       DO UPDATE SET opens_at = EXCLUDED.opens_at, closes_at = EXCLUDED.closes_at,
                     is_closed = false`,
      [tenantId, locationId, weekday],
    );
  }

  const tableIds = new Map();
  for (const [name, minCapacity, capacity] of [
    ['A1', 1, 2],
    ['A2', 1, 4],
    ['B1', 2, 6],
    ['Family 1', 4, 8],
  ]) {
    const table = await client.query(
      `INSERT INTO reservation_tables (
         tenant_id, location_id, name, min_capacity, capacity, status, archived_at, updated_at
       ) VALUES ($1, $2, $3, $4, $5, 'ACTIVE', NULL, now())
       ON CONFLICT (tenant_id, location_id, name)
       DO UPDATE SET min_capacity = EXCLUDED.min_capacity, capacity = EXCLUDED.capacity,
                     status = 'ACTIVE', archived_at = NULL, updated_at = now()
       RETURNING id`,
      [tenantId, locationId, name, minCapacity, capacity],
    );
    tableIds.set(name, table.rows[0].id);
  }

  const contactRows = await client.query(
    `SELECT id, name, email, phone
       FROM contacts
      WHERE tenant_id = $1 AND archived_at IS NULL
      ORDER BY created_at, id
      LIMIT 8`,
    [tenantId],
  );
  if (contactRows.rowCount < 7) {
    throw new Error('Reservation seed requires at least seven active local contacts.');
  }

  const samples = [
    ['reservation-1', 1, 12, 0, 60, 'PENDING', 'PHONE', 'A2', 2],
    ['reservation-2', 1, 14, 0, 90, 'CONFIRMED', 'WEBSITE', 'B1', 4],
    ['reservation-3', 1, 18, 30, 60, 'CONFIRMED', 'INSTAGRAM', 'A1', 2],
    ['reservation-4', 2, 13, 0, 120, 'PENDING', 'WHATSAPP', 'Family 1', 6],
    ['reservation-5', 2, 19, 0, 60, 'CANCELLED', 'PHONE', 'A2', 3],
    ['reservation-6', -1, 17, 0, 90, 'COMPLETED', 'WALK_IN', 'B1', 5],
    ['reservation-7', -1, 20, 0, 60, 'NO_SHOW', 'WEBSITE', 'A1', 2],
    ['today-1', 0, 12, 0, 60, 'PENDING', 'PHONE', 'A2', 2],
    ['today-2', 0, 13, 0, 90, 'CONFIRMED', 'WEBSITE', 'B1', 4],
    ['today-3', 0, 18, 30, 60, 'CONFIRMED', 'INSTAGRAM', 'A1', 2],
    ['today-4', 0, 19, 0, 120, 'SEATED', 'WALK_IN', 'Family 1', 6],
    ['today-5', 0, 20, 30, 60, 'ARRIVED', 'WHATSAPP', 'A1', 2],
  ];
  const octoberNinthStatuses = ['COMPLETED', 'CONFIRMED', 'PENDING', 'CANCELLED', 'NO_SHOW'];
  const octoberNinthTables = [
    ['A1', 2],
    ['A2', 3],
    ['B1', 4],
    ['Family 1', 6],
  ];
  for (let tableIndex = 0; tableIndex < octoberNinthTables.length; tableIndex += 1) {
    const [tableName, guests] = octoberNinthTables[tableIndex];
    for (let slot = 0; slot < 5; slot += 1) {
      const number = tableIndex * 5 + slot + 1;
      samples.push([
        `october-09-${String(number).padStart(2, '0')}`,
        '2026-10-09',
        10 + slot * 2,
        0,
        60,
        octoberNinthStatuses[slot],
        slot % 2 === 0 ? 'PHONE' : 'WEBSITE',
        tableName,
        guests,
      ]);
    }
  }

  for (let index = 0; index < samples.length; index += 1) {
    const [marker, dayOrDate, hour, minute, duration, status, source, tableName, guests] =
      samples[index];
    const contact = contactRows.rows[index % contactRows.rows.length];
    const startsAt = reservationStart(dayOrDate, hour, minute);
    const endsAt = new Date(startsAt.getTime() + duration * 60_000);
    const statusTime = statusTimestamp(status, startsAt);
    const values = [
      tenantId,
      locationId,
      tableIds.get(tableName),
      contact.id,
      ownerId,
      status,
      source,
      guests,
      startsAt,
      endsAt,
      contact.name,
      contact.phone,
      contact.email,
      index % 2 === 0 ? 'Window seat preferred.' : null,
      `local-seed:${marker}`,
      statusTime.confirmedAt,
      statusTime.completedAt,
      statusTime.cancelledAt,
    ];
    const existing = await client.query(
      `UPDATE reservations
            SET location_id = $2, table_id = $3, contact_id = $4,
                assigned_user_id = $5, created_by_user_id = $5, status = $6,
                source = $7, guest_count = $8, starts_at = $9, ends_at = $10,
                customer_name = $11, customer_phone = $12, customer_email = $13,
                customer_note = $14, confirmed_at = $16, completed_at = $17,
                cancelled_at = $18, updated_at = now()
          WHERE tenant_id = $1 AND internal_note = $15
          RETURNING id`,
      values,
    );

    let reservationId = existing.rows[0]?.id;
    if (reservationId === undefined) {
      const inserted = await client.query(
        `INSERT INTO reservations (
           tenant_id, location_id, table_id, contact_id, assigned_user_id, created_by_user_id,
           status, source, guest_count, starts_at, ends_at, customer_name, customer_phone,
           customer_email, customer_note, internal_note, confirmed_at, completed_at,
           cancelled_at, updated_at
         ) VALUES (
           $1, $2, $3, $4, $5, $5, $6, $7, $8, $9, $10, $11, $12, $13,
           $14, $15, $16, $17, $18, now()
         )
         RETURNING id`,
        values,
      );
      reservationId = inserted.rows[0]?.id;
    }
    if (reservationId === undefined) {
      throw new Error(`Could not seed ${marker}.`);
    }
    await ensureInitialReservationHistory(client, tenantId, reservationId, ownerId, status);
  }
  const seeded = await client.query(
    `SELECT count(*)::int AS count
       FROM reservations
      WHERE tenant_id = $1 AND internal_note LIKE 'local-seed:%'`,
    [tenantId],
  );
  return seeded.rows[0].count;
}

function reservationStart(dayOrDate, hour, minute) {
  if (typeof dayOrDate === 'string') {
    return new Date(
      `${dayOrDate}T${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:00+04:00`,
    );
  }
  const now = new Date();
  const yerevanOffsetMs = 4 * 60 * 60_000;
  const local = new Date(now.getTime() + yerevanOffsetMs);
  const utc = Date.UTC(
    local.getUTCFullYear(),
    local.getUTCMonth(),
    local.getUTCDate() + dayOrDate,
    hour - 4,
    minute,
  );
  return new Date(utc);
}

function statusTimestamp(status, startsAt) {
  const timestamp = new Date(Math.min(Date.now(), startsAt.getTime() - 60 * 60_000));
  return {
    confirmedAt: ['CONFIRMED', 'COMPLETED', 'CANCELLED'].includes(status) ? timestamp : null,
    completedAt: status === 'COMPLETED' ? timestamp : null,
    cancelledAt: status === 'CANCELLED' ? timestamp : null,
  };
}

async function ensureInitialReservationHistory(client, tenantId, reservationId, ownerId, status) {
  const existing = await client.query(
    `SELECT id FROM reservation_status_history
      WHERE tenant_id = $1 AND reservation_id = $2
      LIMIT 1`,
    [tenantId, reservationId],
  );
  if (existing.rowCount === 0) {
    await client.query(
      `INSERT INTO reservation_status_history (
         tenant_id, reservation_id, from_status, to_status, changed_by_user_id, reason
       ) VALUES ($1, $2, NULL, $3, $4, 'Local development seed')`,
      [tenantId, reservationId, status, ownerId],
    );
  }
}

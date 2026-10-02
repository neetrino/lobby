import { createRequire } from 'node:module';

import pg from 'pg';

const LOCAL_DATABASE_URL = 'postgresql://lobby:lobby@127.0.0.1:54329/lobby';
const TENANT_SUBDOMAIN = 'yerevan-mall';
const TENANT_NAME = 'Երևան Մոլ';
const OWNER_EMAIL = 'owner@yerevan-mall.test';
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

assertLocalDatabase(LOCAL_DATABASE_URL);
await seedLocalLobby();

function assertLocalDatabase(connectionString) {
  const url = new URL(connectionString);
  const localHost = url.hostname === '127.0.0.1' && url.port === '54329';
  if (!localHost || url.pathname !== '/lobby') {
    throw new Error('Seed runs only against the local lobby database.');
  }
}

async function seedLocalLobby() {
  const client = new pg.Client({ connectionString: LOCAL_DATABASE_URL });
  await client.connect();
  try {
    await client.query('BEGIN');
    const tenantId = await ensureTenant(client);
    const ownerId = await ensureOwner(client, tenantId);
    await ensureContactsModule(client, tenantId);
    const inserted = await insertContacts(client, tenantId, ownerId);
    await client.query('COMMIT');
    console.log(
      JSON.stringify({
        subdomain: TENANT_SUBDOMAIN,
        ownerEmail: OWNER_EMAIL,
        contactsInserted: inserted,
      }),
    );
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    await client.end();
  }
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

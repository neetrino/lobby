import pg from 'pg';

const names = ['lobby', 'lobby_outbox_test', 'lobby_outbox_api_test', 'lobby_outbox_worker_test'];

for (const db of names) {
  const client = new pg.Client({
    connectionString: `postgresql://lobby:lobby@127.0.0.1:54329/${db}`,
  });
  try {
    await client.connect();
    const result = await client.query(
      "SELECT indexname FROM pg_indexes WHERE tablename = 'audit_events' AND indexname LIKE 'audit_events_tenant_id_occurred_at%' ORDER BY indexname",
    );
    const found = result.rows.map((row) => row.indexname).join(',') || '(none)';
    console.log(`${db} ${found}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'unknown';
    console.log(`${db} ERROR ${message}`);
  } finally {
    await client.end().catch(() => undefined);
  }
}

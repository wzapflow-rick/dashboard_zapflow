const { Pool } = require('pg');

const pool = new Pool({
  connectionString: 'postgres://postgres:RiquelmoBarbosaSantos147258369RiquelmoBarbosaSantos147258369RiquelmoBarbosaSantos147258369@127.0.0.1:5433/chatwoot?sslmode=disable'
});

async function main() {
  try {
    // List all tables
    const tables = await pool.query(
      `SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename`
    );
    console.log('=== TABLES ===');
    console.log(JSON.stringify(tables.rows, null, 2));

    // Check if 'usuarios' table exists
    const hasUsuarios = tables.rows.some(r => r.tablename === 'usuarios');
    console.log('\nusuarios table exists:', hasUsuarios);

    // Check if 'empresas' table has relevant columns
    if (tables.rows.some(r => r.tablename === 'empresas')) {
      const cols = await pool.query(
        `SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'empresas' ORDER BY ordinal_position`
      );
      console.log('\n=== empresas columns ===');
      console.log(JSON.stringify(cols.rows, null, 2));
    }

    // Check if 'pedidos' table has relevant columns
    if (tables.rows.some(r => r.tablename === 'pedidos')) {
      const cols = await pool.query(
        `SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'pedidos' ORDER BY ordinal_position`
      );
      console.log('\n=== pedidos columns ===');
      console.log(JSON.stringify(cols.rows, null, 2));
    }

    // Check all tables for their columns
    for (const row of tables.rows) {
      const cols = await pool.query(
        `SELECT column_name, data_type FROM information_schema.columns WHERE table_name = '${row.tablename}' ORDER BY ordinal_position`
      );
      console.log(`\n=== ${row.tablename} columns ===`);
      console.log(JSON.stringify(cols.rows, null, 2));
    }

  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    await pool.end();
  }
}

main();

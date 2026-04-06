const https = require('https');

const NOCODB_URL = 'https://db.wzapflow.com.br';
const TOKEN = '4t4xFeIH5k5sn_ZFOQ_qkdliCrhhggtmYBmYXoOw';
const USUARIOS_TABLE_ID = 'm5behpuvxirbb3r';

function apiGet(path) {
  return new Promise((resolve) => {
    const url = new URL(path, NOCODB_URL);
    const options = {
      hostname: url.hostname,
      path: url.pathname + (url.search || ''),
      method: 'GET',
      headers: {
        'xc-token': TOKEN,
        'Content-Type': 'application/json'
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        resolve({ status: res.statusCode, data });
      });
    });

    req.on('error', (e) => resolve({ error: e.message }));
    setTimeout(() => { req.destroy(); resolve({ error: 'timeout' }); }, 8000);
    req.end();
  });
}

async function main() {
  // Get records to see actual column names
  const res = await apiGet(`/api/v2/tables/${USUARIOS_TABLE_ID}/records?limit=1`);
  console.log('=== USUARIOS SAMPLE ===');
  if (res.data) {
    const parsed = JSON.parse(res.data);
    console.log('Total rows:', parsed.pageInfo?.totalRows || 0);
    if (parsed.list && parsed.list.length > 0) {
      console.log('Columns:', Object.keys(parsed.list[0]));
      console.log('Sample:', JSON.stringify(parsed.list[0], null, 2));
    } else {
      console.log('Table is empty. Checking NocoDB metadata...');
    }
  }

  // Try to get table details via v1 API
  const metaRes = await apiGet(`/api/v1/db/meta/tables/${USUARIOS_TABLE_ID}`);
  console.log('\n=== TABLE METADATA ===');
  if (metaRes.data) {
    const parsed = JSON.parse(metaRes.data);
    console.log('Table title:', parsed.title);
    if (parsed.columns && parsed.columns.list) {
      console.log('\nColumns:');
      for (const c of parsed.columns.list) {
        console.log(`  - ${c.title} (type: ${c.uidt || c.dt}, required: ${!!c.rqd})`);
      }
    }
  }
}

main();

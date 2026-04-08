import axios from 'axios';

const NOCODB_URL = process.env.NOCODB_URL || 'https://db.wzapflow.com.br';
const NOCODB_TOKEN = process.env.NOCODB_TOKEN || '4t4xFeIH5k5sn_ZFOQ_qkdliCrhhggtmYBmYXoOw';
const TABLE_ID = 'm2ic8zof3feve3l'; // pedidos

const api = axios.create({
  baseURL: NOCODB_URL,
  headers: {
    'xc-token': NOCODB_TOKEN,
    'Content-Type': 'application/json',
  },
});

async function checkTableInfo() {
  try {
    const res = await api.get(`/api/v2/tables/${TABLE_ID}`);
    console.log('Table info:', JSON.stringify(res.data, null, 2));
  } catch (error: any) {
    console.error('Error:', error.response?.data || error.message);
  }
}

async function addField(columnName: string) {
  try {
    const payload = {
      column_name: columnName.replace(/_/g, ' '),
      uidt: 'SingleLineText',
      title: columnName.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
    };
    const res = await api.post(`/api/v1/tables/${TABLE_ID}/columns`, payload);
    console.log(`✓ Campo '${columnName}' criado`);
    return res.data;
  } catch (error: any) {
    console.log(`  ${columnName}:`, error.response?.data?.msg || error.message);
  }
}

async function main() {
  console.log('Verificando tabela...\n');
  await checkTableInfo();
  console.log('\n--- Tentando criar campos ---');
  await addField('payment_id');
  await addField('payment_link');
  await addField('status_pagamento');
}

main();

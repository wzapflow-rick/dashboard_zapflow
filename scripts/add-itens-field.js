const NOCODB_URL = 'https://db.wzapflow.com.br';
const NOCODB_TOKEN = 'lriop3EmqIOn4_T5hhpdPbzIrAYqWjVV8hlNS3VI';

const GRUPOS_SLOTS_TABLE_ID = 'm1h9jeye8hcd4k6';

async function main() {
  console.log('Verificando se campo itens foi salvo...');

  const res = await fetch(`${NOCODB_URL}/api/v2/tables/${GRUPOS_SLOTS_TABLE_ID}/records?limit=1`, {
    method: 'GET',
    headers: { 'xc-token': NOCODB_TOKEN },
  });

  const data = await res.json();
  console.log('Registro:', JSON.stringify(data, null, 2));

  // Agora tenta adicionar um item ao grupo
  console.log('\nAdicionando item ao grupo...');

  const res2 = await fetch(`${NOCODB_URL}/api/v2/tables/${GRUPOS_SLOTS_TABLE_ID}/records`, {
    method: 'PATCH',
    headers: {
      'xc-token': NOCODB_TOKEN,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      id: 6,
      itens: JSON.stringify([1])
    }),
  });

  const data2 = await res2.json();
  console.log('PATCH resposta:', JSON.stringify(data2, null, 2));

  // Verifica novamente
  console.log('\nVerificando apos PATCH...');
  const res3 = await fetch(`${NOCODB_URL}/api/v2/tables/${GRUPOS_SLOTS_TABLE_ID}/records?limit=1`, {
    method: 'GET',
    headers: { 'xc-token': NOCODB_TOKEN },
  });

  const data3 = await res3.json();
  console.log('Registro final:', JSON.stringify(data3, null, 2));
}

main();
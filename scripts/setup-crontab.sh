#!/usr/bin/env bash
#
# setup-crontab.sh
# ----------------
# Instala (ou atualiza) as linhas de crontab que disparam os crons de
# cobranca/bloqueio da aplicacao. O script le o CRON_SECRET diretamente do
# arquivo .env do projeto na VPS, entao voce NAO precisa saber nem digitar o
# valor do segredo.
#
# Como usar na VPS:
#   1. Ajuste as duas variaveis abaixo (APP_DIR e APP_URL) se necessario.
#   2. Rode:  bash scripts/setup-crontab.sh
#
# Rode de novo sempre que quiser reinstalar; ele substitui as linhas antigas
# sem duplicar.

set -euo pipefail

# === Ajuste se necessario ===================================================
# Diretorio onde o projeto esta instalado na VPS (contem o arquivo .env).
APP_DIR="${APP_DIR:-$(cd "$(dirname "$0")/.." && pwd)}"
# URL publica da aplicacao (sem barra no final).
APP_URL="${APP_URL:-https://cardapio.wzapflow.com.br}"
# ============================================================================

# Procura o CRON_SECRET nos arquivos de ambiente mais comuns.
ENV_FILE=""
for candidate in "$APP_DIR/.env" "$APP_DIR/.env.local" "$APP_DIR/.env.production" "$APP_DIR/.env.production.local"; do
  if [ -f "$candidate" ] && grep -qE '^CRON_SECRET=' "$candidate"; then
    ENV_FILE="$candidate"
    break
  fi
done

if [ -z "$ENV_FILE" ]; then
  echo "ERRO: nao encontrei CRON_SECRET em nenhum .env dentro de $APP_DIR" >&2
  echo "Verifique se o app esta nesse diretorio e se a variavel esta definida." >&2
  exit 1
fi

# Extrai o valor, removendo aspas e espacos em volta.
CRON_SECRET="$(grep -E '^CRON_SECRET=' "$ENV_FILE" | head -n1 | cut -d= -f2- | sed -e 's/^["'\'' ]*//' -e 's/["'\'' ]*$//')"

if [ -z "$CRON_SECRET" ]; then
  echo "ERRO: CRON_SECRET encontrado em $ENV_FILE mas esta vazio." >&2
  exit 1
fi

echo "CRON_SECRET carregado de: $ENV_FILE (valor nao sera exibido)"
echo "URL da aplicacao: $APP_URL"

# Marcadores para localizar/atualizar o bloco sem duplicar.
BEGIN_MARK="# >>> zapflow-crons (gerado por setup-crontab.sh) >>>"
END_MARK="# <<< zapflow-crons <<<"

# Linhas de cron:
#   09:00 -> verifica pagamentos vencidos e bloqueia inadimplentes
#   09:05 -> envia lembretes de renovacao/cobranca por WhatsApp
CRON_LINES="$BEGIN_MARK
0 9 * * * curl -s -X POST -H \"x-cron-key: $CRON_SECRET\" $APP_URL/api/cron/check-payments >/dev/null 2>&1
5 9 * * * curl -s -X POST -H \"x-cron-key: $CRON_SECRET\" $APP_URL/api/cron/billing-reminder >/dev/null 2>&1
$END_MARK"

# Remove qualquer bloco anterior e injeta o novo.
CURRENT="$(crontab -l 2>/dev/null || true)"
CLEANED="$(printf '%s\n' "$CURRENT" | sed "/$(printf '%s' "$BEGIN_MARK" | sed 's/[][\.*^$/]/\\&/g')/,/$(printf '%s' "$END_MARK" | sed 's/[][\.*^$/]/\\&/g')/d")"

{
  printf '%s\n' "$CLEANED" | sed '/^$/d'
  printf '%s\n' "$CRON_LINES"
} | crontab -

echo "Crontab instalado com sucesso. Linhas ativas:"
crontab -l | sed -n "/$(printf '%s' "$BEGIN_MARK" | sed 's/[][\.*^$/]/\\&/g')/,/$(printf '%s' "$END_MARK" | sed 's/[][\.*^$/]/\\&/g')/p"

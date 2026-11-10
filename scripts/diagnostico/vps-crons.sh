#!/usr/bin/env bash
# Diagnostico SOMENTE LEITURA dos crons e processos na VPS.
# Nao altera crontab, nao reinicia processos. Segredos sao mascarados.
#   bash scripts/diagnostico/vps-crons.sh > diag-crons.txt 2>&1
set -u
mask() { sed -E 's/(x-cron-key: ?|key=|Bearer )[^" &]+/\1***/g'; }

echo "== crontab do usuario atual ($(whoami))"; crontab -l 2>/dev/null | mask || echo "(vazio)"
echo; echo "== crontab root"; sudo -n crontab -l 2>/dev/null | mask || echo "(sem acesso ou vazio)"
echo; echo "== /etc/cron.d e /etc/crontab"; grep -rHv '^\s*#' /etc/cron.d /etc/crontab 2>/dev/null | grep -E 'curl|wget|api/cron' | mask
echo; echo "== timers systemd"; systemctl list-timers --all 2>/dev/null | head -40
echo; echo "== processos node/pm2"; (pm2 ls 2>/dev/null || ps aux | grep -E 'node|next' | grep -v grep)
echo; echo "== execucoes recentes do cron (syslog/journal)"
(journalctl -u cron -u crond --since "7 days ago" 2>/dev/null || grep -h CRON /var/log/syslog* 2>/dev/null) | grep -E 'api/cron|curl' | tail -60 | mask
echo; echo "== logs do app mencionando crons (pm2)"
ls ~/.pm2/logs 2>/dev/null && grep -hE '\[Cron|\[CRON|Remarketing|Funil' ~/.pm2/logs/*.log 2>/dev/null | tail -80 | mask

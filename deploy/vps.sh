#!/usr/bin/env bash
# Pubblica il sito sulla VPS web di OVH (Strasburgo) dal Mac, come utente ubuntu. Di solito non serve:
# lo fa la GitHub Action (.github/workflows/deploy.yml) a ogni push su main. Serve per il primo deploy,
# per installare un deploy/compose.yml o deploy/caddy.conf cambiato (l'Action non può) e per tornare a
# un commit precedente (git checkout <commit>, poi questo script). La VPS builda HEAD.
# Prima del primo deploy deve esistere /opt/web/apps/harmonia-vocalis/app.env (vedi deploy/compose.yml).
set -euo pipefail
APP=harmonia-vocalis
TARGET=${WEB_VPS_TARGET:-ubuntu@51.91.127.232}
cd "$(dirname "$0")/.."
if [ -n "$(git status --porcelain --untracked-files=no)" ]; then
	echo "Ci sono modifiche non committate: committale prima (la VPS builda HEAD)." >&2
	exit 1
fi
REV=$(git rev-parse --short HEAD)

ssh "$TARGET" "mkdir -p /tmp/$APP.new"
scp -q deploy/compose.yml deploy/caddy.conf "$TARGET:/tmp/$APP.new/"
ssh "$TARGET" "set -e
	A=/opt/web/apps/$APP
	install -d -m 755 \$A
	[ -f \$A/app.env ] || { echo \"missing \$A/app.env: create it first\" >&2; exit 1; }
	[ -d \$A/richieste ] || sudo install -d -o 1000 -g 1000 -m 755 \$A/richieste
	docker compose --project-directory \$A -f /tmp/$APP.new/compose.yml config -q
	install -m 644 /tmp/$APP.new/compose.yml \$A/compose.yml
	sudo cp -a /etc/caddy/sites/$APP.caddy /tmp/$APP.caddy.prev 2>/dev/null || sudo rm -f /tmp/$APP.caddy.prev
	sudo install -m 644 /tmp/$APP.new/caddy.conf /etc/caddy/sites/$APP.caddy
	if ! sudo caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile >/dev/null 2>&1; then
		echo 'deploy/caddy.conf is not valid: restoring the previous one.' >&2
		if [ -f /tmp/$APP.caddy.prev ]; then sudo install -m 644 /tmp/$APP.caddy.prev /etc/caddy/sites/$APP.caddy; else sudo rm -f /etc/caddy/sites/$APP.caddy; fi
		exit 1
	fi
	rm -rf /tmp/$APP.new
	sudo systemctl reload caddy"
git archive --format=tar HEAD | ssh "$TARGET" \
	"sudo -u deploy SSH_ORIGINAL_COMMAND='app $APP $REV' /usr/local/bin/deploy-static"

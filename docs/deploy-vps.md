# Deploy em VPS

Este caminho sobe o MVP inteiro em uma VPS unica usando Docker Compose e Caddy.

## Topologia

```txt
internet
  |
  v
Caddy :80/:443
  |-- app.telefoninho.example.com -> parent-web:3000
  |-- api.telefoninho.example.com -> api:3001

SIP/RTP direto na VPS
  |-- 5060/udp -> asterisk
  |-- 10000-10100/udp -> asterisk
```

## Requisitos

- VPS Ubuntu 24.04 ou similar.
- Docker e Docker Compose instalados.
- Dominio apontando para o IP da VPS.

DNS sugerido:

```txt
app.seudominio.com  A  <IP_DA_VPS>
api.seudominio.com  A  <IP_DA_VPS>
sip.seudominio.com  A  <IP_DA_VPS>
```

Firewall minimo:

```bash
sudo ufw allow 22/tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw allow 5060/udp
sudo ufw allow 10000:10100/udp
sudo ufw enable
```

## Primeiro deploy

Na VPS:

```bash
git clone <repo-url> telefoninho
cd telefoninho
cp .env.production.example .env.production
```

Edite `.env.production`:

```env
APP_DOMAIN=app.seudominio.com
API_DOMAIN=api.seudominio.com
SIP_DOMAIN=sip.seudominio.com
JWT_SECRET=uma-chave-longa-e-aleatoria
SEED_DEMO=true
```

Suba os containers:

```bash
docker compose --env-file .env.production -f docker-compose.prod.yml up -d --build
```

Gere a configuracao inicial do Asterisk a partir do banco:

```bash
docker compose --env-file .env.production -f docker-compose.prod.yml run --rm api pnpm --filter @telefoninho/api generate:asterisk
docker compose --env-file .env.production -f docker-compose.prod.yml restart asterisk
```

Depois do primeiro deploy, mude:

```env
SEED_DEMO=false
```

e aplique:

```bash
docker compose --env-file .env.production -f docker-compose.prod.yml up -d
```

## Checagens

API:

```bash
curl -fsS https://api.seudominio.com/health
```

Painel:

```txt
https://app.seudominio.com/login
```

Login demo:

```txt
parent@demo.com
devpassword
```

Asterisk:

```bash
docker compose --env-file .env.production -f docker-compose.prod.yml exec asterisk asterisk -rx "pjsip show endpoints"
docker compose --env-file .env.production -f docker-compose.prod.yml exec asterisk asterisk -rx "dialplan show"
```

## NAT/SIP em VPS

Se chamadas registram mas audio nao passa, configure o transporte PJSIP com o IP publico da VPS.

Edite `infra/asterisk/config/pjsip.conf` e adicione dentro de `[transport-udp]`:

```ini
external_media_address=<IP_DA_VPS>
external_signaling_address=<IP_DA_VPS>
local_net=172.16.0.0/12
local_net=10.0.0.0/8
local_net=192.168.0.0/16
```

Depois:

```bash
docker compose --env-file .env.production -f docker-compose.prod.yml restart asterisk
```

## Atualizacao

```bash
git pull
docker compose --env-file .env.production -f docker-compose.prod.yml up -d --build
docker compose --env-file .env.production -f docker-compose.prod.yml run --rm api pnpm --filter @telefoninho/api generate:asterisk
docker compose --env-file .env.production -f docker-compose.prod.yml exec asterisk reload-asterisk.sh
```

## Logs e recuperacao de espaco

O Compose de producao limita os logs a 3 arquivos de 10 MB por servico.
Para aplicar a rotacao a containers existentes, recrie os servicos com
`docker compose --env-file .env.production -f docker-compose.prod.yml up -d --no-build --force-recreate`.
Isso interrompe brevemente os servicos; nao execute durante uma chamada.

Na VPS, `sudo bash scripts/cleanup-vps-logs.sh` apenas informa os tamanhos.
Em emergencia, `sudo bash scripts/cleanup-vps-logs.sh --apply` limpa somente
logs Docker `json-file` acima de 100 MiB dos quatro containers Telefoninho.
O script para e retoma os containers afetados e preserva as ultimas 200 linhas
em arquivos privados em `/run` (perdidos no reboot). Nao remove volumes ou bancos.
Nao e necessario agendar a limpeza: a rotacao Docker limita o crescimento.

## Backup simples

SQLite fica no volume Docker `telefoninho_api-data`.

Backup:

```bash
docker compose --env-file .env.production -f docker-compose.prod.yml exec api cp /data/telefoninho.db /data/telefoninho.backup.db
docker cp telefoninho-api:/data/telefoninho.backup.db ./telefoninho.backup.db
```

Restauracao deve ser feita com os containers parados para evitar corrupcao do arquivo SQLite.

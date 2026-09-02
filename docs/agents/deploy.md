# Deploy e VPS

Leia este arquivo quando mexer em scripts de deploy, Docker, Caddy, VPS, banco de produção ou reinicialização de serviços.

## VPS

- VPS atual: `vps68379.publiccloud.com.br` (`191.252.92.180`).
- Diretório remoto: `/opt/telefoninho`.
- Servidor padrão do Android: `https://vps68379.publiccloud.com.br`.

## Scripts

- Script de deploy/reinstalação: `scripts/deploy-vps.sh`.
- Use `scripts/deploy-vps.sh --reset-db` apenas quando reset do banco for realmente desejado.
- Reset de banco deve manter backup timestampado antes de remover `/data/telefoninho.db*`.
- Valide scripts shell com:
  - `bash -n scripts/<nome>.sh`

## Segurança

- Não altere secrets ou `.env.production` no repositório.
- Não rode reset de banco, migrações destrutivas ou mudanças em produção sem confirmação explícita.
- Ao mexer em deploy que afete Asterisk, confirme se precisa regenerar config e reiniciar/recarregar serviço.


# Regras Gerais

Leia este arquivo para qualquer tarefa neste repo.

- Preserve mudanças locais do usuário. Não reverta trabalho que você não fez sem pedido explícito.
- Antes de editar, leia o contexto próximo do arquivo e rode `git status --short`.
- Estamos no NixOS: prefira `nix develop` ou `nix develop --command ...` para comandos do projeto.
- Sem código comentado: remova em vez de comentar.
- Nomes descritivos: `getActiveMembers()` em vez de `getData()`.
- DRY com medida: extraia repetição real, mas evite abstração prematura.
- Side effects isolados: IO, rede e banco em boundaries claras.
- Segurança: secrets em variáveis de ambiente, nunca no código. `.env` e `.env.production` devem ficar fora do git.
- Não altere produção, banco, VPS ou secrets de forma destrutiva sem confirmação explícita.


# Site de apresentacao

O dominio principal serve `infra/caddy/site` pelo Caddy. O painel parental
continua em `admin.telefoninho.com.br`.

A landing explica o projeto, o funcionamento atual no Android e a possibilidade
de um aparelho fisico sem tela. A ilustracao e conceitual: nao representa um
hardware pronto ou disponivel para compra.

## Desenvolvimento

```bash
nix develop --command python3 -m http.server 4173 --bind 127.0.0.1 --directory infra/caddy/site
```

Abra `http://127.0.0.1:4173`. O site usa HTML e CSS, sem JavaScript ou dependencias
de runtime adicionais. Fonte, icone e ilustracao sao servidos localmente.
A fonte Pixelify Sans tem a licenca SIL OFL em `assets/PIXELIFY-LICENSE.txt`.
O icone e o mesmo do app Android. A arte fisica foi gerada como ilustracao em pixel.

## Publicacao

Somente apos autorizacao explicita, copie o HTML e `assets/` para
`/opt/telefoninho/infra/caddy/site` na VPS. Preserve `privacy.html` e mantenha
backup da versao anterior. Como o diretorio ja e montado no Caddy, nao e
necessario reconstruir ou reiniciar API, painel ou Asterisk.

## Verificacao

Confira carregamento dos assets, navegacao pelas ancoras, painel e politica de
privacidade. Valide celular e desktop, ausencia de rolagem horizontal,
foco de teclado e legibilidade do texto. O conteudo deve continuar disponivel
sem JavaScript e sem a fonte personalizada.

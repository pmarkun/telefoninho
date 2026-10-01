# Beta fechado: cadastro e primeiros passos

Implementação local em 1 de outubro de 2026. Ainda não publicada em produção.

## Experiência entregue

- Administrador emite, reemite e revoga convites individuais em `/beta`, com indicação de e-mail e download configurados.
- `/convite` cria uma conta de responsável vinculada ao endereço convidado. A posse do link comprova o e-mail. Não existe cadastro aberto nem escolha de papel pelo cliente.
- Quem já tem conta entra com sua própria senha e aceita o vínculo à família, sem alteração de identidade por outro responsável.
- `/esqueci-senha` e `/redefinir-senha` recuperam acesso com resposta genérica e link temporário de uso único.
- `/primeiros-passos` salva família, dois contatos, autorização explícita de chamadas nos dois sentidos, pareamento e confirmação da primeira conversa.
- O beta usa o app em **dois aparelhos Android 8 ou superior**. O painel organiza contatos; não recebe chamadas pelo navegador nem liga para números celulares comuns.
- Desparear invalida o token, revoga códigos pendentes e troca a senha SIP. A aplicação da configuração ocorre automaticamente, com nova tentativa em caso de falha.
- A confirmação de áudio é informada pela família após o teste; não é uma medição automática da qualidade da chamada.

## Segurança e operação

Fechados os caminhos que permitiam a um familiar sobrescrever senha/e-mail de outra conta. Respostas não expõem hashes. Operações globais de telefonia e estatísticas ficam restritas a administradores.

Senhas novas usam scrypt com salt; hashes antigos são atualizados após login válido. Sessões de responsável expiram em 12 horas, usam cookie HttpOnly/SameSite e Secure em produção, e são revogadas após recuperação ou logout. Há proteção de origem para escritas, limites de tentativas e pareamento criptográfico com consumo atômico.

Links de beta/responsável duram sete dias; recuperação dura 30 minutos. O banco guarda hash do token. O token está no fragmento da URL, e a leitura do convite não o consome. A outbox cifra o conteúdo, tenta enviar até oito vezes e usa idempotência; reemitir revoga o convite anterior. O limite de tentativas é local ao processo: revisar se houver múltiplas réplicas.

## E-mail

Criada a chave exclusiva **Telefoninho beta**, somente envio, restrita ao domínio verificado `mail.arapy.ia.br`. Remetente: `Telefoninho <telefoninho@mail.arapy.ia.br>`; Reply-To: `pedro@markun.com.br`.

Configuração em `/home/markun/.config/telefoninho/resend.env`, permissão 600, fora do Git. Teste para Pedro confirmado na caixa de entrada. A chave ainda não foi instalada em produção. Para remetente `@telefoninho.com.br`, verificar o domínio no Resend.

## Publicação futura

1. Revisar e integrar o PR preservando trabalho existente; manter backup do banco e dos arquivos antes da atualização.
2. Configurar no servidor `RESEND_API_KEY`, `EMAIL_FROM`, `EMAIL_REPLY_TO`, `PARENT_WEB_URL=https://admin.telefoninho.com.br`, `WEB_ORIGINS=https://admin.telefoninho.com.br` e `JWT_SECRET` forte com pelo menos 32 caracteres. Preservar o segredo existente válido: trocá-lo invalida sessões e leitura de e-mails cifrados pendentes.
3. No painel, configurar `API_INTERNAL_URL=http://api:3001`. Fornecer `ANDROID_BETA_DOWNLOAD_URL` com APK atualizado, assinado e acessível por HTTPS.
4. A inicialização usa `db:migrate`, sem schema push forçado. O migrador identifica migrações antigas presentes, bloqueia schema parcial, faz backup antes de novas alterações em banco existente e registra checksums. Verificar volume gravável e espaço livre; manter cópia fora do servidor. Restauração operacional ainda pendente.
5. Validar login existente, envio, recuperação e isolamento de famílias no ambiente publicado. Confirmar monitor HTTP existente; ele não comprova chamadas.
6. Fazer chamadas nos dois sentidos em Android reais, redes diferentes e segundo plano, antes de convidar famílias.

## APK e limites do aceite

Existe APK de release local com assinatura válida, mas é **0.1.1 / código 2**, enquanto o código declara **0.1.4 / código 5**. Não distribuir o artefato antigo como release atual. Preparar novo APK ou teste fechado da Play Store e validar instalação/atualização.

Validados: testes de API/contratos e migração com preservação de dados; lint, tipos e build; Chromium em 360×800, 390×844, 768×1024, 1366×768, 1440×900 e larguras 759/760/761, sem transbordamento horizontal. Cadastro por convite, criação/retomada da família, código, login correto/incorreto e administração exercitados no navegador. Recuperação, expiração, reutilização e revogação de links/aparelhos verificadas na API.

Não validados: Firefox, WebKit/Safari, preenchimento automático, falha real de rede, aparelhos físicos para o painel, instalação do release atual, chamadas reais, segundo plano e capacidade simultânea. A prévia usa recarga de telefonia simulada e não envia convites reais.

Primeira rodada: convites individuais e suporte em `pedro@markun.com.br`. Definir tamanho da rodada e canal final de distribuição antes da abertura.

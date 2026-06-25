# SIP, Asterisk e Áudio VoIP

Leia este arquivo quando mexer em Liblinphone, SIP, Asterisk, permissões de chamada, dialplan ou áudio.

## Liblinphone no Android

- O app usa Liblinphone.
- Ao aceitar ou iniciar chamadas, configure áudio explicitamente:
  - ativar audio session;
  - habilitar microfone;
  - selecionar input `Microphone`;
  - selecionar output `Speaker` ou saída de fone conforme preferência.
- One-way audio pode ser roteamento de device no Linphone, não necessariamente rede.
- Verifique logs `Audio enabled ... input=... output=...`.

## Asterisk

- Mudanças de contatos/permissões podem exigir regenerar config do Asterisk e reiniciar/recarregar o serviço no servidor.
- O refresh no app atualiza UI/config local; ele não garante que o dialplan remoto foi regenerado.
- Checagens úteis no VPS:
  - `pjsip show contacts`
  - `core show channels verbose`

## Debug

- Use logs Android com tag `TelefoninhoVoip`.
- Em problemas de chamada, confira:
  - registro SIP dos dois aparelhos;
  - contato PJSIP no Asterisk;
  - canais ativos;
  - output/input audio device no app.


Sempre tudo estética 8 bits!
Faça cada feature em um branch diferente.
Commits atômicos e testes.
Pode testar de verdade  nos celulares via adb.
Pode mexer na VM se precisar.
Eu vou estar dormindo então siga viagem.
Se empacar MUITO pule para a próxima tarefa e deixe uma anotação para eu resolver amanhã.
Vai dando check conforme terminar.

[x] O Gerador de QR Code esta funcionando agora. Mas o scan da um erro quando scanneia o QR code gerado.
[x] O telefone deve tocar mesmo quando o app estiver fechado. Deve gastar pouca bateria!
[x] Nas configurações deve dar pra definir o ringtone; 3 opções estética 8bit
[x] Modo dialpad onde a pessoa pode ligar direto pro ramal
[x] Os contatos devem ir para um menu de contatos, páginados.
[x] Contatos não aprovados devem aparecer mas ficar inativos e semitransparentes.
[x] Crie um icone 8bit para o app no Android.

Notas:
- Chamada em background usa foreground service leve com SIP compartilhado; se o Android estiver em DND/nao permitir chamadas, o sistema pode silenciar a notificacao.
- Refresh de contatos atualiza UI/config local; permissao real de chamada ainda depende do Asterisk estar regenerado/recarregado.

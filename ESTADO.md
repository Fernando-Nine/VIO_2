# VIO — estado do projeto

Arquivo vivo. O `CLAUDE.md` guarda as regras permanentes (e fica curto de propósito); **este
guarda onde estamos**. Substitui o antigo `ESTADO-DO-PROJETO.md`, que ficou desatualizado.

Última atualização: **16/09/2026** · Versão do app: **1.9.0**

---

## 1. Onde estamos

O código que está na pasta é o mesmo do último `.zip` íntegro: tudo da seção 2 abaixo funciona
e foi testado. Nada da seção 3 existe no código, por mais detalhada que tenha sido a conversa
sobre cada item.

O VIO 2 **não roda em lugar nenhum hoje**. O plano é localhost → `npm install` e `npm start`
com um amigo via Radmin → só então hospedagem. O `render.yaml` fica como intenção; o
`https://vio-0ia0.onrender.com/` no ar é o **VIO 1 legado**, que continua servindo os amigos e
não deve ser confundido com este projeto.

Repositório canônico: **GitHub** — `Fernando-Nine/VIO_2`, e desde 15/09/2026 ele de fato contém
o projeto (antes tinha só o README). A pasta local em `Documents\Nerd_Quest\VIO` é uma cópia e
**não** deve ser a pasta de trabalho. Clonar o repo e trabalhar dentro do clone.

> **Escopo do teste via Radmin:** validar a interface e o fluxo com outra pessoa de verdade,
> antes de pensar em hospedagem. Travessia de NAT fica de fora por construção — dentro da VPN
> todos estão na mesma rede virtual —, e isso é deliberado, não uma lacuna do teste. O caso do
> amigo que não vê a tela só se reproduz pela internet aberta (ver seção 3, TURN).

## 2. O que existe e funciona

**Compartilhamento de tela** — salas por código (nascem sozinhas); várias pessoas compartilhando
ao mesmo tempo; cada transmissão conecta só a quem está de fato assistindo (economiza banda de
quem compartilha); seletor com miniatura de vídeo ao vivo; prévia da própria tela com opção de
ocultar.

**Qualidade e áudio** — controle ao vivo sem parar a transmissão (presets Alta/Média/Baixa ou
FPS, bitrate e escala manuais); áudio de tela sem processamento (`echoCancellation`,
`noiseSuppression` e `autoGainControl` desligados de propósito); opção de mandar só vídeo;
explicação automática do que aconteceu com o áudio conforme o tipo de superfície compartilhada.

**Quem assiste** — volume individual e mute local; tela cheia em qualquer plataforma, com modo
nativo específico pro Safari do iPhone.

**Confiabilidade** — indicador de ping (ponto colorido + detalhe numérico), priorizando o RTT
real da conexão de vídeo; aviso na tela quando uma conexão específica falha; controles somem
sozinhos com a inatividade.

**PWA** (1.4.0) — `manifest.json` + service worker mínimo. Instalável no celular e no PC, abre
em janela própria, e a tela de entrada carrega sem rede. O SW é rede-primeiro e tem escopo
deliberadamente estreito: `/api/` e o transporte do Socket.IO nunca passam por ele — a única
exceção sob `/socket.io/` é o `socket.io.js`, que é arquivo estático e parte do shell. Não
chama `skipWaiting()`, para não trocar código por baixo de quem está compartilhando.

> **Ícone provisório.** `public/icon-192.png`, `icon-512.png` e `icon-maskable-512.png` são a
> própria marca da tela de entrada (glifo de monitor sobre o `--grad-marca`) renderizada
> grande — não são arte nova. A arte definitiva continua sendo do Midjourney (seção 4).
> Trocar os três arquivos basta; o `manifest.json` não muda.

> **Service worker exige contexto seguro.** Em `https://` e em `localhost` funciona; em
> `http://` num IP da rede local — o teste pelo Radmin — o navegador não registra, e o app roda
> igual, só sem instalar. Não é defeito: para ver a instalação funcionando é preciso HTTPS.

**Chat de voz** (1.5.0) — botão de microfone no rodapé. Primeiro toque entra na conversa;
os seguintes alternam mudo, **sem derrubar a conexão** — você continua ouvindo todo mundo.
Microfone com `echoCancellation`, `noiseSuppression` e `autoGainControl` **ligados**, o oposto
exato da regra do áudio de tela, e de propósito: aqui é voz.

Uma conexão por par, bidirecional, separada das de tela. Quem tem o `socket.id` menor faz a
oferta — sem isso as duas pontas travavam em `have-local-offer`. O `payload.canal` distingue
voz de tela na sinalização: com os dois no ar, o mesmo par pode ter três conexões, e um
candidato ICE entregue à conexão errada a mataria em silêncio.

Anel no avatar de quem fala (`.falando`) e medidor do próprio microfone na folha de
participantes, ambos alimentados por um `AnalyserNode` por stream.

**Controles de voz** (1.6.0) — dois botões no rodapé, com papéis distintos: o **microfone**
cala só você, e o **fone** silencia a conversa inteira (microfone e áudio). Voltar a ouvir
devolve o microfone como estava antes, não mudo.

Cada pessoa pode ser **silenciada individualmente**, só do seu lado: nada vai para o servidor
e a pessoa não fica sabendo. Some quando você sai da sala.

Ajustes do próprio microfone na folha de Ajustes: **sensibilidade** (portão de ruído),
**cancelamento de eco** e **supressão de ruído**.

**Grafo de áudio do microfone** (1.7.0) — o microfone não vai direto pra rede; passa por um
grafo WebAudio montado **uma vez**:

```
getUserMedia → MediaStreamSource → ganhoUsuario → analisador → ganhoPortão → destino
                                                       ↑                        ↓
                                          medidor e portão leem aqui      estado.vozStream
```

Três consequências que valem lembrar:

- **Trocar de microfone, ou mexer em eco/ruído, só troca o nó de fonte.** O destino continua o
  mesmo, então `estado.vozStream` não muda e as PeerConnections nem ficam sabendo — sem
  `replaceTrack`, sem renegociação.
- **O portão corta por ganho, com rampa** (20 ms para abrir, 150 ms para fechar), não mais
  desligando a track. Acabou o corte seco no fim das frases.
- **O analisador fica antes do portão.** Antes isso exigia medir um *clone* da track, porque o
  portão fechava com `enabled = false` e uma track desabilitada entrega silêncio ao WebAudio —
  o medidor leria zero e o portão nunca mais reabriria. Com o grafo, o clone deixou de existir.

`track.enabled` agora reflete só mudo e surdez, que são decisão do usuário.

**Dispositivos** (1.7.0) — seletor de entrada e slider de ganho (20% a 300%) no bloco "Seu
microfone", que só aparece para quem está na voz. Os rótulos dos dispositivos só existem depois
que o microfone é liberado, então a lista é preenchida após o `getUserMedia` e atualizada no
evento `devicechange`.

A **saída** fica em bloco separado (1.7.1), e de propósito: ela não é ajuste de microfone — vale
para tudo que a pessoa ouve, conversa e som da tela. Por isso aparece mesmo para quem só assiste
e nunca entrou na voz. Estava dentro do bloco do microfone na 1.7.0, o que dava a entender que
valia só para a conversa.

> **Escolher a saída só existe no Chrome e derivados.** `setSinkId` não existe no Firefox nem no
> Safari; nesses navegadores o seletor de saída some em vez de fingir que funciona. A entrada
> funciona em todos.

> **Sem "sair da voz" ainda.** Uma vez na conversa, você fica até sair da sala. Mudo e fone
> cobrem o caso comum; sair de vez não tem botão. Se incomodar, é fácil de acrescentar.

> **Eco com áudio de tela.** Quem compartilha tela **com som** e está na voz vai ter o
> microfone captando esse som pelas caixas. O cancelamento de eco ajuda, mas não resolve com
> mídia alta — a resposta é fone de ouvido. É por isso que os ícones `headphones` e
> `noise-cancelling-headphones` estão baixados.

**Câmera** (1.8.0) — canal próprio (`canal: 'camera'`), lista própria no servidor
(`cameraIds`), conexões separadas das de tela e das de voz. O desenho é o da voz; o
comportamento é o da **tela**: sob demanda, só conecta com quem focou nela. Vídeo é caro demais
para sair para a sala inteira sem ninguém olhando — e é exatamente por a voz não poder ser sob
demanda que ela é quem define o teto de ~6.

A câmera pega **só vídeo** (`audio: false`): microfone continua sendo do canal de voz, com os
ajustes dele. Os controles de qualidade também não valem para ela — são da tela, calibrados para
texto pequeno; a câmera tem teto próprio e fixo (`BITRATE_CAMERA`, 1.2 Mbps).

O que essa versão mexeu na estrutura, e é o ponto que importa daqui pra frente: **a chave de uma
transmissão deixou de ser o `socket.id` e virou `"socketId|canal"`** (`chaveDe` /
`partesDaChave`). Sem isso, quem transmite tela e câmera ao mesmo tempo teria as duas ocupando a
mesma entrada em `streamsDisponiveis`, nos PCs e nas filas de ICE — uma apagaria a outra. A voz
é a exceção: uma conexão por par, bidirecional, continua indexada só pelo id.

Virar frontal/traseira usa `replaceTrack` nas conexões que já existem, nunca renegociação —
renegociar faria a imagem piscar preto em quem está assistindo, por nada. O botão fica na barra
do vídeo (não no rodapé): ele age sobre o que está na moldura, e só aparece quando a moldura é a
própria câmera num aparelho com mais de uma. A frontal aparece espelhada **só na própria
prévia**; quem assiste recebe a imagem como ela é, senão texto e placa sairiam ao contrário.

> **Um foco por vez.** Trocar de transmissão solta a anterior — inclusive entre tela e câmera da
> mesma pessoa. É o comportamento certo num mesh: ninguém deve carregar dois vídeos enquanto
> olha para um só.

**Primeiro teste com gente de verdade** (16/09/2026) — o Nine rodou com amigos e trouxe a
lista que virou a 1.9.0. Dois achados valem registro porque são de método, não de código:

- **Quem já estava na sala não via a transmissão começar.** O foco automático só existia no
  `room-state`, ou seja, para quem *entrava* com alguém já compartilhando. Para quem já estava
  lá, `focoAtual` ficava nulo — e a tira de miniaturas se esconde com só uma transmissão, então
  não havia nem o que clicar. Sete suítes passavam porque **todas chamavam `focarEm()` pelo
  console**, pulando exatamente o caminho quebrado. Daí a suíte `teste-interface`, que só clica.
- **As iniciais cobriam a prévia.** O JS alternava a classe `sem-previa` no cartão desde sempre,
  mas **nenhuma regra de CSS usava essa classe** para esconder a placa das iniciais. O vídeo
  tocava atrás dela. É o tipo de coisa que nenhum teste de estado pega: só olhando.

**Primeiro teste com gente de verdade** (16/09/2026) — o Nine rodou com amigos e trouxe a
lista que virou a 1.9.0. Dois achados valem registro porque são de método, não de código:

- **Quem já estava na sala não via a transmissão começar.** O foco automático só existia no
  `room-state`, ou seja, para quem *entrava* com alguém já compartilhando. Para quem já estava
  lá, `focoAtual` ficava nulo — e a tira de miniaturas se esconde com só uma transmissão, então
  não havia nem o que clicar. Sete suítes passavam porque **todas chamavam `focarEm()` pelo
  console**, pulando exatamente o caminho quebrado. Daí a suíte `teste-interface`, que só clica.
- **As iniciais cobriam a prévia.** O JS alternava a classe `sem-previa` no cartão desde sempre,
  mas **nenhuma regra de CSS usava essa classe** para esconder a placa das iniciais. O vídeo
  tocava atrás dela. É o tipo de coisa que nenhum teste de estado pega: só olhando.

O que o relato confirmou de bom: conexão entre amigos funcionou, voz funcionou, e ninguém
esbarrou em NAT desta vez. O amigo com NAT simétrico continua sendo o caso do TURN.

**Reconexão** (1.3.0) — queda de rede ou restart do servidor: o cliente volta sozinho para a
sala, sem F5. O `socket.id` muda na volta, então todos os mapas indexados por id são refeitos
do zero a partir do `room-state`. Quem estava compartilhando volta compartilhando — o
`localStream` sobrevive à queda de propósito, senão o navegador pediria a tela de novo. O mesmo
vale para o microfone e, desde a 1.8.0, para a câmera. Se a
reentrada bater no limite de taxa (rede instável com o servidor vivo), o cliente espera e tenta
de novo, com jitter, até cinco vezes antes de pedir F5.

**Segurança** — rate limit próprio, sem biblioteca (criação de sala, entrada, sinalização,
ações de share, ping), cada um com sua janela e limpeza periódica; validação de `Origin`;
leitura do IP real atrás do proxy do Render; escape de nome de participante; nenhuma conta,
senha ou banco de dados.

**Identidade** — crédito "by NerdQuest Studios · fundado por Nine"; versão tocável abrindo o
changelog dentro do app; AGPLv3.

## 3. O que NÃO existe (apesar de discutido)

- **TURN** — discutido a fundo (relay de último recurso, credenciais efêmeras, ligar por
  variável de ambiente), nada implementado. Só STUN do Google hoje.
  **Sintoma já confirmado na prática:** um amigo não consegue ver a tela de ninguém, enquanto a
  maioria vê normal. É a assinatura de NAT simétrico — STUN não atravessa, só TURN. Agora é o
  item do roadmap que mais muda a vida de quem hoje não consegue usar o VIO, e com voz no ar ele pesa mais: a voz é sempre-para-todos, então cada
  par que não consegue conexão direta vira um "eu escuto todo mundo menos o Fulano". Com a
  câmera (1.8.0) ele pesa igual: é mais um canal que simplesmente não conecta pra esse amigo.
  Agora é o item **1** do roadmap.
- **Tauri + WASAPI** — 100% planejamento. Nenhum projeto Tauri criado.
- **Segurança pendente** — Helmet.js, validação formal de payload do Socket.IO, log
  estruturado, hash de senha (se um dia existir conta).

## 4. Decisões desta sessão (15/09/2026)

- **Teto de escopo escrito.** ~6 pessoas por sala, sem contas, sem gravação, sem chat de texto,
  sem SFU. A malha P2P completa não escala além disso, e voz é sempre-para-todos (diferente da
  tela, que é sob demanda). Sem essa linha, cada feature nova parecia justificada.
- **Ordem do roadmap:** reconexão → PWA → voz → câmera → TURN → Tauri. O redesenho visual anda
  em paralelo, porque toca arquivos diferentes. Reconexão, PWA e voz já saíram.
- **SFU reconsiderado e recusado por ora (15/09/2026).** Um SFU levantaria o teto de ~6 para
  dezenas, e a objeção não é técnica — é que ele **roteia mídia pelo servidor**, exatamente o
  que a primeira linha do `CLAUDE.md` e o README negam ("o vídeo e o áudio nunca passam por
  nenhum servidor"). Isso deixa de ser detalhe de implementação e vira outra promessa ao
  usuário. Três consequências concretas: o servidor passa a **ver** a mídia, o que muda o que
  dá pra prometer sobre privacidade; hospedagem gratuita deixa de servir, porque um SFU com 6
  pessoas em 2,5 Mbps recebe ~15 Mbps e reenvia ~75 Mbps contínuos, o que nenhum plano free
  aguenta; e auto-hospedar o VIO — que é o ponto da AGPLv3 — deixa de ser "rode um Node" e
  vira operar infraestrutura de mídia. **Decisão:** fica registrado como caminho possível,
  não descartado, para o dia em que houver orçamento. Até lá o teto continua, agora explicado
  ao usuário pelo "?" na folha de participantes. O **TURN** (item 2) não tem esse problema:
  relay de rede, não de aplicação, e o próprio `CLAUDE.md` já o admite como exceção.
- **"Instalável" = PWA primeiro** (celular e PC), Tauri depois e só pelo WASAPI. Tauri não é
  "empacotar o front-end": exige captura de áudio por processo em Rust e injetar esse áudio na
  PeerConnection da WebView2.
- **Stack mantida** — JS puro, sem framework e sem build. React/Tailwind foi considerado e
  descartado: mesh gradient, glassmorphism, microinterações e pulso de quem fala são todos CSS
  puro, então a troca daria zero ganho visual e custaria reescrever as 1183 linhas de WebRTC do
  `app.js` — justamente a parte difícil e já testada. WebRTC é imperativo por natureza
  (`MediaStream` em `<video>`, ciclo de vida de `RTCPeerConnection`), então React atrapalharia
  exatamente onde menos ajuda.
- **Papel de cada ferramenta de IA:**
  - *Claude Code / Claude Pro* — a única que escreve no repositório.
  - *V0* — redesenho visual, entregando HTML e CSS puros (ver seção 5).
  - *Midjourney* — só marca: logo, ícone do PWA (512px), OG image, arte de divulgação. Não
    toca nos ícones de interface, que são SVGs do Flaticon já padronizados e pintados por
    `mask-image`.
  - *Bolt.new* — cortado. O WebContainer não sustenta WebSocket persistente pra testar P2P
    entre máquinas, e o orçamento do plano gratuito acaba rápido.
  - *Abacus* — se usado, só como revisor de diff. Nunca escrevendo no repo, pra não fragmentar
    convenções entre dois assistentes com contextos diferentes.

## 5. Redesenho visual via V0 — registro

**Status: integrado em 15/09/2026, aguardando teste manual.**

**Rodada 1 — 15/09/2026.**
- O V0 entregou **HTML e CSS puros**, sem React: não precisou portar nada à mão.
- Trocados `public/index.html` e `public/style.css`. O `app.js` não foi tocado.
- **Nenhum dos 59 ids do contrato faltou**, e as 30 classes que o JS liga, desliga ou cria
  existem no CSS novo. Verificado com o snippet do `PROMPT-V0.md`: array vazio.
- **Faltaram as duas tags de script** (`socket.io.js` e `app.js`): o export do V0 as perdeu, e
  sem elas a tela abre bonita e completamente morta. Devolvidas na integração — é exatamente o
  que o §5.2 do `REDESIGN-CONTRATO.md` manda conferir.
- Ajustes manuais depois: favicon reposto (o export não trazia); o botão "Gerar" vinha com
  `icone-settings` (engrenagem de ajustes) e passou a usar `icone-rotate-right`, que já existia.
- **Ícones:** o export trazia um conjunto próprio, de contorno, que difere do Flaticon em
  `public/icons/`. Mantido o conjunto atual — o `settings.svg` do V0 não é uma engrenagem, e o
  `CLAUDE.md` proíbe mexer em `public/icons/` sem pedido. Só foram **acrescentados** os cinco
  que não tinham equivalente: `clock`, `link`, `rocket`, `tela-cheia`, `voltar`.
  Revisado e confirmado: o conjunto do Flaticon fica. A chave e o brilho do V0 foram os dois
  que mais destoaram.
- Versão publicada com o redesenho: ainda nenhuma (roda só em localhost).

**Pendente desta rodada:** a checklist de teste manual do `CLAUDE.md` (duas abas, PC + celular,
reinício do servidor). Nada de WebRTC foi validado — o Claude Code não consegue testar isso.

Plano: `PROMPT-V0.md` (três mensagens, no mesmo chat do V0) e `REDESIGN-CONTRATO.md` (os 57 ids,
classes e atributos que o `app.js` consulta). O redesenho troca **apenas** `public/index.html` e
`public/style.css`. O `app.js` não muda.

Restrições técnicas que entraram no prompt e precisam sobreviver à integração: nada de
`transition: all` (a página toca vídeo ao vivo); `backdrop-filter: blur` só nas folhas, nunca
sobre o vídeo em reprodução; teal `#45D9C7` exclusivo do status "ao vivo"; ícones mantidos como
`mask-image`; `prefers-reduced-motion` respeitado; nenhum JavaScript novo.

> **A preencher quando acontecer** — anotar aqui, a cada rodada:
> - data e o que foi trocado;
> - se o V0 entregou HTML/CSS puro ou se precisou portar de React à mão;
> - ids que faltaram no resultado (o snippet de verificação está no fim do `PROMPT-V0.md`);
> - ajustes manuais feitos depois, e por quê;
> - versão publicada com o redesenho.

## 6. Como trabalhar com o Claude Code neste projeto

**Antes de tudo:** trabalhar dentro do clone do GitHub, nunca na cópia em `Documents`. Os três
`.md` (`CLAUDE.md`, `REDESIGN-CONTRATO.md`, `PROMPT-V0.md`) e este arquivo vão pra raiz do clone.

**Plan Mode** (`Shift+Tab` duas vezes) em qualquer tarefa com 3+ passos — a reconexão é uma
delas. Ler o plano inteiro antes de aprovar: é mais barato corrigir uma linha do plano do que
revisar 200 linhas de código depois.

**Uma tarefa por sessão**, com `/clear` entre elas. Conforme o contexto enche, ele segue cada vez
menos as instruções antigas — inclusive as do `CLAUDE.md`.

**Apontar arquivo com `@`** (`@public/app.js`) em vez de pedir pra ele varrer o projeto. Economiza
cota do Pro, que é a mesma do Claude Code.

**Mandar ler antes de editar.** Em arquivo grande, exigir explicitamente: *"leia
`public/app.js` inteiro antes de propor qualquer mudança"*. Sem isso ele às vezes reescreve por
cima de algo que não leu.

**Nunca deixar decidir sozinho:** adicionar dependência npm, mudar a paleta, tocar em `app.js`
durante o redesenho, mexer no formato dos eventos de sinalização, fazer bump de versão ou dar
push. Tudo isso passa por você.

**Ele não consegue testar WebRTC.** Não há como validar duas máquinas conversando de dentro do
terminal. Toda tarefa de mídia termina com o teste manual da checklist do `CLAUDE.md` — feito
por você, antes do commit.

**`/init` é opcional.** O `CLAUDE.md` já existe e está completo; se rodar mesmo assim, revisar o
que ele acrescentar em vez de aceitar direto.

**Commit por tarefa**, mensagem descrevendo o efeito e não o arquivo. Push só quando você pedir.

## 7. Como manter este arquivo

Ao fim de cada sessão de trabalho, atualizar: mover o que saiu da seção 3 para a seção 2,
registrar decisões novas na seção 4 e preencher a seção 5 quando o redesenho andar. Se uma
decisão aqui virar regra permanente, ela sobe para o `CLAUDE.md` — e sai daqui, pra não existir
em dois lugares.

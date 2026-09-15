# VIO — estado do projeto

Arquivo vivo. O `CLAUDE.md` guarda as regras permanentes (e fica curto de propósito); **este
guarda onde estamos**. Substitui o antigo `ESTADO-DO-PROJETO.md`, que ficou desatualizado.

Última atualização: **15/09/2026** · Versão do app: **1.3.0**

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

**Reconexão** (1.3.0) — queda de rede ou restart do servidor: o cliente volta sozinho para a
sala, sem F5. O `socket.id` muda na volta, então todos os mapas indexados por id são refeitos
do zero a partir do `room-state`. Quem estava compartilhando volta compartilhando — o
`localStream` sobrevive à queda de propósito, senão o navegador pediria a tela de novo. Se a
reentrada bater no limite de taxa (rede instável com o servidor vivo), o cliente espera e tenta
de novo, com jitter, até cinco vezes antes de pedir F5.

**Segurança** — rate limit próprio, sem biblioteca (criação de sala, entrada, sinalização,
ações de share, ping), cada um com sua janela e limpeza periódica; validação de `Origin`;
leitura do IP real atrás do proxy do Render; escape de nome de participante; nenhuma conta,
senha ou banco de dados.

**Identidade** — crédito "by NerdQuest Studios · fundado por Nine"; versão tocável abrindo o
changelog dentro do app; AGPLv3.

## 3. O que NÃO existe (apesar de discutido)

- **PWA** — não existe `manifest.json` nem service worker. "Instalável" hoje é zero.
- **Chat de voz** — foi desenhado em detalhe e chegou a existir um `voz.js` numa sessão que se
  perdeu antes de salvar. O código não existe. Os ícones já estão baixados em `public/icons/`
  (`microphone`, `microphone-slash`, `headphones`, `noise-cancelling-headphones`).
- **Câmera** — só a decisão de arquitetura (conexões separadas das de tela). Zero código.
- **TURN** — discutido a fundo (relay de último recurso, credenciais efêmeras, ligar por
  variável de ambiente), nada implementado. Só STUN do Google hoje.
  **Sintoma já confirmado na prática:** um amigo não consegue ver a tela de ninguém, enquanto a
  maioria vê normal. É a assinatura de NAT simétrico — STUN não atravessa, só TURN. Continua na
  posição 5 do roadmap por decisão, mas vale saber que para essa pessoa o VIO não funciona hoje,
  e nenhuma das features 1 a 4 muda isso.
- **Tauri + WASAPI** — 100% planejamento. Nenhum projeto Tauri criado.
- **Segurança pendente** — Helmet.js, validação formal de payload do Socket.IO, log
  estruturado, hash de senha (se um dia existir conta).

## 4. Decisões desta sessão (15/09/2026)

- **Teto de escopo escrito.** ~6 pessoas por sala, sem contas, sem gravação, sem chat de texto,
  sem SFU. A malha P2P completa não escala além disso, e voz é sempre-para-todos (diferente da
  tela, que é sob demanda). Sem essa linha, cada feature nova parecia justificada.
- **Ordem do roadmap:** reconexão → PWA → voz → câmera → TURN → Tauri. O redesenho visual anda
  em paralelo, porque toca arquivos diferentes.
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

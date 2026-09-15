# VIO

Compartilhamento de tela P2P pra assistir coisas junto com amigos, direto do navegador.
O servidor **nunca** transporta vídeo/áudio — ele só apresenta as pessoas umas às outras
dentro de uma sala (sinalização WebRTC). A mídia viaja peer-to-peer.

by NerdQuest Studios · fundado por Nine · AGPLv3

## O que o VIO NÃO é

Decisão explícita de escopo, não limitação temporária:

- Sem contas, senhas ou banco de dados. A sala nasce quando alguém entra e morre quando esvazia.
- Sem gravação, sem chat de texto, sem SFU / servidor de mídia.
- Teto de projeto: ~6 pessoas por sala (malha P2P completa não escala além disso).
- Não é Jitsi Meet. Feature que só faz sentido acima desse teto está fora.

## Arquitetura

- `@server.js` — Express + Socket.IO. Estado das salas em memória (`Map`), some no restart.
  Eventos: `join-room`, `start-share`, `stop-share`, `start-voice`, `stop-voice`, `signal`,
  `ping-teste`. `sharingIds` e `voiceIds` são listas separadas: tela e voz são independentes.
- `@public/app.js` — o cliente inteiro (~1200 linhas, JS puro, sem build). Uma
  `RTCPeerConnection` por par **por transmissão efetivamente assistida** — quem compartilha
  só conecta a quem está de fato olhando.
- `@public/style.css` — CSS único, mobile-first.
- **Reconexão:** na volta o `socket.id` **muda**, e todos os mapas do cliente
  (`participantes`, `sharingIds`, PCs, filas de ICE) são indexados por ele — nenhum sobrevive.
  O `localStream` sobrevive de propósito: derrubá-lo faria o navegador pedir a tela de novo.
- **Voz** (`vozPCs`) usa conexões **separadas** das de tela — nunca misturar tracks de
  microfone com tracks de tela na mesma PeerConnection. É **uma** conexão por par,
  bidirecional, e **sempre-para-todos** (a tela é sob demanda). Daí o teto de ~6.
- **`payload.canal`** (`'tela' | 'voz'`) é obrigatório na sinalização: com voz no ar, o mesmo
  par de pessoas pode ter três conexões, e sem o canal um candidato ICE de voz iria parar
  numa conexão de tela e a mataria em silêncio. O `papel` separa ida/volta da tela; o `canal`
  separa tela de voz. Câmera, quando existir, segue o mesmo padrão.
- Na malha de voz, **quem tem o `socket.id` menor faz a oferta**; o outro espera. Sem isso as
  duas pontas travam em `have-local-offer`.

## Stack e convenções

- Node >= 18, Express 4, Socket.IO 4. Sem framework de front, sem bundler, sem TypeScript.
- **Identificadores e comentários em português sem acento** (`iniciarCompartilhamento`,
  `origemPermitida`). Texto de interface leva acento normal.
- O rate limiter é feito à mão de propósito (`criarLimitador`, em `@server.js`) — não trocar
  por biblioteca.
- Ícones: SVGs já existentes em `public/icons/`. Não gerar ícone de interface novo.
- Cores: `#2727F5` para interação; teal (`--tela-glow`) significa **acontecendo agora** —
  o status "ao vivo" e o anel de quem está falando. Não usar para mais nada.
- Fonte Poppins; leituras técnicas (código da sala, ping) em monoespaçada.
- Áudio de tela: `echoCancellation`, `noiseSuppression` e `autoGainControl` **sempre false**.
  É regra de produto, não preferência — ligados, causam oscilação de volume.
- Alvo de toque mínimo: 44px.

## Comandos

```
npm install
npm start          # http://localhost:3000
```

Não existe suite de testes automatizados (lacuna conhecida). Teste manual obrigatório antes
de fechar qualquer tarefa que toque em mídia:

1. Duas abas no mesmo PC, mesma sala — compartilhar, assistir, parar.
2. PC + celular na mesma rede, pelo IP local.
3. Reinício do servidor com a sala aberta (simula o cold start do Render).

## Fora de limite

Regras **[HOOK]** são cumpridas por `@.claude/hooks/guard.js`, não por adesão a este texto.
Texto aqui é pedido; hook é portão. O caso do V0 mostra a diferença: o export **deve** ficar na
pasta, é a referência visual de onde o redesenho sai — o que não pode é ele ser commitado junto
num `git add .`. O hook separa as duas coisas sem depender de ninguém lembrar.

- **[HOOK]** Nunca adicionar dependência npm sem aprovação explícita.
- **[HOOK]** Nunca commitar `.env`, credencial de TURN ou qualquer segredo.
- **[HOOK]** Nunca dar push na `main` sem pedido explícito.
- **[HOOK]** Nunca commitar arquivo de ferramenta visual (`components/`, `lib/`, `*.tsx`,
  `pnpm-*.yaml`, `public/placeholder-*`).
- Nunca rotear mídia pelo servidor. Se uma solução exige o servidor tocar no stream, ela está
  errada pro VIO (exceção futura: TURN, que é relay de rede, não de aplicação).
- Não reescrever a interface em React/Tailwind. Código gerado por V0, Bolt.new ou Abacus entra
  como referência visual, nunca colado no repositório.
- Não mexer em `public/icons/` nem na paleta sem pedido.

## Versionamento

Fonte da verdade: o campo `version` de `@package.json`. Toda release mexe em **três** arquivos
com o mesmo conteúdo: `package.json`, `@CHANGELOG.md` e `@public/changelog.json` (é este que o
app exibe quando se toca no número da versão) — **[HOOK]**: o commit falha se `version` mudar
sem os outros dois. O app lê a versão de `/api/version`, servida a partir do `package.json`.

Semver: correção = PATCH, feature nova = MINOR. Versão atual: 1.6.0.

## Estrutura de pastas

Arquivo fora desta árvore é contaminação de ferramenta externa e sai antes do commit.

```
vio/
  server.js            sinalização + rate limit + arquivos estáticos
  package.json         version = fonte da verdade
  CHANGELOG.md
  ESTADO.md            onde estamos (arquivo vivo)
  REDESIGN-CONTRATO.md contrato de DOM · PROMPT-V0.md
  render.yaml          blueprint do Render (hospedagem ainda não decidida)
  .claude/
    settings.json      liga o hook
    hooks/guard.js     as regras [HOOK]
  public/
    index.html
    app.js             cliente inteiro
    style.css
    sw.js              service worker — nunca encosta em /socket.io/ nem em sala
    manifest.json      PWA
    icon-*.png         ícones do PWA (provisórios, ver @ESTADO.md)
    changelog.json     espelho do CHANGELOG.md, lido pelo app
    icons/*.svg        ícones de interface (mask-image)
```

## Roadmap — nesta ordem

1. **Câmera**. Conexões separadas; `canal: 'camera'`; troca frontal/traseira no celular.
2. **TURN**. Ligado por variável de ambiente, com credenciais efêmeras. Já há um caso
   confirmado de quem não conecta sem ele (NAT simétrico) — ver `@ESTADO.md`. É o item que
   mais muda a vida de quem hoje simplesmente não consegue usar o VIO.
3. **Tauri + WASAPI**. Não é "empacotar o front-end": exige captura de áudio por processo em
   Rust e injetar esse áudio na PeerConnection da WebView2. É o item mais caro da lista.

Reconexão (1.3.0), PWA (1.4.0) e chat de voz (1.5.0) saíram daqui — estão implementados.

## Segurança — pendências já mapeadas

Helmet.js (cabeçalhos HTTP), validação formal do payload dos eventos Socket.IO, log
estruturado, credenciais efêmeras de TURN. Nada disso bloqueia o roadmap acima.

Já implementado: rate limit por IP e por conexão, validação de `Origin`, leitura do IP real
atrás do proxy do Render, escape de nome de participante, e a ausência deliberada de contas
e banco de dados.

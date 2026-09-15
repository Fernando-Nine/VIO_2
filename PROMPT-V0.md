# Prompts pro V0 — redesenho visual do VIO

**Cole em três mensagens separadas, na ordem.** Um prompt único com os 57 ids sai truncado
no plano gratuito. Entre uma mensagem e outra, confira se o V0 respeitou os ids da anterior.

Se em algum momento ele começar a gerar React/Next/Tailwind, responda: *"Não. HTML e CSS
puros, dois arquivos, sem framework e sem build. Refaça."* Se insistir duas vezes, pare — pegue
o resultado como referência visual e peça ao Claude Code pra portar respeitando
`REDESIGN-CONTRATO.md`.

---

## MENSAGEM 1 — sistema visual + tela de entrada

> Quero que você atue como um UI/UX Designer Criativo. Vou te dar um app web real, com o
> JavaScript já pronto e imutável — você redesenha **só a aparência**.
>
> O app chama-se **VIO**: compartilhamento de tela peer-to-peer pra assistir filme, jogo ou
> live junto com amigos, direto do navegador. Tema escuro, clima de sala de cinema. O celular
> é o alvo principal.
>
> O objetivo é ser visualmente impactante, vivo e interativo, fugindo completamente do visual
> genérico de "template corporativo" ou "design padrão de IA". Pode ser ousado.
>
> ### Regras técnicas inegociáveis
>
> 1. **Entregue HTML e CSS puros, em dois arquivos separados (`index.html` e `style.css`).
>    Sem React, sem Next.js, sem Tailwind, sem build, sem npm, sem nenhuma biblioteca.**
> 2. **Não escreva JavaScript nenhum.** Nenhuma tag `<script>`. O comportamento já existe.
> 3. **Tema escuro fixo.** Não gere light mode nem toggle de tema.
> 4. Mobile-first de verdade: qualquer alvo clicável tem no mínimo 44×44px.
> 5. Fonte **Poppins** via Google Fonts (pesos 400/500/600/700/800). Não use Clash Display —
>    não está no Google Fonts. Pode usar peso 800 e tamanho grande nos títulos pra contraste.
> 6. **Proibido `transition: all`.** Anime apenas `transform`, `opacity`, `background-color`,
>    `border-color`, `box-shadow` e `backdrop-filter`, sempre nomeados. O app toca vídeo ao
>    vivo; `all` força recálculo de estilo a cada frame.
> 7. **`backdrop-filter: blur` só nos painéis deslizantes e na cobertura escura.** Proibido em
>    qualquer elemento sobreposto ao vídeo em reprodução contínua (barra de controles, selo
>    "ao vivo", tira de miniaturas) — no celular isso derruba o frame rate, porque o aparelho
>    já está codificando e decodificando vídeo ao mesmo tempo. Nesses elementos use gradiente
>    opaco ou fundo sólido com transparência simples.
> 8. Textura de ruído (noise), se usar: `background-image` com **data-URI SVG inline** de no
>    máximo ~1KB. Nenhum arquivo de imagem externo, nenhuma CDN.
> 9. Inclua um bloco `@media (prefers-reduced-motion: reduce)` desligando as animações.
> 10. **Ícones**: são `<span class="icone icone-NOME" aria-hidden="true"></span>`, pintados
>     por `mask-image: url('/icons/NOME.svg')` + `background-color: currentColor`. **Mantenha
>     exatamente esse mecanismo** — não troque por `<svg>` inline nem por biblioteca. Ícones
>     disponíveis: `user`, `user-add`, `key`, `rocket`, `computer`, `settings`, `wifi`,
>     `clock`, `cross`, `eye`, `eye-crossed`, `volume`, `volume-down`, `volume-slash`,
>     `voltar`.
>
> ### Paleta atual (ponto de partida, pode evoluir)
>
> ```css
> --bg: #0a0a14;  --superficie-solida: #17162a;
> --texto: #f5f3ff;  --texto-fraco: #a6a1c4;
> --marca: #2727f5;  --marca-forte: #5757ff;
> --tela-glow: #45d9c7;  --aviso: #f5a623;  --perigo: #ff5c5c;
> ```
>
> Duas amarras de marca: o azul `#2727F5` é **a** cor de interação, e o teal `#45D9C7` é
> **exclusivo** do status "ao vivo" — não use teal em mais nada, senão o sinal de transmissão
> ativa se perde no meio do design. Fora isso, é livre: mesh gradient no fundo, glow, sombras
> coloridas em vez de pretas, o que quiser.
>
> ### Nesta primeira mensagem, entregue só:
>
> **(a)** O bloco `:root` completo com todas as variáveis do sistema (cores, raios, sombras,
> durações, tipografia), os `@keyframes` reutilizáveis e o reset.
>
> **(b)** A **tela de entrada**: um cartão centralizado com a marca VIO, subtítulo, campo de
> nome, campo de código da sala com botão "Gerar" ao lado, botão primário grande "Entrar na
> sala", um parágrafo de dica e, no rodapé do cartão, um botão discreto de crédito mostrando
> a versão.
>
> **Ids obrigatórios nesta tela** (o JS busca por `getElementById` — se faltar um, o app
> quebra sem erro visível):
> `tela-entrada` · `form-entrar` · `input-nome` · `input-sala` · `btn-gerar-sala` ·
> `btn-versao` · `texto-versao`
>
> Detalhes que o JS assume: `#input-nome` é `<input type="text" maxlength="40">`;
> `#input-sala` é `<input type="text" maxlength="12">`; `#texto-versao` é um `<span>` dentro
> do `#btn-versao`; `#form-entrar` é um `<form>` de verdade, com o botão de entrar como
> `type="submit"`.
>
> A seção raiz precisa ser `<section id="tela-entrada" class="tela tela-entrada">` e o CSS
> precisa ter uma classe `.oculto` que esconde o elemento (`display: none`) — é assim que o
> JS troca de tela.

---

## MENSAGEM 2 — tela da sala

> Agora a segunda tela, no mesmo sistema visual. Mesmas regras técnicas da mensagem anterior.
>
> A **tela da sala** tem três faixas verticais: cabeçalho, palco de vídeo, rodapé.
>
> - **Cabeçalho**: botão de voltar à esquerda; ao centro uma "pílula" com um ponto de status
>   colorido e o código da sala em fonte monoespaçada; à direita um botão de participantes
>   com um contador numérico sobreposto (badge).
> - **Palco**: ocupa todo o espaço restante. Dentro dele, empilhados:
>   - o `<video>` principal, preenchendo a moldura;
>   - um overlay de placeholder (ícone + duas linhas de texto) para quando ninguém está
>     compartilhando;
>   - no topo, um selo "AO VIVO" com um ponto pulsante;
>   - uma tira horizontal de miniaturas das transmissões ativas, rolável no eixo X, cada
>     miniatura é um cartão com um `<video>` pequeno, uma inicial de fallback e um rótulo com
>     o nome;
>   - um botão flutuante "Ativar o som";
>   - na base, a barra de controles: botão de mudo + slider de volume, botão de alternar a
>     prévia, espaçador, botão de tela cheia.
> - **Rodapé**: botão de ajustes (ícone) e o botão primário "Compartilhar tela".
>
> **Ids obrigatórios:**
> `tela-sala` · `btn-sair-sala` · `btn-info-sala` · `ponto-ping` · `texto-codigo-sala` ·
> `btn-participantes` · `contador-participantes` · `moldura-video` · `video-remoto` ·
> `overlay-placeholder` · `texto-placeholder` · `dica-placeholder` · `barra-topo` ·
> `selo-ao-vivo` · `tira-transmissoes` · `btn-desbloquear-audio` · `barra-video` ·
> `controle-volume` · `btn-mutar-local` · `icone-volume` · `range-volume` ·
> `btn-alternar-previa` · `icone-previa` · `btn-tela-cheia` · `btn-ajustes` · `btn-compartilhar`
>
> **Detalhes que o JS assume:**
> - `#video-remoto` é `<video autoplay playsinline>`.
> - `#range-volume` é `<input type="range" min="0" max="100" value="100">`.
> - `#btn-compartilhar` tem o conteúdo **substituído** pelo JS (vira "Parar compartilhamento").
>   Dentro dele, só um `<span class="icone icone-computer">` e texto — nada aninhado além disso.
> - `#icone-volume` e `#icone-previa` são os `<span class="icone">` cujas classes o JS troca.
>
> **Classes de estado que o JS liga e desliga — todas precisam ter efeito visual no CSS:**
> - `.oculto` — esconde (vale para `#barra-topo`, `#selo-ao-vivo`, `#tira-transmissoes`,
>   `#barra-video`, `#controle-volume`, `#btn-alternar-previa`, `#btn-desbloquear-audio`).
> - `.ao-vivo` — no `#selo-ao-vivo`.
> - `.compartilhando` — no `#btn-compartilhar`: precisa ficar visivelmente diferente (estado
>   destrutivo/ativo), é como a pessoa sabe que está no ar.
> - `.controles-ocultos` — vai na `#moldura-video` quando o mouse/dedo fica parado 3s: some a
>   barra inferior, a tira e o brilho, com transição suave. Volta ao menor movimento.
> - `.sem-previa` — na moldura, quando a prévia própria está oculta.
> - `.ping-bom` / `.ping-medio` / `.ping-ruim` — no `#ponto-ping`: verde / âmbar / vermelho.
> - `.icone-eye` ↔ `.icone-eye-crossed` e `.icone-volume` / `.icone-volume-down` /
>   `.icone-volume-slash` — trocadas pelo JS, cada uma com seu `mask-image`.
>
> **Classes que o JS cria em tempo de execução** (não aparecem no HTML, mas precisam existir
> no CSS): `.cartao-transmissao` (o cartão da miniatura, com `.ativo` quando é o que está em
> foco), e dentro dele um `<video>`, um `.cartao-inicial` e um `.rotulo-cartao`.
>
> Capriche nas microinterações: hover com leve escala nos controles, glow no botão primário,
> pulso no ponto do selo "ao vivo", transição suave ao aparecer e sumir dos controles. Lembre
> da regra 7: nada de `backdrop-filter` sobre o vídeo.

---

## MENSAGEM 3 — folhas deslizantes, alerta e cobertura

> Última parte, mesmo sistema visual e mesmas regras técnicas.
>
> São **quatro painéis deslizantes** ("folhas"): no celular sobem de baixo, ocupando parte da
> altura, com uma alça no topo; no desktop (a partir de ~860px) viram painéis ancorados à
> direita. Fechadas por padrão; a classe `.aberta` é o que as mostra. Atrás delas, uma
> cobertura escura em tela cheia que ganha a classe `.visivel`.
>
> **Estas são as únicas superfícies onde `backdrop-filter: blur` é permitido** — aproveite,
> é aqui que o glassmorphism rende.
>
> 1. **Sobre a sala** — três linhas rótulo/valor (Código, No ar há, Ping) e um botão primário
>    grande "Copiar link de convite".
> 2. **Quem está na sala** — uma `<ul>` vazia que o JS preenche.
> 3. **Ajustes** — um interruptor (toggle) "Som da tela"; um grupo segmentado de três botões
>    (Alta / Média / Baixa); três sliders com valor numérico ao lado do rótulo; e um parágrafo
>    de nota no fim.
> 4. **O que mudou** — um contêiner que o JS preenche com o histórico de versões.
>
> Mais um **alerta** flutuante (toast) e a **cobertura**.
>
> **Ids obrigatórios:**
> `cobertura` · `alerta` ·
> `folha-info-sala` · `btn-fechar-info-sala` · `texto-codigo-completo` · `texto-duracao-sala` ·
> `texto-ping-completo` · `btn-copiar-link` ·
> `painel-participantes` · `btn-fechar-participantes` · `lista-participantes` ·
> `painel-avancado` · `btn-fechar-avancado` · `rotulo-chk-audio` · `chk-audio` ·
> `segmentado-qualidade` · `range-fps` · `valor-fps` · `range-bitrate` · `valor-bitrate` ·
> `range-escala` · `valor-escala` · `nota-surface` ·
> `folha-changelog` · `btn-fechar-changelog` · `lista-changelog`
>
> **Detalhes que o JS assume:**
> - `#chk-audio` é `<input type="checkbox" checked>` dentro do `<label id="rotulo-chk-audio"
>   for="chk-audio">`.
> - `#segmentado-qualidade` contém **exatamente três** `<button type="button">` com
>   `data-valor="alta"`, `data-valor="media"` e `data-valor="baixa"`. O JS lê
>   `querySelectorAll('button')` e o `data-valor`, e marca o escolhido com a classe `.ativo`.
> - Sliders: `#range-fps` (`min=5 max=60 step=1 value=24`), `#range-bitrate`
>   (`min=0.3 max=8 step=0.1 value=2.5`), `#range-escala` (`min=30 max=100 step=5 value=100`).
>   Cada um tem ao lado um `<b>` com o id `valor-fps` / `valor-bitrate` / `valor-escala`.
> - `#lista-participantes` é `<ul>` e `#lista-changelog` é uma `<div>` — ambos preenchidos
>   pelo JS.
>
> **Classes que o JS cria e que precisam existir no CSS:**
> - Na lista de participantes: `.nome-participante`, `.avatar-participante` (círculo com as
>   iniciais), `.etiqueta-voce`, `.etiqueta-compartilhando`.
> - No changelog: `.bloco-changelog`, `.etiqueta-tipo` mais as variantes
>   `.etiqueta-adicionado`, `.etiqueta-corrigido`, `.etiqueta-alterado`, `.etiqueta-seguranca`
>   (cores distintas entre si).
> - `.nota-avancado` — texto pequeno e fraco, usado em notas e mensagens de carregamento.
>
> **Atenção a uma coisa:** o JS reconstrói a lista de participantes inteira a cada mudança.
> Se você puser animação de entrada nos itens da lista, ela vai disparar em **todos** os
> participantes toda vez que alguém entra ou sai. Ou faça a animação bem sutil e curta
> (≤150ms, só opacidade), ou não anime os itens da lista — anime a folha.

---

## SEÇÃO 4 (opcional) — componentes reservados de voz e câmera

Voz e câmera ainda não existem no código. Peça isto só se quiser já deixar o visual pronto —
custa pouco agora e evita redesenhar tudo daqui a duas features. **Nada disto pode entrar no
`index.html`**: é só CSS, guardado pra quando o comportamento existir.

> Por último, desenhe três componentes que ainda não estão ligados a nada. Entregue **apenas
> o CSS** deles, comentado como "reservado — ainda não ligado", sem adicionar nada ao HTML:
>
> 1. `.botao-mic` e `.botao-camera` — botões redondos de controle, no mesmo peso visual dos
>    controles do rodapé, cada um com estado normal, `.ativo` e `.desligado` (vermelho de
>    perigo). Ícones disponíveis: `microphone`, `microphone-slash`, `video-camera-alt`,
>    `video-slash`, `headphones`, `noise-cancelling-headphones`, `rotate-right`.
> 2. `.falando` — um modificador do `.avatar-participante`: anel pulsante em volta do avatar
>    de quem está falando. Anime só `transform` e `opacity` (a regra 6 continua valendo), e
>    respeite `prefers-reduced-motion`.
> 3. `.medidor-voz` — uma barrinha horizontal de nível de áudio, para a tela de ajustes de
>    microfone, com o preenchimento controlado por uma variável CSS `--nivel` (0 a 100).

---

## Depois que o V0 entregar

1. Salvar como `public/index.html` e `public/style.css`, substituindo.
2. Conferir que as duas últimas tags do `<body>` continuam lá, nessa ordem:
   `<script src="/socket.io/socket.io.js"></script>` e depois `<script src="/app.js"></script>`.
3. Conferir o `<link rel="stylesheet" href="/style.css">` no `<head>`.
4. `npm start`, abrir `http://localhost:3000` e rodar no console:

```js
['tela-entrada','form-entrar','input-nome','input-sala','btn-gerar-sala','btn-versao',
 'texto-versao','tela-sala','btn-sair-sala','btn-info-sala','ponto-ping','texto-codigo-sala',
 'btn-participantes','contador-participantes','moldura-video','video-remoto',
 'overlay-placeholder','texto-placeholder','dica-placeholder','barra-topo','selo-ao-vivo',
 'tira-transmissoes','btn-desbloquear-audio','barra-video','controle-volume','btn-mutar-local',
 'icone-volume','range-volume','btn-alternar-previa','icone-previa','btn-tela-cheia',
 'btn-ajustes','btn-compartilhar','cobertura','alerta','folha-info-sala',
 'btn-fechar-info-sala','texto-codigo-completo','texto-duracao-sala','texto-ping-completo',
 'btn-copiar-link','painel-participantes','btn-fechar-participantes','lista-participantes',
 'painel-avancado','btn-fechar-avancado','rotulo-chk-audio','chk-audio','segmentado-qualidade',
 'range-fps','valor-fps','range-bitrate','valor-bitrate','range-escala','valor-escala',
 'nota-surface','folha-changelog','btn-fechar-changelog','lista-changelog']
  .filter(id => !document.getElementById(id))
```

Resultado esperado: `[]`. Qualquer id que aparecer aí é uma funcionalidade morta.

5. Rodar a checklist de teste manual do `CLAUDE.md` (duas abas, PC + celular, reinício do
   servidor) antes do bump de versão MINOR nos três arquivos de changelog.

# Contrato de DOM — redesenho visual do VIO

O `public/app.js` (1183 linhas) manipula a interface por **id**, **classe** e **seletor**.
Se o markup novo mudar qualquer nome desta lista, a funcionalidade quebra em silêncio — sem
erro no console, só um botão que não responde.

A regra do redesenho é uma só: **troca-se `index.html` e `style.css`; `app.js` não muda.**

---

## 1. Como usar o V0 sem quebrar nada

O V0 gera React + Tailwind por padrão. Isso **não** serve aqui: o VIO é HTML servido direto
pelo Express, sem build. Dois caminhos:

- **Preferido** — pedir explicitamente HTML + CSS puros (prompt pronto na seção 4).
- **Fallback** — se o V0 insistir em React, use o resultado apenas como *referência visual*:
  screenshot + paleta + espaçamentos. O Claude Code porta pra HTML/CSS respeitando este
  contrato. Custa uma tarefa a mais e continua muito mais barato do que reescrever o app.js.

Não colar código de V0 direto no repositório em nenhum dos dois casos.

---

## 2. Contrato de DOM — ids obrigatórios

Todos consultados via `getElementById`. Ausente = `null` = erro em tempo de execução.

**Telas e estrutura**
`tela-entrada` · `tela-sala` · `cobertura` · `alerta`

**Tela de entrada**
`form-entrar` · `input-nome` · `input-sala` · `btn-gerar-sala` · `btn-versao` · `texto-versao`

**Cabeçalho da sala**
`btn-sair-sala` · `btn-info-sala` · `ponto-ping` · `texto-codigo-sala` · `btn-participantes` ·
`contador-participantes`

**Palco de vídeo**
`moldura-video` · `video-remoto` · `overlay-placeholder` · `texto-placeholder` ·
`dica-placeholder` · `barra-topo` · `selo-ao-vivo` · `tira-transmissoes` ·
`btn-desbloquear-audio` · `barra-video` · `controle-volume` · `btn-mutar-local` ·
`icone-volume` · `range-volume` · `btn-alternar-previa` · `icone-previa` · `btn-tela-cheia`

**Rodapé**
`btn-ajustes` · `btn-compartilhar`

**Folha "Sobre a sala"**
`folha-info-sala` · `btn-fechar-info-sala` · `texto-codigo-completo` · `texto-duracao-sala` ·
`texto-ping-completo` · `btn-copiar-link`

**Folha "Quem está na sala"**
`painel-participantes` · `btn-fechar-participantes` · `lista-participantes`

**Folha "Ajustes"**
`painel-avancado` · `btn-fechar-avancado` · `rotulo-chk-audio` · `chk-audio` ·
`segmentado-qualidade` · `range-fps` · `valor-fps` · `range-bitrate` · `valor-bitrate` ·
`range-escala` · `valor-escala` · `nota-surface`

**Folha "O que mudou"**
`folha-changelog` · `btn-fechar-changelog` · `lista-changelog`

## 3. Tipos e atributos que o JS assume

- `#video-remoto` precisa ser `<video autoplay playsinline>`.
- `#chk-audio` precisa ser `<input type="checkbox">` dentro do `<label id="rotulo-chk-audio">`.
- `#range-volume` `<input type="range" min=0 max=100>`.
- `#range-fps` `min=5 max=60 step=1` · `#range-bitrate` `min=0.3 max=8 step=0.1` ·
  `#range-escala` `min=30 max=100 step=5`.
- `#segmentado-qualidade` precisa conter exatamente 3 `<button>` com
  `data-valor="alta|media|baixa"` — o JS lê `querySelectorAll('button')` e o `data-valor`.
- `#btn-compartilhar` tem o `innerHTML` **substituído** pelo JS (vira "Parar compartilhamento").
  Não aninhar estrutura dentro dele além de um `<span class="icone icone-computer">`.

**Classes que o JS liga e desliga** (o CSS novo tem que dar sentido visual a todas):
`oculto` (esconde) · `aberta` (folha visível) · `visivel` (cobertura) · `ativo` (botão do
segmentado) · `ao-vivo` · `compartilhando` · `controles-ocultos` (barra some por inatividade) ·
`sem-previa` · `ping-bom` / `ping-medio` / `ping-ruim` (ponto de status) ·
`icone-eye` ↔ `icone-eye-crossed` · `icone-volume` / `icone-volume-down` / `icone-volume-slash`

**Classes que o JS cria do zero** (não aparecem no HTML, mas precisam existir no CSS):
`bloco-changelog` · `etiqueta-tipo` + `etiqueta-adicionado|corrigido|alterado|seguranca` ·
`nome-participante` · `avatar-participante` · `etiqueta-voce` · `etiqueta-compartilhando` ·
`cartao-transmissao` · `cartao-inicial` · `rotulo-cartao` · `nota-avancado`

**Seletores relativos usados pelo JS:** dentro de `.cartao-transmissao` ele busca `video`,
`.cartao-inicial` e `.rotulo-cartao`.

## 4. Prompt pronto pra colar no V0

> Preciso do redesenho visual de um app web de compartilhamento de tela chamado VIO.
> **Entregue HTML e CSS puros, em dois arquivos separados (`index.html` e `style.css`).
> Sem React, sem Next.js, sem Tailwind, sem build, sem framework, sem npm.** Todo o
> comportamento já existe num `app.js` que eu não vou alterar.
>
> Tema escuro, mobile-first de verdade (o celular é o alvo principal; no desktop as folhas
> viram painéis ancorados). Alvo de toque mínimo de 44px. Fonte Poppins. Azul `#2727F5` como
> cor de interação; o teal `#45D9C7` é reservado exclusivamente ao status "ao vivo".
>
> Ícones são `<span class="icone icone-NOME">` pintados por `mask-image` a partir de SVGs em
> `/icons/` — mantenha exatamente esse mecanismo, não troque por `<svg>` inline nem por
> biblioteca de ícones.
>
> Telas: (1) entrada — cartão com nome, código da sala, botão gerar, botão entrar, crédito;
> (2) sala — cabeçalho com voltar / pílula do código com ponto de status / contador de
> participantes; palco de vídeo com overlay de placeholder, selo AO VIVO, tira horizontal de
> miniaturas das transmissões e barra inferior de controles (volume, prévia, tela cheia);
> rodapé com ajustes e o botão primário de compartilhar; quatro folhas deslizantes (Sobre a
> sala, Quem está na sala, Ajustes com sliders, O que mudou).
>
> **Obrigatório: preservar exatamente os ids, classes e atributos da lista abaixo.** Pode
> mudar hierarquia, layout, cor, espaçamento e animação à vontade — mas cada id precisa
> existir, no mesmo tipo de elemento.
>
> [colar as seções 2 e 3 deste arquivo]

## 5. Integração

1. Salvar o resultado como `public/index.html` e `public/style.css` (substituindo).
2. Conferir que as duas últimas tags continuam lá, nessa ordem:
   `<script src="/socket.io/socket.io.js"></script>` e `<script src="/app.js"></script>`.
3. Manter o `<link rel="stylesheet" href="/style.css">` e o preconnect do Google Fonts.
4. `npm start` e rodar a checklist de teste manual do `CLAUDE.md`.
5. Só então bump de versão (MINOR) nos três arquivos de changelog.

Verificação rápida antes de commitar — no console do navegador, com a sala aberta:

```js
['tela-entrada','tela-sala','video-remoto','tira-transmissoes','segmentado-qualidade',
 'range-fps','chk-audio','lista-participantes','lista-changelog','alerta','cobertura']
  .filter(id => !document.getElementById(id))
```

Resultado esperado: array vazio. (Lista curta de sanidade — a lista completa é a seção 2.)

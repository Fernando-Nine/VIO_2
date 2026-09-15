# Changelog

Todas as mudanças notáveis do VIO são documentadas aqui. O formato segue as
convenções do [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/), e o projeto
segue [Versionamento Semântico](https://semver.org/lang/pt-BR/) (MAJOR.MINOR.PATCH).

O mesmo conteúdo fica disponível dentro do próprio app, tocando no número da versão na
tela de entrada.

## [1.5.0] - 2026-09-15

### Adicionado
- Conversa por voz na sala. O botão de microfone no rodapé entra na conversa;
  tocando de novo você fica mudo, mas continua ouvindo todo mundo.
- O avatar de quem está falando ganha um anel, e a folha "Quem está na sala"
  mostra o nível do seu próprio microfone — dá pra conferir se ele está pegando.
- Um "?" ao lado de "Quem está na sala" explica por que existe um limite de
  pessoas por sala.

### Alterado
- O teal deixa de ser exclusivo do status "ao vivo" e passa a significar
  "acontecendo agora": vale também para quem está falando.

### Corrigido
- O botão "Ativar o som" aparecia o tempo todo desde a 1.4.0, mesmo sem nada
  para desbloquear. Agora só aparece quando o navegador realmente segurou o
  áudio — e destrava tanto o vídeo quanto as vozes da conversa.

## [1.4.0] - 2026-09-15

### Adicionado
- O VIO agora é instalável: dá para adicionar à tela inicial do celular ou
  instalar como aplicativo no computador, e ele abre em janela própria. O ícone
  é provisório — a própria marca da tela de entrada ampliada — até a arte
  definitiva existir.
- A tela de entrada abre mesmo sem internet. Entrar numa sala continua exigindo
  conexão, naturalmente: o que fica disponível offline é só a casca do app.

## [1.3.0] - 2026-09-15

### Adicionado
- Reconexão automática. Se a rede oscilar ou o servidor reiniciar, o VIO volta
  sozinho para a sala — antes só resolvia atualizando a página.
- Quem está compartilhando volta compartilhando: a tela capturada sobrevive à
  queda, então o navegador não pergunta de novo o que compartilhar.
- Aviso na tela durante a reconexão e nova tentativa automática, com espera
  crescente, quando o servidor está ocupado demais para receber de volta.

## [1.2.0] - 2026-08-24

### Alterado
- Cada transmissão agora só se conecta a quem está de fato assistindo ela no
  momento, em vez de ir automaticamente para a sala inteira — usa menos banda
  quando várias pessoas compartilham ao mesmo tempo.

### Corrigido
- O brilho ao redor do vídeo não desaparecia com a inatividade nem em tela
  cheia, atrapalhando a visualização.

### Adicionado
- Aviso na tela quando uma conexão específica falha, em vez de só ficar com
  a tela preta sem explicação.
- Licença AGPLv3; README reescrito como apresentação do projeto.

## [1.1.0] - 2026-08-23

### Segurança
- Limite de taxa para criação de salas e para mensagens de sinalização por conexão.
- Validação de origem (`Origin`) nas conexões do Socket.IO.

### Adicionado
- Número de versão e este histórico de mudanças, acessível direto no app.

## [1.0.1]

### Corrigido
- As folhas (Ajustes, Participantes, Sobre a sala) continuavam clicáveis mesmo
  fechadas no computador, roubando clique de outros botões por trás.

## [1.0.0]

### Alterado
- Interface refeita do zero com metodologia mobile-first: alvos de toque de 44px+,
  folhas deslizantes no lugar de menus apertados, fonte Poppins.

### Adicionado
- Seletor de transmissões com miniatura de vídeo ao vivo de cada pessoa
  compartilhando, em vez de só o nome.

### Corrigido
- Estouro de tela para os lados em telas estreitas.

## [0.5.0]

### Alterado
- Rebrand de "Tela Junto" para VIO.

### Adicionado
- Configuração pronta (`render.yaml`) para publicar no Render.

## [0.3.0]

### Adicionado
- Suporte a mais de uma pessoa compartilhando a tela ao mesmo tempo na mesma sala.

### Corrigido
- Conexão quebrava quando duas pessoas compartilhavam uma para a outra
  simultaneamente (roteamento incorreto de candidatos ICE).

## [0.2.0]

### Adicionado
- Prévia da própria tela para quem compartilha, com opção de ocultar.
- Volume individual e tela cheia para quem assiste.
- Sons de início/fim de compartilhamento e indicador de ping.

### Corrigido
- Áudio da tela vinha com cancelamento de eco, supressão de ruído e ganho
  automático ligados por padrão (comportamento padrão dos navegadores),
  causando oscilação de volume — todos desligados explicitamente.

## [0.1.0]

### Adicionado
- Primeira versão: compartilhamento de tela com controle de qualidade/FPS e
  roteamento de áudio.

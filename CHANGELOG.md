# Changelog

Todas as mudanças notáveis do VIO são documentadas aqui. O formato segue as
convenções do [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/), e o projeto
segue [Versionamento Semântico](https://semver.org/lang/pt-BR/) (MAJOR.MINOR.PATCH).

O mesmo conteúdo fica disponível dentro do próprio app, tocando no número da versão na
tela de entrada.

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

<div align="center">

# VIO

**Assista telas com os amigos, sem intermediário no meio do caminho.**

[![Licença: AGPLv3](https://img.shields.io/badge/licen%C3%A7a-AGPLv3-blue.svg)](LICENSE)
[![Node](https://img.shields.io/badge/node-%3E%3D18-brightgreen.svg)](https://nodejs.org)

**[Acessar o VIO →](https://vio-0ia0.onrender.com/)**

</div>

---

## O que é

VIO é um app de compartilhamento de tela pra assistir coisas junto com os amigos —
filme, jogo, live, o que for — direto do navegador. Nasceu de uma vontade simples: algo
parecido com o "compartilhar tela" do Discord, mas com mais controle sobre a qualidade
quando a internet de alguém não colabora, e sem depender da infraestrutura de mais
ninguém.

O vídeo e o áudio nunca passam por nenhum servidor — eles viajam direto entre os
computadores de quem está assistindo, o que faz VIO ser rápido e também bem mais
simples (e barato) de manter no ar.

## Como usar

Mais de uma pessoa pode compartilhar ao mesmo tempo, ou se revezar — não existe um
"dono" da sala.

1. Abra o link acima (ou o seu próprio, se estiver rodando localmente).
2. Digite seu nome e um código de sala — combine o mesmo código com quem for entrar.
3. Toque em **Compartilhar tela** e escolha o que quer mostrar.

Quem só quer assistir pode entrar por qualquer navegador, inclusive pelo celular.
Compartilhar a própria tela, por enquanto, só funciona em computador — é uma limitação
dos navegadores móveis em si, não do VIO (mais detalhes abaixo).

## Como funciona por dentro

A peça central é o **WebRTC**: depois que duas pessoas se encontram numa sala, o vídeo e
o áudio fluem diretamente entre elas, ponto a ponto. O servidor entra em cena só pra
apresentar as pessoas umas às outras (quem entrou, quem está compartilhando) — depois
disso, ele sai do caminho. Isso tem uma consequência direta e prática: quando você ajusta
a qualidade, é o *upload da sua própria conexão* que está sendo poupado, não a do
servidor.

Cada transmissão só se conecta a quem está de fato assistindo ela naquele momento — se
ninguém está olhando, não existe conexão gastando banda à toa, mesmo com várias pessoas
compartilhando ao mesmo tempo na mesma sala.

Outras decisões que valem menção:

- **Áudio sem processamento.** Os navegadores aplicam, por padrão, cancelamento de eco e
  ganho automático a qualquer áudio capturado — pensados pra chamada de voz, não pra
  filme ou jogo. O VIO desliga os dois explicitamente, então o som que sai é o som
  original, sem oscilar de volume sozinho.
- **Interface mobile-first.** Construída primeiro pensando no toque — alvos de toque
  generosos, painéis que deslizam de baixo — com o desktop ganhando camadas por cima,
  não o contrário.
- **Sem conta, sem senha, sem banco de dados.** Menos peças significam menos coisa pra
  dar errado (e menos superfície de ataque).

## O que ainda não dá pra fazer

Duas limitações valem ser ditas com todas as letras, porque são do navegador, não do
VIO:

- **Isolar o áudio de uma janela específica** (tipo só o som de um jogo) não é possível
  hoje em nenhum navegador — só existe API pra isso a nível de aba (áudio isolado direito)
  ou de tela inteira (áudio do sistema todo, e só em alguns sistemas operacionais).
- **Compartilhar a própria tela pelo celular** também não existe ainda em nenhum
  navegador móvel — só teria como resolver isso com um aplicativo nativo.

## Auto-hospedagem

Prefere rodar você mesmo, seja no seu computador ou em outro provedor? É um projeto
Node.js comum:

```bash
npm install
npm start
```

Abre em `http://localhost:3000`. Pra deixar acessível pra fora da sua rede, qualquer
serviço de túnel (Cloudflare Tunnel, por exemplo) ou provedor de hospedagem que rode
Node.js serve — o `server.js` não tem nada específico de nenhum provedor.

## Contribuindo

Issues e pull requests são bem-vindos. Não tem um processo formal ainda — abra uma issue
contando o que você tem em mente antes de meter a mão em algo grande, só pra alinhar
expectativa antes de qualquer trabalho.

## Licença

VIO é licenciado sob **[AGPLv3](LICENSE)**. Na prática: você pode usar, estudar,
modificar e redistribuir o código, inclusive comercialmente — mas se você rodar uma
versão modificada como um serviço que outras pessoas usam pela rede, precisa
disponibilizar o código dessa versão modificada também, sob a mesma licença.

## Versão e changelog

A versão atual e o histórico completo de mudanças ficam dentro do próprio app — toque no
número da versão na tela inicial. O mesmo conteúdo também está em
[`CHANGELOG.md`](CHANGELOG.md).

---

<div align="center">

by **NerdQuest Studios** · fundado por **Nine**

</div>

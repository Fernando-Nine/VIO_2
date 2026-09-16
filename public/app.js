// app.js — logica do cliente (roda no navegador)
//
// Resumo do fluxo:
// 1) Entra numa sala (socket.io so serve pra sinalizacao/coordenacao).
// 2) Qualquer participante pode compartilhar a tela — inclusive varios ao
//    mesmo tempo. Quem compartilha abre uma RTCPeerConnection DIRETA para
//    cada outro participante (o servidor nunca ve o video/audio, so ajuda a
//    trocar as mensagens de conexao).
// 3) Cada espectador escolhe, do seu lado, qual transmissao ativa quer ver
//    em foco (estado.focoAtual) — a tira de miniaturas deixa isso visual.
// 4) Os controles de qualidade ajustam bitrate/fps/resolucao ao vivo, sem
//    precisar parar e comecar a compartilhar de novo.

const suportaCompartilhamento = !!(navigator.mediaDevices && navigator.mediaDevices.getDisplayMedia);

const ICE_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
];

const QUALIDADE_PRESETS = {
  alta: { fps: 30, bitrateMbps: 6, escalaPercentual: 100 },
  media: { fps: 24, bitrateMbps: 2.5, escalaPercentual: 100 },
  baixa: { fps: 15, bitrateMbps: 0.8, escalaPercentual: 60 },
};

const PALAVRAS_SALA = ['PIPOCA', 'SESSAO', 'BUTECO', 'MARATONA', 'CINEMINHA', 'REBOOT', 'PLATEIA', 'SOFA', 'TELAO', 'CORUJAO'];

const DURACAO_INATIVIDADE_MS = 3000;

// A camera nao tem controle de qualidade proprio: os ajustes de qualidade sao da
// TELA (texto pequeno, leitura). Rosto em 720p/30fps cabe folgado em 1.2 Mbps, e
// como a camera e sob demanda, esse teto so pesa quando alguem esta olhando.
const BITRATE_CAMERA = 1_200_000;

// Acima disso o avatar ganha o anel de "falando". Baixo o bastante pra pegar voz
// normal, alto o bastante pra nao piscar com ruido de fundo.
const LIMIAR_FALANDO = 8;

// ---------------------------------------------------------------------------
// Referencias DOM
// ---------------------------------------------------------------------------

const telaEntrada = document.getElementById('tela-entrada');
const telaSala = document.getElementById('tela-sala');

const formEntrar = document.getElementById('form-entrar');
const inputNome = document.getElementById('input-nome');
const inputSala = document.getElementById('input-sala');
const btnGerarSala = document.getElementById('btn-gerar-sala');

const btnSairSala = document.getElementById('btn-sair-sala');
const btnInfoSala = document.getElementById('btn-info-sala');
const pontoPing = document.getElementById('ponto-ping');
const textoCodigoSala = document.getElementById('texto-codigo-sala');
const btnParticipantes = document.getElementById('btn-participantes');
const contadorParticipantes = document.getElementById('contador-participantes');

const molduraVideo = document.getElementById('moldura-video');
const videoRemoto = document.getElementById('video-remoto');
const overlayPlaceholder = document.getElementById('overlay-placeholder');
const textoPlaceholderEl = document.getElementById('texto-placeholder');
const dicaPlaceholderEl = document.getElementById('dica-placeholder');
const barraTopo = document.getElementById('barra-topo');
const seloAoVivo = document.getElementById('selo-ao-vivo');
const tiraTransmissoes = document.getElementById('tira-transmissoes');
const btnDesbloquearAudio = document.getElementById('btn-desbloquear-audio');

const barraVideo = document.getElementById('barra-video');
const controleVolume = document.getElementById('controle-volume');
const btnMutarLocal = document.getElementById('btn-mutar-local');
const iconeVolume = document.getElementById('icone-volume');
const rangeVolume = document.getElementById('range-volume');
const btnAlternarPrevia = document.getElementById('btn-alternar-previa');
const iconePrevia = document.getElementById('icone-previa');
const btnTelaCheia = document.getElementById('btn-tela-cheia');

const btnAjustes = document.getElementById('btn-ajustes');
const btnMicrofone = document.getElementById('btn-microfone');
const iconeMicrofone = document.getElementById('icone-microfone');
const btnFone = document.getElementById('btn-fone');
const iconeFone = document.getElementById('icone-fone');
const blocoMicrofone = document.getElementById('bloco-microfone');
const rangeSensibilidade = document.getElementById('range-sensibilidade');
const valorSensibilidade = document.getElementById('valor-sensibilidade');
const rangeGanho = document.getElementById('range-ganho');
const valorGanho = document.getElementById('valor-ganho');
const selectEntrada = document.getElementById('select-entrada');
const selectSaida = document.getElementById('select-saida');
const blocoSaida = document.getElementById('bloco-saida');
const chkEco = document.getElementById('chk-eco');
const chkRuido = document.getElementById('chk-ruido');
const btnCamera = document.getElementById('btn-camera');
const iconeCamera = document.getElementById('icone-camera');
const btnVirarCamera = document.getElementById('btn-virar-camera');
const btnCompartilhar = document.getElementById('btn-compartilhar');
const medidorVozLocal = document.getElementById('medidor-voz-local');

// folhas (bottom sheets)
const cobertura = document.getElementById('cobertura');

const folhaInfoSala = document.getElementById('folha-info-sala');
const btnFecharInfoSala = document.getElementById('btn-fechar-info-sala');
const textoCodigoCompleto = document.getElementById('texto-codigo-completo');
const textoDuracaoSala = document.getElementById('texto-duracao-sala');
const textoPingCompleto = document.getElementById('texto-ping-completo');
const btnCopiarLink = document.getElementById('btn-copiar-link');

const btnVersao = document.getElementById('btn-versao');
const textoVersao = document.getElementById('texto-versao');
const folhaChangelog = document.getElementById('folha-changelog');
const btnFecharChangelog = document.getElementById('btn-fechar-changelog');
const listaChangelog = document.getElementById('lista-changelog');

const painelParticipantes = document.getElementById('painel-participantes');
const btnFecharParticipantes = document.getElementById('btn-fechar-participantes');
const btnLimiteSala = document.getElementById('btn-limite-sala');
const listaParticipantes = document.getElementById('lista-participantes');

const painelAvancado = document.getElementById('painel-avancado');
const btnFecharAvancado = document.getElementById('btn-fechar-avancado');
const rotuloChkAudio = document.getElementById('rotulo-chk-audio');
const chkAudio = document.getElementById('chk-audio');
const segmentadoQualidade = document.getElementById('segmentado-qualidade');
const botoesQualidade = [...segmentadoQualidade.querySelectorAll('button')];
const rangeFps = document.getElementById('range-fps');
const valorFps = document.getElementById('valor-fps');
const rangeBitrate = document.getElementById('range-bitrate');
const valorBitrate = document.getElementById('valor-bitrate');
const rangeEscala = document.getElementById('range-escala');
const valorEscala = document.getElementById('valor-escala');
const notaSurface = document.getElementById('nota-surface');
const chkPrevias = document.getElementById('chk-previas');
const notaSemVoz = document.getElementById('nota-sem-voz');
const abaVideo = document.getElementById('aba-video');
const abaAudio = document.getElementById('aba-audio');
const painelVideo = document.getElementById('painel-video');
const painelAudio = document.getElementById('painel-audio');

const alertaEl = document.getElementById('alerta');

const TODAS_FOLHAS = [folhaInfoSala, painelParticipantes, painelAvancado, folhaChangelog];

// ---------------------------------------------------------------------------
// Estado
// ---------------------------------------------------------------------------

const estado = {
  meuNome: '',
  roomId: '',
  naSala: false, // true entre entrar e sair — distingue queda de rede de saida voluntaria
  salaCriadaEm: null,
  participantes: new Map(), // id -> nome (todo mundo, EXCETO eu)
  sharingIds: new Set(), // quem esta compartilhando agora (pode ser mais de um, inclusive eu)
  streamsDisponiveis: new Map(), // chave "id|canal" -> MediaStream (transmissoes que ja consigo exibir)
  focoAtual: null, // chave da transmissao que estou vendo agora (pode ser a minha propria)
  localStream: null, // meu stream de captura, se eu estiver compartilhando
  streamPendente: null, // stream capturado aguardando confirmacao do servidor
  cameraIds: new Set(), // quem esta com a camera ligada (pode me incluir)
  cameraStream: null, // minha camera, se estiver ligada
  cameraFrontal: true, // qual lado da camera no celular (frontal = selfie)
  voiceIds: new Set(), // quem esta no canal de voz (pode me incluir)
  vozStream: null, // meu microfone, se eu estiver na voz
  vozMudo: false, // mudo local: a conexao continua, a track e que para de mandar
  vozSurdo: false, // "fone desligado": nao ouco ninguem E nao mando nada
  mudosLocais: new Set(), // pessoas que EU silenciei — so pra mim, ninguem sabe
  volumesLocais: new Map(), // id -> 0..100, volume individual de cada pessoa (so pra mim)
  previasAoVivo: false, // conectar em TODAS as transmissoes so pra mostrar miniatura
  micBruto: null, // o que sai do getUserMedia, antes do grafo de audio
  micEco: true, // cancelamento de eco
  micRuido: true, // supressao de ruido
  micGanho: 1, // multiplicador do volume do microfone (0.2 a 3)
  micSensibilidade: 8, // portao: abaixo desse nivel o microfone nao transmite (0 = sempre aberto)
  micEntradaId: '', // deviceId do microfone escolhido ('' = padrao do sistema)
  saidaId: '', // deviceId da saida de audio ('' = padrao do sistema)
};

// Todos indexados por chave composta "peerId|canal" (ver chaveDe): quem assiste
// minha tela E minha camera precisa de duas conexoes, uma por canal.
const outgoingPCs = new Map(); // chave -> RTCPeerConnection (uma por pessoa que assiste algo MEU)
const filasIceSaida = new Map(); // chave -> candidatos ICE recebidos antes da hora (lado de saida)
const incomingPCs = new Map(); // chave -> RTCPeerConnection (uma por transmissao que estou recebendo)
const filasIceEntrada = new Map(); // chave -> candidatos ICE recebidos antes da hora (lado de entrada)

// Voz: UMA conexao por par, bidirecional — diferente da tela, que tem uma de ida
// e outra de volta. Por isso aqui nao existe "papel": vozPCs.get(from) ja e unico.
const vozPCs = new Map(); // peerId -> RTCPeerConnection (voz)
const filasIceVoz = new Map();
const audiosVoz = new Map(); // peerId -> <audio> que toca a voz dessa pessoa
const analisadoresVoz = new Map(); // peerId -> medidor de nivel, pra saber quem esta falando
const niveisVoz = new Map(); // peerId -> 0..100 (sobrevive ao re-render da lista)
let previaVisivel = true; // so importa quando o foco atual sou eu mesmo
let qualidadeAtualPreset = 'media'; // 'alta' | 'media' | 'baixa' | null (null = personalizada)

const socket = io();

// ---------------------------------------------------------------------------
// Utilitarios
// ---------------------------------------------------------------------------

function gerarCodigoSala() {
  const palavra = PALAVRAS_SALA[Math.floor(Math.random() * PALAVRAS_SALA.length)];
  const numero = Math.floor(10 + Math.random() * 90);
  return `${palavra}${numero}`;
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// Uma pessoa pode transmitir tela E camera ao mesmo tempo, entao nada que
// descreve uma transmissao pode ser indexado so pelo socket.id. A chave e o par
// "id|canal" — e e ela que anda por streamsDisponiveis, focoAtual, PCs e filas.
function chaveDe(id, canal) {
  return `${id}|${canal}`;
}

function partesDaChave(chave) {
  const corte = String(chave).lastIndexOf('|');
  return { id: chave.slice(0, corte), canal: chave.slice(corte + 1) };
}

function idDaChave(chave) {
  return partesDaChave(chave).id;
}

function nomeDoParticipante(id) {
  if (id === socket.id) return estado.meuNome || 'Você';
  return estado.participantes.get(id) || 'Alguém';
}

function iniciaisDoNome(nome) {
  return (nome || '?').trim().slice(0, 1).toUpperCase();
}

let alertaTimeout;
function mostrarAlerta(texto, duracaoMs = 3600) {
  alertaEl.textContent = texto;
  alertaEl.classList.remove('oculto');
  clearTimeout(alertaTimeout);
  alertaTimeout = setTimeout(() => alertaEl.classList.add('oculto'), duracaoMs);
}

function criarConexao(canal = 'tela') {
  const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
  pc.oniceconnectionstatechange = () => {
    console.log(`[VIO] estado da conexão (${canal}):`, pc.iceConnectionState);
    if (pc.iceConnectionState === 'failed') {
      const alvo = canal === 'voz' ? 'o áudio de alguém da sala' : 'uma das transmissões';
      mostrarAlerta(`Não foi possível conectar com ${alvo} — geralmente é a rede de alguém na sala bloqueando a conexão direta. Tenta atualizar a página.`, 6500);
    }
  };
  return pc;
}

function notaParaSurface(surface, temAudio) {
  if (surface === 'monitor') {
    return temAudio
      ? 'Tela inteira: o áudio incluído é o som geral do sistema.'
      : 'Tela inteira, sem áudio do sistema — comum no Firefox, no Safari e em algumas versões do macOS/Linux. No Windows, com Chrome ou Edge, costuma funcionar.';
  }
  if (surface === 'window' || surface === 'application') {
    return temAudio
      ? 'Janela específica: quando há áudio, ele tende a ser o som geral do sistema — isolar o som de só essa janela não é algo que os navegadores permitem hoje.'
      : 'Janela específica, sem áudio — a maioria dos navegadores não oferece som ao compartilhar só uma janela. Se o conteúdo com som roda numa aba do navegador, compartilhe a aba: aí sim o áudio fica isolado.';
  }
  if (surface === 'browser') {
    return temAudio
      ? 'Aba do navegador: o áudio enviado é só dessa aba, isolado do resto do sistema.'
      : 'Aba do navegador, sem áudio — pode ter ficado desmarcado na hora de escolher, ou essa aba não tinha som tocando.';
  }
  return '';
}

// ---------------------------------------------------------------------------
// Folhas (bottom sheets no celular, painéis ancorados no desktop)
// ---------------------------------------------------------------------------

function abrirFolha(folha) {
  TODAS_FOLHAS.forEach((f) => f.classList.toggle('aberta', f === folha));
  cobertura.classList.add('visivel');
}

function fecharFolhas() {
  TODAS_FOLHAS.forEach((f) => f.classList.remove('aberta'));
  cobertura.classList.remove('visivel');
  clearInterval(intervalDuracaoSala);
  intervalDuracaoSala = null;
}

cobertura.addEventListener('click', fecharFolhas);
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') fecharFolhas();
});

btnInfoSala.addEventListener('click', () => {
  textoCodigoCompleto.textContent = estado.roomId;
  atualizarDuracaoSala();
  clearInterval(intervalDuracaoSala);
  intervalDuracaoSala = setInterval(atualizarDuracaoSala, 1000);
  abrirFolha(folhaInfoSala);
});
btnFecharInfoSala.addEventListener('click', fecharFolhas);

btnParticipantes.addEventListener('click', () => abrirFolha(painelParticipantes));
btnFecharParticipantes.addEventListener('click', fecharFolhas);

btnAjustes.addEventListener('click', () => abrirFolha(painelAvancado));
// ---- abas dos ajustes ----
// A folha tinha virado uma coluna longa demais: video e audio nao tem nada a
// ver um com o outro, e misturar os dois obrigava a rolar pra achar qualquer
// coisa. Duas abas, cada uma com um assunto.
function trocarAba(qual) {
  const video = qual === 'video';
  abaVideo.classList.toggle('ativa', video);
  abaAudio.classList.toggle('ativa', !video);
  abaVideo.setAttribute('aria-selected', String(video));
  abaAudio.setAttribute('aria-selected', String(!video));
  painelVideo.classList.toggle('oculto', !video);
  painelAudio.classList.toggle('oculto', video);
}

chkPrevias.addEventListener('change', () => {
  estado.previasAoVivo = chkPrevias.checked;
  sincronizarPrevias();
});

abaVideo.addEventListener('click', () => trocarAba('video'));
abaAudio.addEventListener('click', () => trocarAba('audio'));

btnFecharAvancado.addEventListener('click', fecharFolhas);

// ---------------------------------------------------------------------------
// Efeitos sonoros (sintetizados na hora, sem depender de nenhum arquivo)
// ---------------------------------------------------------------------------

let audioCtxUI = null;
function obterAudioCtxUI() {
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;
  if (!audioCtxUI) audioCtxUI = new AC();
  if (audioCtxUI.state === 'suspended') audioCtxUI.resume().catch(() => {});
  return audioCtxUI;
}

function tocarTom(ctx, freq, inicioRelativo, duracao, volumeMax) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'sine';
  osc.frequency.value = freq;
  const t0 = ctx.currentTime + inicioRelativo;
  gain.gain.setValueAtTime(0.0001, t0);
  gain.gain.linearRampToValueAtTime(volumeMax, t0 + 0.015);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + duracao);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(t0);
  osc.stop(t0 + duracao + 0.03);
}

function tocarSomAtivado() {
  const ctx = obterAudioCtxUI();
  if (!ctx) return;
  tocarTom(ctx, 523.25, 0, 0.14, 0.16);
  tocarTom(ctx, 783.99, 0.09, 0.2, 0.16);
}

function tocarSomDesativado() {
  const ctx = obterAudioCtxUI();
  if (!ctx) return;
  tocarTom(ctx, 659.25, 0, 0.14, 0.14);
  tocarTom(ctx, 392.0, 0.09, 0.22, 0.14);
}

// ---------------------------------------------------------------------------
// Tela de entrada
// ---------------------------------------------------------------------------

const params = new URLSearchParams(window.location.search);
const salaPreenchida = params.get('room');
inputSala.value = salaPreenchida ? salaPreenchida.toUpperCase() : gerarCodigoSala();

const nomeSalvo = localStorage.getItem('vio-nome');
if (nomeSalvo) inputNome.value = nomeSalvo;

btnGerarSala.addEventListener('click', () => {
  inputSala.value = gerarCodigoSala();
});

// ---- versão + changelog (acessível pela tela de entrada) ----

fetch('/api/version')
  .then((r) => r.json())
  .then((d) => { textoVersao.textContent = d.version; })
  .catch(() => { textoVersao.textContent = '?'; });

let changelogCarregado = false;

btnVersao.addEventListener('click', async () => {
  if (!changelogCarregado) {
    try {
      const resposta = await fetch('/changelog.json');
      const versoes = await resposta.json();
      const rotulosTipo = { adicionado: 'Novo', alterado: 'Alterado', corrigido: 'Corrigido', removido: 'Removido', seguranca: 'Segurança' };

      listaChangelog.innerHTML = '';
      versoes.forEach((v) => {
        const bloco = document.createElement('div');
        bloco.className = 'bloco-changelog';
        const titulo = document.createElement('h3');
        titulo.textContent = v.data ? `v${v.versao} · ${v.data}` : `v${v.versao}`;
        const lista = document.createElement('ul');
        v.mudancas.forEach((m) => {
          const item = document.createElement('li');
          const etiqueta = document.createElement('span');
          etiqueta.className = `etiqueta-tipo etiqueta-${m.tipo}`;
          etiqueta.textContent = rotulosTipo[m.tipo] || m.tipo;
          const texto = document.createElement('span');
          texto.textContent = m.texto;
          item.appendChild(etiqueta);
          item.appendChild(texto);
          lista.appendChild(item);
        });
        bloco.appendChild(titulo);
        bloco.appendChild(lista);
        listaChangelog.appendChild(bloco);
      });
      changelogCarregado = true;
    } catch {
      listaChangelog.innerHTML = '<p class="nota-avancado">Não foi possível carregar o histórico agora.</p>';
    }
  }
  abrirFolha(folhaChangelog);
});
btnFecharChangelog.addEventListener('click', fecharFolhas);

// ---- feedback de limite de taxa (ex: muitas salas criadas rapido demais) ----

socket.on('room-error', ({ motivo }) => {
  // Se isto chegou no meio de uma reconexao, nao e o usuario martelando a
  // porta: e o servidor tendo acabado de reiniciar com todo mundo voltando ao
  // mesmo tempo. Espera e tenta de novo em vez de largar a pessoa fora da sala.
  if (reconectando) {
    agendarNovaTentativa();
    return;
  }

  if (motivo === 'limite-criacao') {
    mostrarAlerta('Muitas salas novas em pouco tempo — espera um pouco e tenta de novo.', 5000);
  } else if (motivo === 'limite-entrada') {
    mostrarAlerta('Muitas tentativas de entrar em pouco tempo — espera um pouco e tenta de novo.', 5000);
  }
});

formEntrar.addEventListener('submit', (e) => {
  e.preventDefault();
  const nome = inputNome.value.trim();
  const sala = inputSala.value.trim().toUpperCase();
  if (!nome || !sala) return;

  obterAudioCtxUI(); // desbloqueia o audio dos efeitos sonoros a partir deste gesto

  localStorage.setItem('vio-nome', nome);

  estado.meuNome = nome;
  estado.roomId = sala;
  estado.naSala = true;
  socket.emit('join-room', { roomId: sala, name: nome });

  telaEntrada.classList.add('oculto');
  telaSala.classList.remove('oculto');
  textoCodigoSala.textContent = sala;

  if (!suportaCompartilhamento) {
    btnCompartilhar.disabled = true;
    btnCompartilhar.textContent = 'Indisponível aqui';
    btnCompartilhar.title = 'Este navegador/dispositivo não permite compartilhar tela (comum em celulares). Você ainda pode assistir normalmente.';
  }

  iniciarMedicaoPing();
  listarDispositivos();
});

btnCopiarLink.addEventListener('click', async () => {
  const url = new URL(window.location.href);
  url.search = '';
  url.searchParams.set('room', estado.roomId);
  const link = url.toString();
  try {
    await navigator.clipboard.writeText(link);
    mostrarAlerta('Link copiado! Manda pros seus amigos.');
  } catch {
    mostrarAlerta('Não deu pra copiar sozinho. Link: ' + link, 6000);
  }
});

btnSairSala.addEventListener('click', () => {
  // antes de qualquer coisa: a partir daqui o disconnect abaixo e voluntario,
  // e nao deve disparar a reconexao automatica
  estado.naSala = false;
  reconectando = false;
  clearTimeout(timerReentrada);

  if (estado.sharingIds.has(socket.id)) pararCompartilhamento();
  if (estado.cameraStream) desligarCamera();
  if (estado.voiceIds.has(socket.id)) socket.emit('stop-voice');
  largarVoz();
  incomingPCs.forEach((pc) => pc.close());
  incomingPCs.clear();
  filasIceEntrada.clear();
  pararMedicaoPing();
  pararContadorSala();
  fecharFolhas();

  socket.disconnect();
  estado.participantes.clear();
  estado.sharingIds.clear();
  estado.cameraIds.clear();
  estado.streamsDisponiveis.clear();
  estado.focoAtual = null;

  telaSala.classList.add('oculto');
  telaEntrada.classList.remove('oculto');
  resetarMoldura();

  socket.connect(); // fica pronto pra poder entrar em outra sala
});

// ---------------------------------------------------------------------------
// Duracao da sala (contador desde a criacao, compartilhado por todos —
// so fica "vivo" enquanto a folha de info esta aberta, ver abrirFolha)
// ---------------------------------------------------------------------------

let intervalDuracaoSala = null;

function formatarDuracao(ms) {
  const totalSegundos = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(totalSegundos / 3600);
  const m = Math.floor((totalSegundos % 3600) / 60);
  const s = totalSegundos % 60;
  const mm = String(m).padStart(2, '0');
  const ss = String(s).padStart(2, '0');
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

function atualizarDuracaoSala() {
  if (!estado.salaCriadaEm) return;
  textoDuracaoSala.textContent = formatarDuracao(Date.now() - estado.salaCriadaEm);
}

function pararContadorSala() {
  clearInterval(intervalDuracaoSala);
  intervalDuracaoSala = null;
  estado.salaCriadaEm = null;
}

// ---------------------------------------------------------------------------
// Participantes / estado da sala
// ---------------------------------------------------------------------------

function renderizarParticipantes() {
  listaParticipantes.innerHTML = '';

  const criarItem = (id, nome, souEu) => {
    const item = document.createElement('li');
    item.dataset.id = id; // o loop de nivel de voz acha o avatar por aqui

    // O avatar fica FORA do bloco que corta o texto: o anel de "falando" cresce
    // alem da borda dele, e dentro de um overflow:hidden ele sairia recortado.
    const avatar = document.createElement('span');
    avatar.className = 'avatar-participante';
    avatar.setAttribute('aria-hidden', 'true');
    avatar.textContent = iniciaisDoNome(nome);
    if ((niveisVoz.get(id) || 0) > LIMIAR_FALANDO) avatar.classList.add('falando');

    const identidade = document.createElement('span');
    identidade.className = 'identidade-participante';

    const texto = document.createElement('span');
    texto.className = 'texto-participante';
    texto.textContent = nome;
    identidade.appendChild(texto);

    if (souEu) {
      const etiqueta = document.createElement('span');
      etiqueta.className = 'etiqueta-voce';
      etiqueta.textContent = '(você)';
      identidade.appendChild(etiqueta);
    }

    // Microfone e camera usam o mesmo desenho do rodape: icone base mais a
    // classe .cortado pra dizer "desligado". Um risco so, sempre igual.
    if (estado.voiceIds.has(id)) {
      // De quem nao sou eu so da pra saber que esta na voz — mudo remoto nao e
      // sinalizado. Quem esta falando aparece pelo anel no avatar.
      const mudo = souEu && estado.vozMudo;
      const mic = document.createElement('span');
      mic.className = `icone icone-microphone${mudo ? ' cortado' : ''}`;
      mic.setAttribute('aria-label', mudo ? 'microfone desligado' : 'na conversa');
      identidade.appendChild(mic);
    }

    if (estado.cameraIds.has(id)) {
      const cam = document.createElement('span');
      cam.className = 'icone icone-video-camera-alt';
      cam.setAttribute('aria-label', 'com a câmera ligada');
      identidade.appendChild(cam);
    }

    item.appendChild(avatar);
    item.appendChild(identidade);

    if (estado.sharingIds.has(id)) {
      const badge = document.createElement('span');
      badge.className = 'etiqueta-compartilhando';
      badge.textContent = 'compartilhando';
      item.appendChild(badge);
    }

    // Silenciar alguem e ajustar o volume dela sao decisao SO SUA: nao vao pro
    // servidor, a pessoa nao fica sabendo, e somem quando voce sai da sala.
    if (!souEu && estado.voiceIds.has(id)) {
      const calado = estado.mudosLocais.has(id);

      const controles = document.createElement('span');
      controles.className = 'controles-participante';

      const faixa = document.createElement('input');
      faixa.type = 'range';
      faixa.min = '0';
      faixa.max = '100';
      faixa.value = String(volumeDe(id));
      faixa.className = 'range-volume-pessoa';
      faixa.disabled = calado;
      faixa.setAttribute('aria-label', `Volume de ${nome}`);
      faixa.title = `Volume de ${nome}: ${volumeDe(id)}%`;
      faixa.addEventListener('input', () => {
        definirVolumeDe(id, faixa.value);
        faixa.title = `Volume de ${nome}: ${faixa.value}%`;
      });

      const botao = document.createElement('button');
      botao.type = 'button';
      botao.className = `btn-silenciar${calado ? ' cortado' : ''}`;
      botao.innerHTML = '<span class="icone icone-volume" aria-hidden="true"></span>';
      botao.setAttribute('aria-pressed', String(calado));
      botao.setAttribute('aria-label', calado ? `Voltar a ouvir ${nome}` : `Silenciar ${nome} só pra você`);
      botao.title = botao.getAttribute('aria-label');
      botao.addEventListener('click', () => alternarMudoDe(id));

      controles.appendChild(faixa);
      controles.appendChild(botao);
      item.appendChild(controles);
    }
    return item;
  };

  listaParticipantes.appendChild(criarItem(socket.id, estado.meuNome, true));
  estado.participantes.forEach((nome, id) => listaParticipantes.appendChild(criarItem(id, nome, false)));

  contadorParticipantes.textContent = estado.participantes.size + 1;
}

function atualizarBotaoCompartilhar() {
  if (!suportaCompartilhamento) return;

  // O rotulo vive num span proprio porque some em tela estreita (ver style.css):
  // num celular o rodape nao comporta o texto junto dos botoes de icone. Dai o
  // aria-label ficar sempre preenchido — quem usa leitor de tela nao perde nada.
  const parando = estado.sharingIds.has(socket.id);
  const texto = parando ? 'Parar compartilhamento' : 'Compartilhar tela';
  btnCompartilhar.innerHTML = `<span class="icone icone-computer" aria-hidden="true"></span><span class="rotulo-botao">${texto}</span>`;
  btnCompartilhar.setAttribute('aria-label', texto);
  btnCompartilhar.title = texto;
  btnCompartilhar.classList.toggle('compartilhando', parando);
  btnCompartilhar.disabled = false; // varias pessoas podem compartilhar ao mesmo tempo, entao nunca trava por causa de outra
}

socket.on('room-state', ({ participants, sharingIds, voiceIds, cameraIds, criadaEm }) => {
  estado.participantes.clear();
  participants.forEach((p) => {
    if (p.id !== socket.id) estado.participantes.set(p.id, p.name);
  });
  estado.sharingIds = new Set(sharingIds);
  estado.voiceIds = new Set(voiceIds || []);
  estado.cameraIds = new Set(cameraIds || []);
  estado.salaCriadaEm = criadaEm;
  renderizarParticipantes();
  atualizarBotaoCompartilhar();
  atualizarBotaoMicrofone();
  atualizarBotaoCamera();

  const acabeiDeVoltar = reconectando;
  if (acabeiDeVoltar) {
    reconectando = false;
    tentativaReentrada = 0;
    clearTimeout(timerReentrada);
    iniciarMedicaoPing();
    mostrarAlerta('Reconectado.');
    // Se a tela ainda esta capturada, volto a anunciar que estou compartilhando:
    // o stream nunca parou, so as conexoes precisam renascer.
    if (estado.localStream) socket.emit('start-share');
    // Mesma logica pro microfone: ele sobrevive a queda, so as conexoes morrem.
    // O medidor precisa ser religado porque era indexado pelo socket.id antigo.
    if (estado.vozStream) {
      reancorarAnalisadorLocal();
      socket.emit('start-voice');
    }
    // E a camera, pelo mesmo motivo: derrubar o stream faria o navegador pedir
    // permissao de novo, entao ele sobrevive e so as conexoes renascem.
    if (estado.cameraStream) socket.emit('start-camera');
  }

  sincronizarConexoesVoz();
  if (estado.previasAoVivo) sincronizarPrevias();

  const ativas = transmissoesDaSala();
  if (ativas.length > 0) focarEm(ativas[0]); // ja tem gente no ar - foca na primeira automaticamente
  else if (acabeiDeVoltar && !estado.localStream && !estado.cameraStream) resetarMoldura(); // tira o aviso de "Reconectando..."
});

socket.on('participant-joined', ({ id, name }) => {
  estado.participantes.set(id, name);
  renderizarParticipantes();
  mostrarAlerta(`${name} entrou na sala.`);
  // nao conecta automaticamente — a conexao so acontece quando ESSA pessoa
  // pedir pra assistir (ver 'watch-request' mais abaixo)
});

socket.on('participant-left', ({ id }) => {
  const nome = estado.participantes.get(id);
  estado.participantes.delete(id);
  estado.voiceIds.delete(id);
  renderizarParticipantes();
  if (nome) mostrarAlerta(`${nome} saiu da sala.`);

  // quem sai leva embora TODAS as conexoes de saida que eu mantinha pra ela —
  // a da tela e a da camera. O share-stopped/camera-stopped do servidor cuida
  // do outro lado (o que EU estava assistindo dela).
  outgoingPCs.forEach((pc, chave) => {
    if (idDaChave(chave) !== id) return;
    pc.close();
    outgoingPCs.delete(chave);
    filasIceSaida.delete(chave);
  });
  encerrarConexaoVoz(id);
});

// ---------------------------------------------------------------------------
// Reconexao
//
// O Socket.IO reconecta o transporte sozinho, mas isso nao basta: o servidor
// guarda as salas em memoria, entao depois de um restart a sala nao existe
// mais e ninguem sabe que eu estava nela. Alem disso o meu socket.id MUDA na
// reconexao — e todos os mapas daqui (participantes, sharingIds, PCs, filas de
// ICE) sao indexados por socket id. Nada do estado antigo sobrevive.
//
// O que sobrevive de proposito e o localStream: derrubar as tracks faria o
// navegador pedir a tela de novo, e uma sessao de duas horas viraria duas horas
// perdidas por um soluco de rede. So as PeerConnections morrem e sao refeitas.
// ---------------------------------------------------------------------------

const MAX_TENTATIVAS_REENTRADA = 5;

let reconectando = false; // entre o disconnect e o room-state de volta
let tentativaReentrada = 0;
let timerReentrada = null;

function descartarConexoes() {
  outgoingPCs.forEach((pc) => pc.close());
  outgoingPCs.clear();
  filasIceSaida.clear();
  incomingPCs.forEach((pc) => pc.close());
  incomingPCs.clear();
  filasIceEntrada.clear();
  // A voz cai junto: os peerIds sao socket ids, e todos mudaram. O microfone
  // em si (estado.vozStream) sobrevive, como o localStream da tela.
  [...vozPCs.keys()].forEach(encerrarConexaoVoz);
  pararLoopNivel();
  analisadoresVoz.clear(); // inclusive o meu: meu socket.id tambem mudou
}

function reentrarNaSala() {
  descartarConexoes();
  estado.participantes.clear();
  estado.sharingIds.clear();
  estado.voiceIds.clear();
  estado.cameraIds.clear();
  estado.streamsDisponiveis.clear();
  estado.focoAtual = null;

  socket.emit('join-room', { roomId: estado.roomId, name: estado.meuNome });
}

// O limite de taxa do servidor nao sabe distinguir reconexao de alguem
// martelando a porta. Quando o servidor reinicia, todo mundo volta quase junto
// e pode esbarrar no limite — entao aqui a resposta e esperar e tentar de novo,
// com jitter pra nao voltarem todos no mesmo instante.
function agendarNovaTentativa() {
  tentativaReentrada += 1;
  if (tentativaReentrada > MAX_TENTATIVAS_REENTRADA) {
    reconectando = false;
    mostrarPlaceholder('Não consegui voltar para a sala. Atualize a página para tentar de novo.');
    return;
  }

  const espera = 2000 * 2 ** (tentativaReentrada - 1) + Math.random() * 1000;
  mostrarPlaceholder(`Servidor ocupado. Tentando de novo em ${Math.round(espera / 1000)}s…`);
  clearTimeout(timerReentrada);
  timerReentrada = setTimeout(reentrarNaSala, espera);
}

socket.on('disconnect', () => {
  if (!estado.naSala) return; // saida voluntaria, ou nem entrei ainda

  reconectando = true;
  tentativaReentrada = 0;
  pararMedicaoPing();
  descartarConexoes();
  videoRemoto.srcObject = null;

  pontoPing.classList.remove('ping-bom', 'ping-medio');
  pontoPing.classList.add('ping-ruim');
  mostrarPlaceholder('Conexão perdida. Reconectando…');
});

socket.on('connect', () => {
  if (!reconectando) return; // primeira conexao: o formulario de entrada ja cuida do join-room
  tentativaReentrada = 0;
  reentrarNaSala();
});

// ---------------------------------------------------------------------------
// Palco / video — foco em quem estou vendo (posso ser eu mesmo ou qualquer
// outra pessoa ativa), com uma tira de miniaturas quando ha mais de uma
// ---------------------------------------------------------------------------

function mostrarPlaceholder(texto) {
  overlayPlaceholder.classList.remove('oculto');
  textoPlaceholderEl.textContent = texto;
  dicaPlaceholderEl.textContent = '';
}

function resetarMoldura() {
  videoRemoto.pause();
  videoRemoto.srcObject = null;
  molduraVideo.classList.remove('ao-vivo', 'controles-ocultos');
  barraTopo.classList.add('oculto');
  seloAoVivo.classList.add('oculto');
  tiraTransmissoes.classList.add('oculto');
  tiraTransmissoes.innerHTML = '';
  barraVideo.classList.add('oculto');
  controleVolume.classList.add('oculto');
  btnAlternarPrevia.classList.add('oculto');
  btnVirarCamera.classList.add('oculto');
  btnDesbloquearAudio.classList.add('oculto');
  overlayPlaceholder.classList.remove('oculto');
  textoPlaceholderEl.textContent = 'Ninguém está compartilhando a tela ainda.';
  dicaPlaceholderEl.textContent = 'Toque em "Compartilhar tela" quando quiser começar.';

  if (document.fullscreenElement || document.webkitFullscreenElement) {
    (document.exitFullscreen || document.webkitExitFullscreen)?.call(document);
  }
}

// pede pra assistir a transmissao de alguem (a pessoa so vai me conectar
// depois de receber isso — nada de conexao proativa "pra sala inteira")
function solicitarTransmissao(chave) {
  const { id, canal } = partesDaChave(chave);
  socket.emit('signal', { to: id, payload: { tipo: 'watch-request', canal } });
}

// avisa que parei de assistir, e libera a conexao correspondente
function pararDeAssistir(chave) {
  const { id, canal } = partesDaChave(chave);
  socket.emit('signal', { to: id, payload: { tipo: 'watch-stop', canal } });
  if (incomingPCs.has(chave)) {
    incomingPCs.get(chave).close();
    incomingPCs.delete(chave);
    filasIceEntrada.delete(chave);
  }
  estado.streamsDisponiveis.delete(chave);
}

// Todas as transmissoes que existem na sala agora, tela e camera juntas, na
// ordem em que aparecem na tira.
function transmissoesDaSala() {
  return [
    ...[...estado.sharingIds].map((id) => chaveDe(id, 'tela')),
    ...[...estado.cameraIds].map((id) => chaveDe(id, 'camera')),
  ];
}

function souAOrigem(chave) {
  return idDaChave(chave) === socket.id;
}

// escolhida pelo usuario (clique numa miniatura, ou foco automatico) — pode
// precisar pedir a transmissao antes de ter algo pra mostrar
function focarEm(chave) {
  if (chave === estado.focoAtual) return;

  // Com as previas ao vivo ligadas eu ja estou recebendo todo mundo, entao
  // trocar de foco nao solta nada. Desligadas, solto o anterior na hora: e o
  // que mantem uma conexao por vez em vez de N.
  if (estado.focoAtual && !souAOrigem(estado.focoAtual) && !estado.previasAoVivo) {
    pararDeAssistir(estado.focoAtual);
  }

  estado.focoAtual = chave;

  if (souAOrigem(chave) || estado.streamsDisponiveis.has(chave)) {
    exibirFoco();
  } else {
    solicitarTransmissao(chave);
    mostrarPlaceholder('Conectando à transmissão...');
    renderizarTiraTransmissoes();
    registrarAtividadeVideo();
  }
}

// mostra na moldura o que ja esta em estado.focoAtual — chamada direto pelo
// focarEm quando o stream ja existe, ou depois que uma oferta chega (ontrack)
function exibirFoco() {
  const chave = estado.focoAtual;
  const stream = estado.streamsDisponiveis.get(chave);
  if (!stream) return;

  const souEu = souAOrigem(chave);

  overlayPlaceholder.classList.add('oculto');
  molduraVideo.classList.add('ao-vivo');
  barraTopo.classList.remove('oculto');
  seloAoVivo.classList.remove('oculto');
  barraVideo.classList.remove('oculto');

  if (souEu) {
    controleVolume.classList.add('oculto'); // previa e sempre muda (evita eco do seu proprio audio)
    btnAlternarPrevia.classList.remove('oculto');
    previaVisivel = true;
    aplicarVisibilidadePrevia();
  } else {
    btnAlternarPrevia.classList.add('oculto');
    controleVolume.classList.remove('oculto');
    videoRemoto.muted = false;
    if (suportaVolumeAjustavel) videoRemoto.volume = Number(rangeVolume.value) / 100;
    atualizarIconeVolume();
    videoRemoto.srcObject = stream;
    const p = videoRemoto.play();
    if (p && p.catch) p.catch(() => btnDesbloquearAudio.classList.remove('oculto'));
  }

  aplicarEspelhoDaCamera();
  renderizarTiraTransmissoes();
  registrarAtividadeVideo();
}

// tira de miniaturas: uma opcao por TRANSMISSAO (nao por pessoa — quem estiver
// com tela e camera no ar aparece duas vezes). Quem nao esta em foco mostra so
// as iniciais; video ao vivo aparece quando voce clica pra ver de fato.
function renderizarTiraTransmissoes() {
  const chaves = transmissoesDaSala();
  if (chaves.length <= 1) {
    tiraTransmissoes.classList.add('oculto');
    tiraTransmissoes.innerHTML = '';
    return;
  }
  tiraTransmissoes.classList.remove('oculto');

  const existentes = new Map([...tiraTransmissoes.children].map((el) => [el.dataset.chave, el]));
  const atuais = new Set();

  chaves.forEach((chave) => {
    atuais.add(chave);
    const { id, canal } = partesDaChave(chave);
    const nome = nomeDoParticipante(id);
    const rotuloCanal = canal === 'camera' ? `${nome} · câmera` : nome;

    let cartao = existentes.get(chave);
    if (!cartao) {
      cartao = document.createElement('button');
      cartao.type = 'button';
      cartao.className = 'cartao-transmissao';
      cartao.dataset.chave = chave;

      const video = document.createElement('video');
      video.muted = true;
      video.autoplay = true;
      video.playsInline = true;

      const inicial = document.createElement('span');
      inicial.className = 'cartao-inicial';

      const rotulo = document.createElement('span');
      rotulo.className = 'rotulo-cartao';

      cartao.appendChild(video);
      cartao.appendChild(inicial);
      cartao.appendChild(rotulo);
      cartao.addEventListener('click', () => focarEm(chave));
      tiraTransmissoes.appendChild(cartao);
    }

    const video = cartao.querySelector('video');
    const stream = estado.streamsDisponiveis.get(chave);
    if (stream) {
      if (video.srcObject !== stream) video.srcObject = stream;
      video.play?.().catch(() => {});
      cartao.classList.remove('sem-previa');
    } else {
      video.srcObject = null;
      cartao.classList.add('sem-previa');
    }

    cartao.querySelector('.cartao-inicial').textContent = iniciaisDoNome(nome);
    cartao.querySelector('.rotulo-cartao').textContent = rotuloCanal;
    cartao.classList.toggle('ativo', chave === estado.focoAtual);
    cartao.setAttribute('aria-label', `Ver ${rotuloCanal}`);
  });

  existentes.forEach((cartao, chave) => {
    if (!atuais.has(chave)) cartao.remove();
  });
}

// ---- previa de quem esta compartilhando (com opcao de ocultar) ----

function aplicarVisibilidadePrevia() {
  iconePrevia.classList.toggle('icone-eye', previaVisivel);
  iconePrevia.classList.toggle('icone-eye-crossed', !previaVisivel);
  btnAlternarPrevia.title = previaVisivel ? 'Ocultar sua prévia' : 'Mostrar sua prévia';

  if (!estado.focoAtual || !souAOrigem(estado.focoAtual)) return;
  const streamPropria = estado.streamsDisponiveis.get(estado.focoAtual);
  if (!streamPropria) return;

  if (previaVisivel) {
    overlayPlaceholder.classList.add('oculto');
    videoRemoto.muted = true;
    videoRemoto.srcObject = streamPropria;
    videoRemoto.play().catch(() => {});
  } else {
    videoRemoto.srcObject = null;
    overlayPlaceholder.classList.remove('oculto');
    textoPlaceholderEl.textContent = 'Prévia oculta — você continua transmitindo normalmente.';
    dicaPlaceholderEl.textContent = 'Toque no ícone de olho pra mostrar de novo.';
  }
}

btnAlternarPrevia.addEventListener('click', () => {
  previaVisivel = !previaVisivel;
  aplicarVisibilidadePrevia();
  aplicarEspelhoDaCamera();
});

// ---- volume (so existe sentido quando o foco NAO sou eu mesmo) ----

const suportaVolumeAjustavel = (() => {
  try {
    const original = videoRemoto.volume;
    videoRemoto.volume = 0.5;
    const funcionou = Math.abs(videoRemoto.volume - 0.5) < 0.01;
    videoRemoto.volume = original;
    return funcionou;
  } catch {
    return false;
  }
})(); // no iPhone/iPad (iOS), o volume so pode ser mudado nos botoes fisicos do aparelho

if (!suportaVolumeAjustavel) rangeVolume.classList.add('oculto');

function atualizarIconeVolume() {
  const mudo = videoRemoto.muted || videoRemoto.volume === 0;
  const baixo = !mudo && videoRemoto.volume < 0.5;
  iconeVolume.classList.toggle('icone-volume-slash', mudo);
  iconeVolume.classList.toggle('icone-volume-down', baixo);
  iconeVolume.classList.toggle('icone-volume', !mudo && !baixo);
}

btnDesbloquearAudio.addEventListener('click', () => {
  // Destrava os dois: o video da tela e as vozes da conversa. Sao elementos
  // diferentes, e o navegador pode ter segurado qualquer um deles.
  videoRemoto.play().catch(() => {});
  audiosVoz.forEach((el) => el.play().catch(() => {}));
  btnDesbloquearAudio.classList.add('oculto');
});

btnMutarLocal.addEventListener('click', () => {
  videoRemoto.muted = !videoRemoto.muted;
  if (!videoRemoto.muted && suportaVolumeAjustavel && videoRemoto.volume === 0) {
    videoRemoto.volume = 1;
    rangeVolume.value = 100;
  }
  atualizarIconeVolume();
});

rangeVolume.addEventListener('input', () => {
  if (!suportaVolumeAjustavel) return;
  const v = Number(rangeVolume.value) / 100;
  videoRemoto.volume = v;
  videoRemoto.muted = v === 0;
  atualizarIconeVolume();
});

// ---- tela cheia (container com controles no desktop/Android/iPad; video nativo no iPhone) ----

btnTelaCheia.addEventListener('click', alternarTelaCheia);

function alternarTelaCheia() {
  if (document.fullscreenElement || document.webkitFullscreenElement) {
    (document.exitFullscreen || document.webkitExitFullscreen)?.call(document);
    return;
  }

  const padraoSuportado = document.fullscreenEnabled || document.webkitFullscreenEnabled;
  const alvo = molduraVideo.requestFullscreen ? molduraVideo : (molduraVideo.webkitRequestFullscreen ? molduraVideo : null);

  if (padraoSuportado && alvo) {
    const pedido = alvo.requestFullscreen ? alvo.requestFullscreen() : alvo.webkitRequestFullscreen();
    if (pedido && pedido.catch) pedido.catch(() => usarTelaCheiaNativaDoVideo());
    return;
  }
  usarTelaCheiaNativaDoVideo();
}

function usarTelaCheiaNativaDoVideo() {
  // iPhone: a unica tela cheia possivel e a do proprio <video>, controlada pelo iOS
  // (por isso os controles personalizados desta barra nao aparecem nesse caso).
  if (videoRemoto.webkitEnterFullscreen) {
    videoRemoto.webkitEnterFullscreen();
  } else {
    mostrarAlerta('Seu navegador não suporta tela cheia.');
  }
}

// ---- controles somem sozinhos com a inatividade (em tela cheia ou nao) ----

let timeoutInatividadeVideo = null;

function registrarAtividadeVideo() {
  molduraVideo.classList.remove('controles-ocultos');
  clearTimeout(timeoutInatividadeVideo);
  timeoutInatividadeVideo = setTimeout(() => {
    if (molduraVideo.classList.contains('ao-vivo')) {
      molduraVideo.classList.add('controles-ocultos');
    }
  }, DURACAO_INATIVIDADE_MS);
}

molduraVideo.addEventListener('mousemove', registrarAtividadeVideo);
molduraVideo.addEventListener('mousedown', registrarAtividadeVideo);
molduraVideo.addEventListener('touchstart', registrarAtividadeVideo, { passive: true });
molduraVideo.addEventListener('touchmove', registrarAtividadeVideo, { passive: true });

// ---------------------------------------------------------------------------
// Compartilhar tela (lado de quem transmite) — varias pessoas podem estar
// nesse estado ao mesmo tempo, cada uma com seu proprio localStream
// ---------------------------------------------------------------------------

btnCompartilhar.addEventListener('click', () => {
  if (estado.sharingIds.has(socket.id)) {
    pararCompartilhamento();
  } else {
    iniciarCompartilhamento();
  }
});

async function iniciarCompartilhamento() {
  // localStream tambem barra: durante uma reconexao o sharingIds esta vazio,
  // mas a tela continua capturada — sem esta guarda o navegador pediria a tela
  // de novo por cima de um compartilhamento que nunca parou.
  if (estado.sharingIds.has(socket.id) || estado.streamPendente || estado.localStream) return;

  const qualidade = lerValoresQualidadeAtual();
  let stream;
  try {
    stream = await navigator.mediaDevices.getDisplayMedia({
      video: {
        frameRate: { ideal: qualidade.fps, max: qualidade.fps },
        width: { ideal: 1920 },
        height: { ideal: 1080 },
      },
      // echoCancellation/noiseSuppression/autoGainControl DESLIGADOS de proposito:
      // sao processamentos pensados pra voz de microfone (e podem causar aquele
      // efeito de volume "respirando", mais alto e mais baixo). Pra audio de tela
      // isso so atrapalha — aqui a ideia e mandar o som exatamente como ele e.
      audio: {
        echoCancellation: false,
        noiseSuppression: false,
        autoGainControl: false,
      },
    });
  } catch (erro) {
    if (erro.name !== 'NotAllowedError') {
      mostrarAlerta('Não foi possível iniciar o compartilhamento: ' + erro.message);
    }
    return; // usuario cancelou o seletor do navegador, ou deu erro — nao faz nada
  }

  estado.streamPendente = stream;
  socket.emit('start-share');
}

function confirmarInicioCompartilhamento() {
  const stream = estado.streamPendente;
  estado.streamPendente = null;
  estado.localStream = stream;
  estado.streamsDisponiveis.set(chaveDe(socket.id, 'tela'), stream);

  const trackVideo = stream.getVideoTracks()[0];
  const trackAudio = stream.getAudioTracks()[0];
  if (trackAudio && !chkAudio.checked) trackAudio.enabled = false;

  const surface = trackVideo.getSettings().displaySurface;
  notaSurface.textContent = notaParaSurface(surface, !!trackAudio);
  rotuloChkAudio.classList.toggle('oculto', !trackAudio);

  trackVideo.addEventListener('ended', pararCompartilhamento);

  focarEm(chaveDe(socket.id, 'tela'));
  mostrarAlerta('Compartilhamento iniciado! Espelho infinito na tela? Você escolheu esta própria aba/janela — troque, ou toque no olho pra ocultar sua prévia.', 6500);

  aplicarQualidadeATodasConexoes(lerValoresQualidadeAtual());
}

// Fecha as conexoes de SAIDA de um canal so. As de outro canal continuam —
// parar a tela nao pode derrubar a camera de quem esta transmitindo as duas.
function fecharSaidasDoCanal(canal) {
  outgoingPCs.forEach((pc, chave) => {
    if (partesDaChave(chave).canal !== canal) return;
    pc.close();
    outgoingPCs.delete(chave);
    filasIceSaida.delete(chave);
  });
}

// Previas ao vivo: o VIO conecta sob demanda de proposito — so com a transmissao
// que voce esta olhando. Ligar isto troca esse contrato por "conecta com todas",
// que e o unico jeito de ter imagem de verdade nas miniaturas. Custa banda de
// quem transmite (uma conexao a mais por espectador, por transmissao), e por
// isso nasce desligado e a folha de Ajustes diz o preco.
function sincronizarPrevias() {
  if (estado.previasAoVivo) {
    transmissoesDaSala().forEach((chave) => {
      if (souAOrigem(chave)) return;
      if (estado.streamsDisponiveis.has(chave) || incomingPCs.has(chave)) return;
      solicitarTransmissao(chave);
    });
  } else {
    [...incomingPCs.keys()].forEach((chave) => {
      if (chave === estado.focoAtual) return; // o que estou vendo fica
      pararDeAssistir(chave);
    });
  }
  renderizarTiraTransmissoes();
}

// Uma transmissao acabou de entrar no ar. Se eu nao estou vendo nada, passo a
// ver essa — senao a pessoa fica encarando o aviso de "ninguem compartilhando"
// sem nada pra clicar (a tira so aparece com duas ou mais transmissoes).
// Se eu ja estava vendo alguma coisa, nao roubo o foco: so atualizo a tira.
function ofereserTransmissaoNova(chave) {
  if (estado.focoAtual) {
    if (estado.previasAoVivo) sincronizarPrevias();
    else renderizarTiraTransmissoes();
    return;
  }
  focarEm(chave);
  if (estado.previasAoVivo) sincronizarPrevias();
}

// Depois que uma transmissao some, escolhe a proxima pra mostrar — ou limpa a
// moldura se nao sobrou nenhuma.
function seguirParaProximaTransmissao(chaveQueSaiu) {
  if (estado.focoAtual !== chaveQueSaiu) {
    renderizarTiraTransmissoes();
    return;
  }
  estado.focoAtual = null;
  const restantes = transmissoesDaSala().filter((c) => c !== chaveQueSaiu);
  if (restantes.length > 0) focarEm(restantes[0]);
  else resetarMoldura();
}

function pararCompartilhamento() {
  if (estado.streamPendente) {
    estado.streamPendente.getTracks().forEach((t) => t.stop());
    estado.streamPendente = null;
    return;
  }
  if (!estado.sharingIds.has(socket.id)) return;

  if (estado.localStream) {
    estado.localStream.getTracks().forEach((t) => t.stop());
    estado.localStream = null;
  }
  fecharSaidasDoCanal('tela');

  const minhaChave = chaveDe(socket.id, 'tela');
  estado.streamsDisponiveis.delete(minhaChave);
  estado.sharingIds.delete(socket.id);
  seguirParaProximaTransmissao(minhaChave);
  estado.sharingIds.add(socket.id); // o eco do servidor e quem remove de verdade

  socket.emit('stop-share');
  // atencao: NAO mexemos em estado.sharingIds de forma definitiva aqui — isso e
  // feito quando o eco 'share-stopped' voltar do servidor, o mesmo caminho usado
  // quando OUTRA pessoa para de compartilhar. Assim o som de "desativado" toca
  // igual pra todo mundo, incluindo quem acabou de parar.
}

// ---------------------------------------------------------------------------
// Camera
//
// Mesmo desenho da voz (canal proprio, conexoes separadas, lista propria no
// servidor), mas o comportamento e o da TELA: sob demanda. Video custa caro
// demais pra sair pra sala inteira sem ninguem estar olhando — so quem focar na
// camera de alguem e que abre conexao com ela.
//
// Nada aqui encosta no grafo de audio: a camera pega SO video. O microfone
// continua sendo do canal de voz, com seus proprios ajustes.
// ---------------------------------------------------------------------------

const suportaCamera = !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);

let podeVirarCamera = false; // so vira se o aparelho tiver mais de uma camera

function atualizarBotaoCamera() {
  if (!btnCamera) return;

  const ligada = estado.cameraIds.has(socket.id);
  iconeCamera.classList.toggle('icone-video-camera-alt', ligada);
  iconeCamera.classList.toggle('icone-video-slash', !ligada);
  btnCamera.classList.toggle('ativo', ligada);
  btnCamera.setAttribute('aria-pressed', String(ligada));
  btnCamera.setAttribute('aria-label', ligada ? 'Desligar a câmera' : 'Ligar a câmera');
  btnCamera.title = btnCamera.getAttribute('aria-label');
  btnCamera.disabled = !suportaCamera;
}

async function conferirSePodeVirar() {
  try {
    const dispositivos = await navigator.mediaDevices.enumerateDevices();
    podeVirarCamera = dispositivos.filter((d) => d.kind === 'videoinput').length > 1;
  } catch {
    podeVirarCamera = false;
  }
}

function restricaoDeCamera() {
  return {
    video: {
      facingMode: estado.cameraFrontal ? 'user' : 'environment',
      width: { ideal: 1280 },
      height: { ideal: 720 },
      frameRate: { ideal: 30, max: 30 },
    },
    audio: false, // o microfone e do canal de voz, e so de la
  };
}

async function ligarCamera() {
  // cameraStream tambem barra: durante uma reconexao cameraIds esta vazio, mas a
  // camera continua aberta — sem essa guarda o navegador abriria uma segunda.
  if (estado.cameraIds.has(socket.id) || estado.cameraStream) return;

  let stream;
  try {
    stream = await navigator.mediaDevices.getUserMedia(restricaoDeCamera());
  } catch (erro) {
    if (erro.name !== 'NotAllowedError') {
      mostrarAlerta('Não foi possível ligar a câmera: ' + erro.message);
    }
    return;
  }

  estado.cameraStream = stream;
  await conferirSePodeVirar(); // o rotulo/contagem so vem completo depois da permissao
  stream.getVideoTracks()[0].addEventListener('ended', desligarCamera);
  socket.emit('start-camera');
}

function desligarCamera() {
  if (!estado.cameraStream) return;

  estado.cameraStream.getTracks().forEach((t) => t.stop());
  estado.cameraStream = null;
  fecharSaidasDoCanal('camera');

  const minhaChave = chaveDe(socket.id, 'camera');
  estado.streamsDisponiveis.delete(minhaChave);

  // Tiro da lista antes de escolher a proxima transmissao pra ela nao se
  // oferecer como opcao, e devolvo em seguida: quem tira de verdade e o eco
  // 'camera-stopped' do servidor, o mesmo caminho de quando OUTRA pessoa
  // desliga a camera. Assim o botao e o som acontecem igual pra todo mundo.
  const estavaNaLista = estado.cameraIds.delete(socket.id);
  seguirParaProximaTransmissao(minhaChave);
  if (estavaNaLista) estado.cameraIds.add(socket.id);

  socket.emit('stop-camera');
}

// Trocar frontal/traseira sem derrubar a conexao: o que muda e a TRACK dentro
// das PeerConnections que ja existem (replaceTrack), nao a conexao. Renegociar
// aqui daria um piscar preto em quem esta assistindo, por nada.
async function virarCamera() {
  if (!estado.cameraStream) return;

  estado.cameraFrontal = !estado.cameraFrontal;

  let novoStream;
  try {
    novoStream = await navigator.mediaDevices.getUserMedia(restricaoDeCamera());
  } catch (erro) {
    estado.cameraFrontal = !estado.cameraFrontal; // desfaz: a camera de tras nao veio
    mostrarAlerta('Não foi possível virar a câmera: ' + erro.message);
    return;
  }

  const novaTrack = novoStream.getVideoTracks()[0];
  const antiga = estado.cameraStream.getVideoTracks()[0];

  await Promise.all(
    [...outgoingPCs.entries()]
      .filter(([chave]) => partesDaChave(chave).canal === 'camera')
      .map(([, pc]) => {
        const emissor = pc.getSenders().find((s) => s.track && s.track.kind === 'video');
        return emissor ? emissor.replaceTrack(novaTrack) : Promise.resolve();
      })
  );

  estado.cameraStream.removeTrack(antiga);
  antiga.stop();
  estado.cameraStream.addTrack(novaTrack);
  novaTrack.addEventListener('ended', desligarCamera);

  // A moldura segura o MESMO objeto MediaStream, entao o troca-troca de track
  // ja aparece sozinho — so o espelhamento e que muda de lado.
  aplicarEspelhoDaCamera();
}

// Camera frontal espelhada (e o que a pessoa espera de uma selfie); traseira
// nao, senao texto e placa apareceriam ao contrario. Vale SO pra minha propria
// previa — quem assiste ve a imagem como ela e.
//
// O botao de virar mora na barra do video, nao no rodape: ele age sobre o que
// esta na moldura, entao so faz sentido quando a moldura e a minha camera (e so
// aparece se o aparelho tiver mais de uma).
function aplicarEspelhoDaCamera() {
  const minhaCamera = estado.focoAtual === chaveDe(socket.id, 'camera');
  videoRemoto.classList.toggle('espelhado', minhaCamera && estado.cameraFrontal && previaVisivel);
  btnVirarCamera.classList.toggle('oculto', !(minhaCamera && podeVirarCamera));
}

if (btnCamera) {
  btnCamera.addEventListener('click', () => {
    if (estado.cameraIds.has(socket.id) || estado.cameraStream) desligarCamera();
    else ligarCamera();
  });
  btnVirarCamera.addEventListener('click', virarCamera);
}

function streamDoCanal(canal) {
  return canal === 'camera' ? estado.cameraStream : estado.localStream;
}

function estouTransmitindo(canal) {
  return canal === 'camera' ? estado.cameraIds.has(socket.id) : estado.sharingIds.has(socket.id);
}

async function iniciarConexaoSaida(peerId, canal) {
  const stream = streamDoCanal(canal);
  if (!stream) return;

  const chave = chaveDe(peerId, canal);
  const pc = criarConexao(canal);
  outgoingPCs.set(chave, pc);

  stream.getTracks().forEach((track) => pc.addTrack(track, stream));

  if (canal === 'camera') {
    await aplicarQualidadeNaConexao(pc, { maxBitrate: BITRATE_CAMERA, scale: 1, fps: 30 });
  } else {
    await aplicarQualidadeNaConexao(pc, lerValoresQualidadeAtual());
  }

  pc.onicecandidate = (e) => {
    if (e.candidate) socket.emit('signal', { to: peerId, payload: { tipo: 'ice', papel: 'saida', canal, candidate: e.candidate } });
  };

  const oferta = await pc.createOffer();
  await pc.setLocalDescription(oferta);
  socket.emit('signal', { to: peerId, payload: { tipo: 'offer', canal, sdp: pc.localDescription } });
}

socket.on('share-started', ({ id }) => {
  estado.sharingIds.add(id);
  renderizarParticipantes();
  atualizarBotaoCompartilhar();
  tocarSomAtivado();

  const chave = chaveDe(id, 'tela');
  if (id === socket.id && estado.streamPendente) {
    confirmarInicioCompartilhamento();
  } else if (id === socket.id && estado.localStream) {
    // voltei de uma reconexao ainda com a tela capturada: nao ha stream pendente
    // pra confirmar, e sim o mesmo stream de sempre precisando reaparecer.
    estado.streamsDisponiveis.set(chave, estado.localStream);
    if (estado.focoAtual) renderizarTiraTransmissoes();
    else focarEm(chave);
  } else {
    ofereserTransmissaoNova(chave);
  }
});

socket.on('share-stopped', ({ id }) => {
  if (!estado.sharingIds.has(id)) return; // estado ja atualizado (ex: eu mesmo, ver pararCompartilhamento)
  estado.sharingIds.delete(id);
  renderizarParticipantes();
  atualizarBotaoCompartilhar();
  tocarSomDesativado();

  const chave = chaveDe(id, 'tela');
  if (incomingPCs.has(chave)) {
    incomingPCs.get(chave).close();
    incomingPCs.delete(chave);
    filasIceEntrada.delete(chave);
  }
  estado.streamsDisponiveis.delete(chave);
  seguirParaProximaTransmissao(chave);
});

socket.on('camera-started', ({ id }) => {
  estado.cameraIds.add(id);
  renderizarParticipantes();
  atualizarBotaoCamera();

  const chave = chaveDe(id, 'camera');
  if (id === socket.id && estado.cameraStream) {
    estado.streamsDisponiveis.set(chave, estado.cameraStream);
    if (estado.focoAtual) renderizarTiraTransmissoes();
    else focarEm(chave);
  } else {
    ofereserTransmissaoNova(chave);
  }
});

socket.on('camera-stopped', ({ id }) => {
  if (!estado.cameraIds.has(id)) return;
  estado.cameraIds.delete(id);
  renderizarParticipantes();
  atualizarBotaoCamera();

  const chave = chaveDe(id, 'camera');
  if (incomingPCs.has(chave)) {
    incomingPCs.get(chave).close();
    incomingPCs.delete(chave);
    filasIceEntrada.delete(chave);
  }
  estado.streamsDisponiveis.delete(chave);
  seguirParaProximaTransmissao(chave);
});

// ---------------------------------------------------------------------------
// Sinalizacao WebRTC generica (offer / answer / ice)
// ---------------------------------------------------------------------------

socket.on('signal', async ({ from, payload }) => {
  // O MESMO par de pessoas pode ter varias conexoes ao mesmo tempo: minha tela
  // pra voce, sua tela pra mim, minha camera, sua camera, e a voz. O "papel"
  // separa ida de volta; o "canal" separa tela, camera e voz. Sem os dois, um
  // candidato ICE acabaria entregue a conexao errada, que morreria em silencio.
  if (payload.canal === 'voz') {
    await tratarSinalVoz(from, payload);
    return;
  }

  const canal = payload.canal === 'camera' ? 'camera' : 'tela';
  const chave = chaveDe(from, canal);

  if (payload.tipo === 'offer') {
    const pc = criarConexao(canal);
    incomingPCs.set(chave, pc);

    pc.ontrack = (e) => {
      estado.streamsDisponiveis.set(chave, e.streams[0]);
      if (estado.focoAtual === chave) {
        exibirFoco(); // eu tinha pedido essa transmissao, e ela acabou de chegar
      } else {
        renderizarTiraTransmissoes();
      }
    };
    pc.onicecandidate = (e) => {
      if (e.candidate) socket.emit('signal', { to: from, payload: { tipo: 'ice', papel: 'entrada', canal, candidate: e.candidate } });
    };

    await pc.setRemoteDescription(payload.sdp);
    const filaEntrada = filasIceEntrada.get(chave) || [];
    for (const c of filaEntrada.splice(0)) {
      try { await pc.addIceCandidate(c); } catch (e) { console.warn(e); }
    }

    const resposta = await pc.createAnswer();
    await pc.setLocalDescription(resposta);
    socket.emit('signal', { to: from, payload: { tipo: 'answer', canal, sdp: pc.localDescription } });
  } else if (payload.tipo === 'watch-request') {
    // alguem quer assistir uma transmissao MINHA — so conecta se ela existir de
    // fato agora, e evita duplicar se ja houver conexao desse canal com a pessoa
    if (estouTransmitindo(canal) && streamDoCanal(canal) && !outgoingPCs.has(chave)) {
      iniciarConexaoSaida(from, canal);
    }
  } else if (payload.tipo === 'watch-stop') {
    // essa pessoa nao quer mais assistir — libera so a conexao daquele canal
    if (outgoingPCs.has(chave)) {
      outgoingPCs.get(chave).close();
      outgoingPCs.delete(chave);
      filasIceSaida.delete(chave);
    }
  } else if (payload.tipo === 'answer') {
    const pc = outgoingPCs.get(chave);
    if (!pc) return;
    await pc.setRemoteDescription(payload.sdp);
    const fila = filasIceSaida.get(chave) || [];
    for (const c of fila.splice(0)) {
      try { await pc.addIceCandidate(c); } catch (e) { console.warn(e); }
    }
  } else if (payload.tipo === 'ice') {
    // O "papel" vem do ponto de vista de quem MANDOU o candidato: se veio da
    // conexao de SAIDA dele, aqui do meu lado isso pertence a conexao de
    // ENTRADA que eu tenho com essa pessoa (e vice-versa — e a mesma ligacao,
    // vista de cada lado).
    const pc = payload.papel === 'saida' ? incomingPCs.get(chave) : outgoingPCs.get(chave);
    const filas = payload.papel === 'saida' ? filasIceEntrada : filasIceSaida;

    if (pc && pc.remoteDescription) {
      pc.addIceCandidate(payload.candidate).catch((err) => console.warn(err));
    } else {
      if (!filas.has(chave)) filas.set(chave, []);
      filas.get(chave).push(payload.candidate);
    }
  }
});

// ---------------------------------------------------------------------------
// Chat de voz
//
// Tres diferencas em relacao a tela, todas de proposito:
//
// 1. Conexoes SEPARADAS. Track de microfone nunca entra numa PeerConnection de
//    tela. Sao midias com ciclo de vida e qualidade diferentes.
// 2. Sempre-para-todos, nao sob demanda. Quem esta na voz conecta com todo mundo
//    que esta na voz — e dai que vem o teto de ~6 pessoas: as conexoes crescem
//    com N*(N-1)/2 e existem o tempo todo, mesmo sem ninguem compartilhando.
// 3. Microfone com processamento LIGADO (eco, ruido, ganho). E o oposto exato da
//    regra do audio de tela, porque aqui e voz — o caso pra que esses
//    processamentos foram inventados.
//
// Como e uma malha, os dois lados querem ligar ao mesmo tempo. Quem faz a oferta
// e quem tem o socket.id menor; o outro espera. Sem isso as duas pontas ficariam
// preas em have-local-offer.
// ---------------------------------------------------------------------------

function enviarVoz(peerId, payload) {
  socket.emit('signal', { to: peerId, payload: { ...payload, canal: 'voz' } });
}

function devoIniciarCom(peerId) {
  return String(socket.id) < String(peerId);
}

function criarConexaoVoz(peerId) {
  const existente = vozPCs.get(peerId);
  if (existente) return existente;

  const pc = criarConexao('voz');
  vozPCs.set(peerId, pc);

  if (estado.vozStream) {
    estado.vozStream.getTracks().forEach((track) => pc.addTrack(track, estado.vozStream));
  }

  pc.onicecandidate = (e) => {
    if (e.candidate) enviarVoz(peerId, { tipo: 'ice', candidate: e.candidate });
  };

  pc.ontrack = (e) => {
    reproduzirVoz(peerId, e.streams[0]);
    monitorarNivel(peerId, e.streams[0]);
  };

  return pc;
}

async function iniciarConexaoVoz(peerId) {
  const pc = criarConexaoVoz(peerId);
  const oferta = await pc.createOffer();
  await pc.setLocalDescription(oferta);
  enviarVoz(peerId, { tipo: 'offer', sdp: pc.localDescription });
}

function encerrarConexaoVoz(peerId) {
  const pc = vozPCs.get(peerId);
  if (pc) pc.close();
  vozPCs.delete(peerId);
  filasIceVoz.delete(peerId);
  analisadoresVoz.delete(peerId);
  niveisVoz.delete(peerId);

  const el = audiosVoz.get(peerId);
  if (el) {
    el.srcObject = null;
    el.remove();
    audiosVoz.delete(peerId);
  }
}

// Reconcilia as conexoes de voz com quem esta no canal. Chamada sempre que a
// lista muda (entrou, saiu, eu entrei, eu sai, reconectei).
function sincronizarConexoesVoz() {
  const euEstou = estado.voiceIds.has(socket.id);

  if (!euEstou) {
    [...vozPCs.keys()].forEach(encerrarConexaoVoz);
    pararLoopNivel();
    return;
  }

  vozPCs.forEach((_, id) => {
    if (!estado.voiceIds.has(id)) encerrarConexaoVoz(id);
  });

  estado.voiceIds.forEach((id) => {
    if (id === socket.id || vozPCs.has(id)) return;
    if (devoIniciarCom(id)) iniciarConexaoVoz(id);
    // senao: fico esperando a oferta dele, pra nao haver oferta cruzada
  });

  iniciarLoopNivel();
}

async function tratarSinalVoz(from, payload) {
  if (payload.tipo === 'offer') {
    const pc = criarConexaoVoz(from);
    await pc.setRemoteDescription(payload.sdp);
    const fila = filasIceVoz.get(from) || [];
    for (const c of fila.splice(0)) {
      try { await pc.addIceCandidate(c); } catch (e) { console.warn(e); }
    }
    const resposta = await pc.createAnswer();
    await pc.setLocalDescription(resposta);
    enviarVoz(from, { tipo: 'answer', sdp: pc.localDescription });
  } else if (payload.tipo === 'answer') {
    const pc = vozPCs.get(from);
    if (!pc) return;
    await pc.setRemoteDescription(payload.sdp);
    const fila = filasIceVoz.get(from) || [];
    for (const c of fila.splice(0)) {
      try { await pc.addIceCandidate(c); } catch (e) { console.warn(e); }
    }
  } else if (payload.tipo === 'ice') {
    const pc = vozPCs.get(from);
    if (pc && pc.remoteDescription) {
      pc.addIceCandidate(payload.candidate).catch((err) => console.warn(err));
    } else {
      if (!filasIceVoz.has(from)) filasIceVoz.set(from, []);
      filasIceVoz.get(from).push(payload.candidate);
    }
  }
}

// ---- microfone ----
//
// O audio do microfone passa por um grafo WebAudio antes de ir pra rede:
//
//   getUserMedia (micBruto)
//        v
//   MediaStreamSource ---> ganhoUsuario ---> analisador ---> ganhoPortao ---> destino
//                                                v                              v
//                                     medidor e portao leem aqui        estado.vozStream
//                                                                    (o que vai pras PCs)
//
// O grafo e montado UMA vez. Trocar de microfone ou mexer em eco/ruido so troca
// o no de fonte — o destino continua o mesmo, entao estado.vozStream nao muda e
// as PeerConnections nem ficam sabendo: sem replaceTrack, sem renegociacao.
//
// O analisador fica ANTES do portao de proposito: assim ele mede o sinal real
// mesmo com o portao fechado, e o portao consegue reabrir. (Antes isso exigia
// medir um clone da track, porque o portao fechava com enabled=false.)

let noFonte = null;
let noGanho = null;
let noAnalisador = null;
let noPortao = null;
let noDestino = null;

function montarGrafoMicrofone(streamBruto) {
  const ctx = obterAudioCtxUI();
  if (!ctx) {
    // Sem WebAudio: manda o microfone cru. Perde ganho e portao, mas fala.
    estado.vozStream = streamBruto;
    return;
  }

  if (!noDestino) {
    noGanho = ctx.createGain();
    noGanho.gain.value = estado.micGanho;

    noAnalisador = ctx.createAnalyser();
    noAnalisador.fftSize = 512;
    noAnalisador.smoothingTimeConstant = 0.6;

    noPortao = ctx.createGain();
    noPortao.gain.value = 1;

    noDestino = ctx.createMediaStreamDestination();

    noGanho.connect(noAnalisador);
    noAnalisador.connect(noPortao);
    noPortao.connect(noDestino);

    estado.vozStream = noDestino.stream;
    analisadoresVoz.set(socket.id, {
      analisador: noAnalisador,
      dados: new Uint8Array(noAnalisador.fftSize),
    });
  }

  if (noFonte) noFonte.disconnect();
  noFonte = ctx.createMediaStreamSource(streamBruto);
  noFonte.connect(noGanho);
}

// O analisador do grafo e indexado pelo meu socket.id, que muda na reconexao.
// Sem reancorar, o medidor e o portao ficariam olhando pra uma chave morta.
function reancorarAnalisadorLocal() {
  if (!noAnalisador) return;
  analisadoresVoz.set(socket.id, {
    analisador: noAnalisador,
    dados: new Uint8Array(noAnalisador.fftSize),
  });
}

function desmontarGrafoMicrofone() {
  [noFonte, noGanho, noAnalisador, noPortao].forEach((no) => { if (no) no.disconnect(); });
  noFonte = noGanho = noAnalisador = noPortao = noDestino = null;
}

function restricoesDoMicrofone() {
  // LIGADOS de proposito — o oposto do audio de tela. Aqui e voz de microfone,
  // exatamente o caso pra que esses processamentos existem.
  const r = {
    echoCancellation: estado.micEco,
    noiseSuppression: estado.micRuido,
    autoGainControl: true,
  };
  if (estado.micEntradaId) r.deviceId = { exact: estado.micEntradaId };
  return r;
}

async function abrirMicrofone() {
  const anterior = estado.micBruto;
  try {
    const bruto = await navigator.mediaDevices.getUserMedia({ audio: restricoesDoMicrofone(), video: false });
    estado.micBruto = bruto;
    montarGrafoMicrofone(bruto);
    if (anterior) anterior.getTracks().forEach((t) => t.stop());
    aplicarEstadoMicrofone();
    listarDispositivos(); // so agora os rotulos vem preenchidos
    return true;
  } catch (erro) {
    if (erro.name === 'NotAllowedError') {
      mostrarAlerta('Pra entrar na conversa, precisa liberar o microfone no navegador.', 5500);
    } else {
      mostrarAlerta('Não consegui acessar o microfone: ' + erro.message, 5500);
    }
    return false;
  }
}

async function entrarNaVoz() {
  if (!(await abrirMicrofone())) return;
  estado.vozMudo = false;
  estado.vozSurdo = false;
  aplicarEstadoMicrofone();
  socket.emit('start-voice');
}

// Mudo e surdez sao decisao do usuario e cortam a track de vez; o portao e
// automatico e mexe so no ganho, com rampa, pra nao estalar.
let portaoAberto = true;

function aplicarEstadoMicrofone() {
  if (!estado.vozStream) return;
  const transmitir = !estado.vozMudo && !estado.vozSurdo;
  estado.vozStream.getAudioTracks().forEach((t) => { t.enabled = transmitir; });
}

function aplicarPortao(aberto) {
  if (!noPortao) return;
  const ctx = obterAudioCtxUI();
  if (!ctx) return;
  const agora = ctx.currentTime;
  noPortao.gain.cancelScheduledValues(agora);
  noPortao.gain.setValueAtTime(noPortao.gain.value, agora);
  // abre rapido pra nao comer o comeco da palavra, fecha devagar pra nao estalar
  noPortao.gain.linearRampToValueAtTime(aberto ? 1 : 0, agora + (aberto ? 0.02 : 0.15));
}

// Silencia o que CHEGA: a surdez cala todo mundo, e mudosLocais cala so quem eu
// escolhi. Nenhum dos dois e sinalizado — a outra pessoa nao fica sabendo.
function aplicarAudioDeEntrada() {
  audiosVoz.forEach((el, id) => {
    el.muted = estado.vozSurdo || estado.mudosLocais.has(id);
  });
}

function alternarMicrofone() {
  if (!estado.voiceIds.has(socket.id)) {
    entrarNaVoz();
    return;
  }
  estado.vozMudo = !estado.vozMudo;
  // Sair do mudo com o fone desligado nao faria sentido: religa os dois juntos.
  if (!estado.vozMudo && estado.vozSurdo) estado.vozSurdo = false;
  aplicarEstadoMicrofone();
  aplicarAudioDeEntrada();
  atualizarBotaoMicrofone();
  mostrarAlerta(estado.vozMudo ? 'Microfone desligado. Você continua ouvindo.' : 'Microfone ligado.');
}

// Guarda como o microfone estava antes da surdez, pra devolver do jeito que
// estava. Sem isso, voltar a ouvir deixava a pessoa muda sem ela pedir.
let mudoAntesDaSurdez = false;

function alternarFone() {
  if (!estado.voiceIds.has(socket.id)) return;
  estado.vozSurdo = !estado.vozSurdo;

  if (estado.vozSurdo) {
    // Silenciar tudo inclui o proprio microfone: seria estranho continuar
    // falando pra uma conversa que voce nao ouve.
    mudoAntesDaSurdez = estado.vozMudo;
    estado.vozMudo = true;
  } else {
    estado.vozMudo = mudoAntesDaSurdez;
  }

  aplicarEstadoMicrofone();
  aplicarAudioDeEntrada();
  atualizarBotaoMicrofone();
  mostrarAlerta(estado.vozSurdo ? 'Conversa silenciada — microfone e áudio.' : 'Conversa de volta.');
}

function atualizarBotaoMicrofone() {
  const naVoz = estado.voiceIds.has(socket.id);
  const mandando = naVoz && !estado.vozMudo && !estado.vozSurdo;

  // Microfone e fone dizem "desligado" do MESMO jeito: o icone base continua o
  // mesmo e a classe .cortado desenha o risco. Antes o microfone trocava pro SVG
  // microphone-slash, cujo risco vai pro outro lado e nao e vermelho — dois
  // botoes vizinhos significando a mesma coisa com desenhos diferentes.
  // Fora da voz o botao fica neutro: ali ele convida a entrar, nao avisa de mudo.
  iconeMicrofone.classList.add('icone-microphone');
  iconeMicrofone.classList.remove('icone-microphone-slash');
  btnMicrofone.classList.toggle('cortado', naVoz && !mandando);
  btnMicrofone.classList.toggle('ativo', mandando);
  btnMicrofone.setAttribute('aria-pressed', String(mandando));
  btnMicrofone.setAttribute(
    'aria-label',
    !naVoz ? 'Entrar na conversa por voz' : (mandando ? 'Desligar o microfone' : 'Ligar o microfone')
  );
  btnMicrofone.title = btnMicrofone.getAttribute('aria-label');

  btnFone.classList.toggle('oculto', !naVoz);
  btnFone.classList.toggle('cortado', estado.vozSurdo);
  btnFone.classList.toggle('ativo', naVoz && !estado.vozSurdo);
  btnFone.setAttribute('aria-pressed', String(estado.vozSurdo));
  btnFone.setAttribute('aria-label', estado.vozSurdo ? 'Voltar a ouvir a conversa' : 'Silenciar a conversa inteira');
  btnFone.title = estado.vozSurdo
    ? 'Voltar a ouvir a conversa'
    : 'Silenciar a conversa inteira (microfone e áudio)';

  if (medidorVozLocal) medidorVozLocal.classList.toggle('oculto', !naVoz);
  if (blocoMicrofone) blocoMicrofone.classList.toggle('oculto', !naVoz);
  if (notaSemVoz) notaSemVoz.classList.toggle('oculto', naVoz);
}

// ---- ajustes do proprio microfone ----

async function aplicarAjustesMicrofone() {
  if (!estado.micBruto) return;
  const track = estado.micBruto.getAudioTracks()[0];
  if (!track) return;
  try {
    await track.applyConstraints({ echoCancellation: estado.micEco, noiseSuppression: estado.micRuido });
  } catch {
    // Navegador que nao troca isso num track ja aberto: pega um microfone novo.
    // So o no de fonte muda, entao as conexoes nem ficam sabendo.
    await abrirMicrofone();
  }
}

// ---- dispositivos de entrada e saida ----

// setSinkId (escolher a saida de audio) so existe no Chrome e derivados. Onde
// nao existe, o seletor de saida some em vez de fingir que funciona.
const suportaEscolherSaida = typeof HTMLMediaElement !== 'undefined'
  && typeof HTMLMediaElement.prototype.setSinkId === 'function';

function preencherSelect(elemento, dispositivos, escolhido, rotuloPadrao) {
  elemento.innerHTML = '';
  const padrao = document.createElement('option');
  padrao.value = '';
  padrao.textContent = rotuloPadrao;
  elemento.appendChild(padrao);

  dispositivos.forEach((d, i) => {
    const op = document.createElement('option');
    op.value = d.deviceId;
    // Antes de liberar o microfone o navegador esconde os nomes; depois vem tudo.
    op.textContent = d.label || `Dispositivo ${i + 1}`;
    elemento.appendChild(op);
  });

  elemento.value = dispositivos.some((d) => d.deviceId === escolhido) ? escolhido : '';
}

async function listarDispositivos() {
  if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) return;
  let lista = [];
  try {
    lista = await navigator.mediaDevices.enumerateDevices();
  } catch {
    return;
  }

  preencherSelect(selectEntrada, lista.filter((d) => d.kind === 'audioinput'), estado.micEntradaId, 'Microfone padrão');

  const saidas = lista.filter((d) => d.kind === 'audiooutput');
  preencherSelect(selectSaida, saidas, estado.saidaId, 'Saída padrão');
  // A saida nao depende de estar na voz: ela vale pro som da tela tambem.
  blocoSaida.classList.toggle('oculto', !suportaEscolherSaida || saidas.length === 0);
}

async function aplicarSaidaEm(elemento) {
  if (!suportaEscolherSaida || !estado.saidaId) return;
  try {
    await elemento.setSinkId(estado.saidaId);
  } catch (erro) {
    console.warn('[VIO] nao deu pra trocar a saida de audio:', erro.message);
  }
}

async function aplicarSaidaEmTodos() {
  for (const el of [...audiosVoz.values(), videoRemoto]) await aplicarSaidaEm(el);
}

if (navigator.mediaDevices && 'ondevicechange' in navigator.mediaDevices) {
  navigator.mediaDevices.addEventListener('devicechange', async () => {
    await listarDispositivos();
    await conferirSePodeVirar(); // plugou/tirou uma webcam: o botao de virar acompanha
    aplicarEspelhoDaCamera();
  });
}

selectEntrada.addEventListener('change', async () => {
  estado.micEntradaId = selectEntrada.value;
  if (estado.micBruto) await abrirMicrofone();
});

selectSaida.addEventListener('change', async () => {
  estado.saidaId = selectSaida.value;
  await aplicarSaidaEmTodos();
});

rangeGanho.addEventListener('input', () => {
  estado.micGanho = Number(rangeGanho.value) / 100;
  if (noGanho) noGanho.gain.value = estado.micGanho;
  valorGanho.textContent = `${rangeGanho.value}%`;
});

function alternarMudoDe(peerId) {
  if (estado.mudosLocais.has(peerId)) estado.mudosLocais.delete(peerId);
  else estado.mudosLocais.add(peerId);
  aplicarAudioDeEntrada();
  renderizarParticipantes();
}

// Volume de UMA pessoa, so pra mim: nao vai pro servidor, ela nao fica sabendo,
// e some quando eu saio da sala — igual ao silenciar. Mexe no <audio> daquela
// pessoa, entao nao encosta na conexao nem no volume das outras.
const VOLUME_PADRAO_PESSOA = 100;

function volumeDe(peerId) {
  const v = estado.volumesLocais.get(peerId);
  return v === undefined ? VOLUME_PADRAO_PESSOA : v;
}

function definirVolumeDe(peerId, valor) {
  const limpo = Math.max(0, Math.min(100, Number(valor)));
  if (limpo === VOLUME_PADRAO_PESSOA) estado.volumesLocais.delete(peerId);
  else estado.volumesLocais.set(peerId, limpo);
  aplicarVolumeEm(peerId);
}

function aplicarVolumeEm(peerId) {
  const el = audiosVoz.get(peerId);
  if (el) el.volume = volumeDe(peerId) / 100;
}

btnFone.addEventListener('click', alternarFone);

rangeSensibilidade.addEventListener('input', () => {
  estado.micSensibilidade = Number(rangeSensibilidade.value);
  valorSensibilidade.textContent = estado.micSensibilidade === 0 ? 'sempre aberto' : String(estado.micSensibilidade);
});

chkEco.addEventListener('change', () => {
  estado.micEco = chkEco.checked;
  aplicarAjustesMicrofone();
});

chkRuido.addEventListener('change', () => {
  estado.micRuido = chkRuido.checked;
  aplicarAjustesMicrofone();
});

// No desktop o title ja aparece sozinho no hover; no toque nao existe hover,
// entao o mesmo texto vira alerta.
btnLimiteSala.addEventListener('click', () => {
  mostrarAlerta(btnLimiteSala.title, 9000);
});

// ---- reproducao e medicao de nivel ----

function reproduzirVoz(peerId, stream) {
  let el = audiosVoz.get(peerId);
  if (!el) {
    el = document.createElement('audio');
    el.autoplay = true;
    el.playsInline = true;
    el.dataset.peer = peerId;
    audiosVoz.set(peerId, el);
    document.body.appendChild(el);
    aplicarSaidaEm(el); // respeita a saida de audio escolhida
  }
  if (el.srcObject !== stream) el.srcObject = stream;
  el.muted = estado.vozSurdo || estado.mudosLocais.has(peerId);
  el.volume = volumeDe(peerId) / 100;
  el.play().catch(() => {
    // navegador segurando o audio ate um gesto: o proprio botao de microfone
    // ja e um gesto, entao na pratica isso quase nao acontece
    btnDesbloquearAudio.classList.remove('oculto');
  });
}

function monitorarNivel(peerId, stream) {
  const ctx = obterAudioCtxUI();
  if (!ctx || analisadoresVoz.has(peerId)) return;
  try {
    const analisador = ctx.createAnalyser();
    analisador.fftSize = 512;
    analisador.smoothingTimeConstant = 0.6;
    ctx.createMediaStreamSource(stream).connect(analisador);
    // de proposito NAO conectamos ao destination: quem toca o som e o <audio>.
    analisadoresVoz.set(peerId, { analisador, dados: new Uint8Array(analisador.fftSize) });
  } catch (erro) {
    console.warn('[VIO] nao deu pra medir o nivel de voz:', erro.message);
  }
}

function definirNivel(peerId, nivel, transmitindo = true) {
  niveisVoz.set(peerId, transmitindo ? nivel : 0);

  const item = listaParticipantes.querySelector(`li[data-id="${CSS.escape(peerId)}"] .avatar-participante`);
  if (item) item.classList.toggle('falando', transmitindo && nivel > LIMIAR_FALANDO);

  if (peerId === socket.id && medidorVozLocal) {
    medidorVozLocal.style.setProperty('--nivel', nivel); // sempre o cru
  }
}

let rafNivel = null;

// Portao de ruido: abre na hora que a voz passa do limiar, e so fecha depois de
// um tempinho de silencio — fechar na primeira pausa cortaria o fim das frases.
const ESPERA_PRA_FECHAR_MS = 400;
let fechaPortaoEm = 0;

function avaliarPortao(nivelCru) {
  if (estado.micSensibilidade === 0) {
    portaoAberto = true;
  } else if (nivelCru >= estado.micSensibilidade) {
    portaoAberto = true;
    fechaPortaoEm = 0;
  } else if (portaoAberto) {
    const agora = performance.now();
    if (fechaPortaoEm === 0) {
      fechaPortaoEm = agora + ESPERA_PRA_FECHAR_MS;
    } else if (agora >= fechaPortaoEm) {
      portaoAberto = false;
      fechaPortaoEm = 0;
    }
  }
  aplicarPortao(portaoAberto);
}

function loopNivelVoz() {
  analisadoresVoz.forEach(({ analisador, dados }, peerId) => {
    analisador.getByteTimeDomainData(dados);
    let soma = 0;
    for (let i = 0; i < dados.length; i += 1) {
      const v = (dados[i] - 128) / 128;
      soma += v * v;
    }
    const rms = Math.sqrt(soma / dados.length);
    const nivel = Math.min(100, Math.round(rms * 400));

    if (peerId === socket.id) {
      // o analisador fica ANTES do portao, entao aqui o nivel e sempre o real
      avaliarPortao(nivel);
      // o medidor mostra esse nivel (serve pra ajustar ganho e sensibilidade),
      // mas o anel so acende quando eu estou de fato mandando alguma coisa
      const mandando = !estado.vozMudo && !estado.vozSurdo && portaoAberto;
      definirNivel(peerId, nivel, mandando);
    } else {
      definirNivel(peerId, estado.mudosLocais.has(peerId) || estado.vozSurdo ? 0 : nivel);
    }
  });
  rafNivel = requestAnimationFrame(loopNivelVoz);
}

function iniciarLoopNivel() {
  if (rafNivel === null) rafNivel = requestAnimationFrame(loopNivelVoz);
}

function pararLoopNivel() {
  if (rafNivel !== null) cancelAnimationFrame(rafNivel);
  rafNivel = null;
  niveisVoz.clear();
  if (medidorVozLocal) medidorVozLocal.style.setProperty('--nivel', 0);
}

function largarVoz() {
  [...vozPCs.keys()].forEach(encerrarConexaoVoz);
  pararLoopNivel();
  analisadoresVoz.clear();
  desmontarGrafoMicrofone();
  if (estado.micBruto) {
    estado.micBruto.getTracks().forEach((t) => t.stop());
    estado.micBruto = null;
  }
  estado.vozStream = null;
  estado.vozMudo = false;
  estado.vozSurdo = false;
  estado.mudosLocais.clear();
  estado.voiceIds.clear();
  portaoAberto = true;
}

btnMicrofone.addEventListener('click', alternarMicrofone);

socket.on('voice-started', ({ id }) => {
  estado.voiceIds.add(id);
  if (id !== socket.id) mostrarAlerta(`${nomeDoParticipante(id)} entrou na conversa.`);
  renderizarParticipantes();
  atualizarBotaoMicrofone();
  sincronizarConexoesVoz();
});

socket.on('voice-stopped', ({ id }) => {
  if (!estado.voiceIds.has(id)) return;
  estado.voiceIds.delete(id);
  renderizarParticipantes();
  atualizarBotaoMicrofone();
  sincronizarConexoesVoz();
});

// ---------------------------------------------------------------------------
// Controle do audio ENVIADO por quem compartilha (ligar/desligar o som da tela)
// — diferente do volume da barra de video, que e so a audicao local de quem assiste
// ---------------------------------------------------------------------------

chkAudio.addEventListener('change', () => {
  if (estado.localStream) {
    const trackAudio = estado.localStream.getAudioTracks()[0];
    if (trackAudio) trackAudio.enabled = chkAudio.checked;
  }
});

// ---------------------------------------------------------------------------
// Controle de qualidade (bitrate / fps / resolucao, tudo ao vivo)
// ---------------------------------------------------------------------------

function presetParaValores(preset) {
  return {
    fps: preset.fps,
    maxBitrate: Math.round(preset.bitrateMbps * 1_000_000),
    scale: Math.max(1, 100 / preset.escalaPercentual),
  };
}

function lerValoresQualidadeAtual() {
  if (qualidadeAtualPreset && QUALIDADE_PRESETS[qualidadeAtualPreset]) {
    return presetParaValores(QUALIDADE_PRESETS[qualidadeAtualPreset]);
  }
  return {
    fps: Number(rangeFps.value),
    maxBitrate: Math.round(Number(rangeBitrate.value) * 1_000_000),
    scale: Math.max(1, 100 / Number(rangeEscala.value)),
  };
}

function aplicarValoresNosSliders(preset) {
  rangeFps.value = preset.fps;
  valorFps.textContent = preset.fps;
  rangeBitrate.value = preset.bitrateMbps;
  valorBitrate.textContent = preset.bitrateMbps.toFixed(1) + ' Mbps';
  rangeEscala.value = preset.escalaPercentual;
  valorEscala.textContent = preset.escalaPercentual + '%';
}

async function aplicarQualidadeNaConexao(pc, qualidade) {
  const sender = pc.getSenders().find((s) => s.track && s.track.kind === 'video');
  if (!sender) return;
  const paramsConexao = sender.getParameters();
  if (!paramsConexao.encodings || paramsConexao.encodings.length === 0) paramsConexao.encodings = [{}];
  paramsConexao.encodings[0].maxBitrate = qualidade.maxBitrate;
  paramsConexao.encodings[0].scaleResolutionDownBy = qualidade.scale;
  try {
    await sender.setParameters(paramsConexao);
  } catch (erro) {
    console.warn('Não foi possível aplicar os parâmetros de qualidade:', erro);
  }
}

// Os ajustes de qualidade sao da TELA (bitrate alto por causa de texto pequeno).
// A camera tem teto proprio e fixo, entao fica de fora — o mesmo cuidado que os
// ajustes de microfone tem de nao encostar no audio da tela.
function aplicarQualidadeATodasConexoes(qualidade) {
  outgoingPCs.forEach((pc, chave) => {
    if (partesDaChave(chave).canal !== 'tela') return;
    aplicarQualidadeNaConexao(pc, qualidade);
  });
  if (estado.localStream) {
    const trackVideo = estado.localStream.getVideoTracks()[0];
    if (trackVideo) {
      trackVideo.applyConstraints({ frameRate: { ideal: qualidade.fps, max: qualidade.fps } }).catch(() => {});
    }
  }
}

botoesQualidade.forEach((btn) => {
  btn.addEventListener('click', () => {
    const valor = btn.dataset.valor;
    const preset = QUALIDADE_PRESETS[valor];
    if (!preset) return;
    qualidadeAtualPreset = valor;
    botoesQualidade.forEach((b) => b.classList.toggle('ativo', b === btn));
    aplicarValoresNosSliders(preset);
    if (estado.localStream) aplicarQualidadeATodasConexoes(presetParaValores(preset));
  });
});

[rangeFps, rangeBitrate, rangeEscala].forEach((slider) => {
  slider.addEventListener('input', () => {
    qualidadeAtualPreset = null; // personalizada
    botoesQualidade.forEach((b) => b.classList.remove('ativo'));
    valorFps.textContent = rangeFps.value;
    valorBitrate.textContent = Number(rangeBitrate.value).toFixed(1) + ' Mbps';
    valorEscala.textContent = rangeEscala.value + '%';
    if (estado.localStream) aplicarQualidadeATodasConexoes(lerValoresQualidadeAtual());
  });
});

// ---------------------------------------------------------------------------
// Ping / qualidade da conexao — ponto colorido sempre visivel no cabecalho,
// detalhe numerico na folha "Sobre a sala"
// ---------------------------------------------------------------------------

let intervalPing = null;

function medirPingSinalizacao() {
  const inicio = performance.now();
  socket.emit('ping-teste', () => {
    definirPing(Math.round(performance.now() - inicio), 'servidor');
  });
}

async function medirPingConexao(pc) {
  if (!pc) return null;
  try {
    const relatorio = await pc.getStats();
    let rtt = null;
    relatorio.forEach((r) => {
      if (r.type === 'candidate-pair' && (r.state === 'succeeded' || r.nominated) && typeof r.currentRoundTripTime === 'number') {
        rtt = r.currentRoundTripTime * 1000;
      }
    });
    return rtt;
  } catch {
    return null;
  }
}

async function atualizarPing() {
  const pcFoco = incomingPCs.get(estado.focoAtual) || outgoingPCs.get(estado.focoAtual);
  const candidatos = pcFoco ? [pcFoco] : [...outgoingPCs.values(), ...incomingPCs.values()];

  for (const pc of candidatos) {
    const rtt = await medirPingConexao(pc);
    if (rtt !== null) {
      definirPing(Math.round(rtt), 'vídeo');
      return;
    }
  }
  medirPingSinalizacao();
}

function definirPing(ms, tipo) {
  textoPingCompleto.textContent = `${ms} ms · ${tipo === 'vídeo' ? 'conexão de vídeo' : 'servidor'}`;
  pontoPing.classList.remove('ping-bom', 'ping-medio', 'ping-ruim');
  if (ms < 100) pontoPing.classList.add('ping-bom');
  else if (ms < 250) pontoPing.classList.add('ping-medio');
  else pontoPing.classList.add('ping-ruim');
}

function iniciarMedicaoPing() {
  atualizarPing();
  intervalPing = setInterval(atualizarPing, 3000);
}

function pararMedicaoPing() {
  clearInterval(intervalPing);
  intervalPing = null;
}

// ---------------------------------------------------------------------------
// Service worker (PWA)
//
// So existe pra deixar o app instalavel e pra tela de entrada abrir sem rede.
// Ele nao encosta na sinalizacao nem em estado de sala — ver @public/sw.js.
//
// Registra depois do load pra nao disputar banda com o que a pagina precisa
// pra funcionar, e falha em silencio de proposito: em contexto inseguro (http
// num IP da rede local, como no teste pelo Radmin) o navegador simplesmente
// nao registra, e o VIO continua funcionando igual, so sem instalar.
// ---------------------------------------------------------------------------

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch((erro) => {
      console.warn('[VIO] service worker nao registrado:', erro.message);
    });
  });
}

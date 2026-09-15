// server.js
//
// Servidor de sinalizacao. Ele NAO transporta video/audio - so ajuda os
// participantes a se encontrarem e trocarem as mensagens WebRTC (offer,
// answer, ICE candidates). O video e o audio em si viajam direto entre os
// computadores (peer-to-peer), o que e o motivo de a qualidade escolhida
// impactar diretamente o upload de quem esta compartilhando.
//
// Mais de uma pessoa pode compartilhar ao mesmo tempo na mesma sala: o
// servidor so guarda um conjunto (Set) de quem esta no ar, sem escolher
// "o" apresentador. Cada espectador decide, do lado do navegador, qual
// transmissao quer ver em foco.

const path = require('path');
const http = require('http');
const express = require('express');
const { Server } = require('socket.io');
const packageJson = require('./package.json');

const app = express();

// Confia no cabecalho X-Forwarded-* do proxy da hospedagem (Render, etc.) —
// importante pra qualquer coisa que dependa do IP real de quem acessa.
app.set('trust proxy', 1);

const server = http.createServer(app);

// Lista de origens extras liberadas, alem do padrao (localhost e *.onrender.com).
// Definir via variavel de ambiente se um dominio proprio for adicionado depois,
// ex: ALLOWED_ORIGINS=https://meudominio.com,https://www.meudominio.com
const ORIGENS_EXTRAS = (process.env.ALLOWED_ORIGINS || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

function origemPermitida(origin, callback) {
  // Sem cabecalho Origin (ex: apps nao-navegador, algumas ferramentas) — permite.
  // Isso nao abre brecha pro ataque que essa checagem existe pra evitar (que
  // depende do NAVEGADOR de alguem mandar a origem de um site malicioso —
  // navegador sempre manda Origin quando a conexao parte de uma pagina web).
  if (!origin) return callback(null, true);

  let permitido = false;
  try {
    const host = new URL(origin).hostname;
    permitido = host === 'localhost' || host === '127.0.0.1' || host.endsWith('.onrender.com') || ORIGENS_EXTRAS.includes(origin);
  } catch {
    permitido = false;
  }
  callback(null, permitido);
}

const io = new Server(server, {
  cors: { origin: origemPermitida },
});

const PORT = process.env.PORT || 3000;

app.use(express.static(path.join(__dirname, 'public')));

app.get('/api/version', (req, res) => {
  res.json({ version: packageJson.version });
});

// -----------------------------------------------------------------------
// Limitador de taxa simples, em memoria, sem dependencia externa.
// Cada instancia controla "no maximo N chamadas por chave dentro da janela".
// A limpeza periodica evita acumular memoria com chaves que nunca mais voltam.
// -----------------------------------------------------------------------
function criarLimitador(janelaMs, maxNaJanela) {
  const registros = new Map(); // chave -> lista de timestamps

  setInterval(() => {
    const agora = Date.now();
    for (const [chave, historico] of registros) {
      const aindaValido = historico.filter((t) => agora - t < janelaMs);
      if (aindaValido.length === 0) registros.delete(chave);
      else registros.set(chave, aindaValido);
    }
  }, Math.max(janelaMs, 60_000)).unref();

  return function permitido(chave) {
    const agora = Date.now();
    const historico = (registros.get(chave) || []).filter((t) => agora - t < janelaMs);
    if (historico.length >= maxNaJanela) {
      registros.set(chave, historico);
      return false;
    }
    historico.push(agora);
    registros.set(chave, historico);
    return true;
  };
}

const limitarCriacaoDeSala = criarLimitador(10 * 60 * 1000, 20); // 20 salas novas por IP a cada 10 min
const limitarEntradaNaSala = criarLimitador(60 * 1000, 30); // 30 entradas por IP a cada minuto
const limitarSinalizacao = criarLimitador(10 * 1000, 200); // 200 msgs de sinalizacao por conexao a cada 10s
const limitarAcoesDeSala = criarLimitador(60 * 1000, 20); // 20 start/stop-share por conexao a cada minuto
const limitarPing = criarLimitador(10 * 1000, 30); // 30 pings por conexao a cada 10s

function obterIp(socket) {
  const forwardedFor = socket.handshake.headers['x-forwarded-for'];
  if (forwardedFor) return forwardedFor.split(',')[0].trim(); // primeiro da lista = IP original do visitante
  return socket.handshake.address;
}

// Estado das salas, tudo em memoria (some quando o servidor reinicia).
// rooms: Map<roomId, { participants: Map<socketId, {name}>, sharingIds: Set<socketId>,
//                      voiceIds: Set<socketId>, cameraIds: Set<socketId>, criadaEm: number }>
//
// sharingIds, voiceIds e cameraIds sao listas separadas de proposito: os tres sao
// canais independentes. Da pra estar na voz sem compartilhar nada, ligar a camera
// sem entrar na voz, ou compartilhar tela e camera ao mesmo tempo.
const rooms = new Map();

function roomState(room) {
  return {
    participants: [...room.participants.entries()].map(([id, p]) => ({ id, name: p.name })),
    sharingIds: [...room.sharingIds],
    voiceIds: [...room.voiceIds],
    cameraIds: [...room.cameraIds],
    criadaEm: room.criadaEm,
  };
}

io.on('connection', (socket) => {
  let currentRoomId = null;
  const ip = obterIp(socket);

  socket.on('join-room', ({ roomId, name }) => {
    if (!roomId || typeof name !== 'string' || !name.trim()) return;

    if (!limitarEntradaNaSala(ip)) {
      socket.emit('room-error', { motivo: 'limite-entrada' });
      return;
    }

    roomId = String(roomId).trim().toUpperCase().slice(0, 12);

    const salaJaExiste = rooms.has(roomId);
    if (!salaJaExiste && !limitarCriacaoDeSala(ip)) {
      socket.emit('room-error', { motivo: 'limite-criacao' });
      return;
    }

    currentRoomId = roomId;
    socket.join(roomId);

    if (!rooms.has(roomId)) {
      rooms.set(roomId, { participants: new Map(), sharingIds: new Set(), voiceIds: new Set(), cameraIds: new Set(), criadaEm: Date.now() });
    }
    const room = rooms.get(roomId);
    room.participants.set(socket.id, { name: name.trim().slice(0, 40) });

    // Manda pro recem-chegado o estado atual da sala
    socket.emit('room-state', roomState(room));

    // Avisa os outros que alguem entrou (quem estiver compartilhando vai
    // reagir a esse evento criando uma nova conexao para o novo participante)
    socket.to(roomId).emit('participant-joined', { id: socket.id, name: name.trim() });
  });

  socket.on('start-share', () => {
    if (!limitarAcoesDeSala(socket.id)) return;
    const room = rooms.get(currentRoomId);
    if (!room) return;
    room.sharingIds.add(socket.id); // varias pessoas podem estar aqui ao mesmo tempo
    io.to(currentRoomId).emit('share-started', { id: socket.id });
  });

  socket.on('stop-share', () => {
    if (!limitarAcoesDeSala(socket.id)) return;
    const room = rooms.get(currentRoomId);
    if (!room || !room.sharingIds.has(socket.id)) return;
    room.sharingIds.delete(socket.id);
    io.to(currentRoomId).emit('share-stopped', { id: socket.id });
  });

  // Voz: mesma mecanica de start-share/stop-share, lista separada. Ao contrario
  // da tela — que so conecta a quem esta de fato assistindo — a voz e sempre
  // para todos que estao nela, e e dai que vem o teto de ~6 pessoas por sala.
  socket.on('start-voice', () => {
    if (!limitarAcoesDeSala(socket.id)) return;
    const room = rooms.get(currentRoomId);
    if (!room) return;
    room.voiceIds.add(socket.id);
    io.to(currentRoomId).emit('voice-started', { id: socket.id });
  });

  socket.on('stop-voice', () => {
    if (!limitarAcoesDeSala(socket.id)) return;
    const room = rooms.get(currentRoomId);
    if (!room || !room.voiceIds.has(socket.id)) return;
    room.voiceIds.delete(socket.id);
    io.to(currentRoomId).emit('voice-stopped', { id: socket.id });
  });

  // Camera: lista propria, mesma mecanica. Ao contrario da voz — que e
  // sempre-para-todos — a camera e SOB DEMANDA como a tela: so conecta com quem
  // de fato pediu pra ver. Video custa caro demais pra mandar sem ninguem olhar.
  socket.on('start-camera', () => {
    if (!limitarAcoesDeSala(socket.id)) return;
    const room = rooms.get(currentRoomId);
    if (!room) return;
    room.cameraIds.add(socket.id);
    io.to(currentRoomId).emit('camera-started', { id: socket.id });
  });

  socket.on('stop-camera', () => {
    if (!limitarAcoesDeSala(socket.id)) return;
    const room = rooms.get(currentRoomId);
    if (!room || !room.cameraIds.has(socket.id)) return;
    room.cameraIds.delete(socket.id);
    io.to(currentRoomId).emit('camera-stopped', { id: socket.id });
  });

  // Relay generico de sinalizacao WebRTC (offer / answer / ice candidate).
  // O servidor so repassa o payload para o destinatario certo, sem entender
  // (nem precisar entender) o conteudo.
  socket.on('signal', ({ to, payload }) => {
    if (!to || !payload) return;
    if (!limitarSinalizacao(socket.id)) return;
    io.to(to).emit('signal', { from: socket.id, payload });
  });

  // Usado pelo indicador de ping no cliente: so responde na hora, o tempo de
  // ida e volta e medido no proprio navegador. Serve de fallback para quando
  // ainda nao existe nenhuma conexao WebRTC ativa pra medir (nesse caso o
  // cliente prefere o ping "de verdade" da conexao de video).
  socket.on('ping-teste', (callback) => {
    if (!limitarPing(socket.id)) return;
    if (typeof callback === 'function') callback();
  });

  socket.on('disconnect', () => {
    if (!currentRoomId) return;
    const room = rooms.get(currentRoomId);
    if (!room) return;

    room.participants.delete(socket.id);

    if (room.sharingIds.has(socket.id)) {
      room.sharingIds.delete(socket.id);
      socket.to(currentRoomId).emit('share-stopped', { id: socket.id });
    }

    if (room.voiceIds.has(socket.id)) {
      room.voiceIds.delete(socket.id);
      socket.to(currentRoomId).emit('voice-stopped', { id: socket.id });
    }

    if (room.cameraIds.has(socket.id)) {
      room.cameraIds.delete(socket.id);
      socket.to(currentRoomId).emit('camera-stopped', { id: socket.id });
    }

    socket.to(currentRoomId).emit('participant-left', { id: socket.id });

    if (room.participants.size === 0) rooms.delete(currentRoomId);
  });
});

server.listen(PORT, '0.0.0.0', () => {
  const hostnameRender = process.env.RENDER_EXTERNAL_HOSTNAME; // definido automaticamente pelo Render, so em producao la
  console.log(`\nVIO v${packageJson.version} rodando!`);
  if (hostnameRender) {
    console.log(`Endereco publico: https://${hostnameRender}`);
  } else {
    console.log(`Acesse no seu computador: http://localhost:${PORT}`);
    console.log('(veja o README para acessar do celular ou de fora da sua rede)');
  }
  console.log('');
});

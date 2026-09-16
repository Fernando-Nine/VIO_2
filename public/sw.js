// sw.js — service worker do VIO.
//
// Serve pra duas coisas, e so duas: deixar o app instalavel e fazer a tela de
// entrada abrir sem rede. Ele NAO participa de nada que envolva a sala.
//
// Regras que nao se negociam:
// - Estrategia rede-primeiro. O cache so responde quando a rede falha, entao
//   quem esta online sempre recebe o codigo mais novo.
// - O transporte do Socket.IO (/socket.io/?EIO=...) NUNCA passa por aqui. Um
//   handler no meio da sinalizacao quebraria a sala de um jeito silencioso.
//   A unica excecao sob /socket.io/ e o proprio socket.io.js, que e arquivo
//   estatico e faz parte do shell.
// - /api/ tambem fica de fora: e dinamico por definicao.
// - Nada de estado de sala no cache. O servidor guarda tudo em memoria e a sala
//   morre com ele; guardar um retrato disso so produziria mentira.
//
// Nao chamamos skipWaiting(): uma versao nova espera as abas fecharem em vez de
// trocar o codigo por baixo de quem esta no meio de um compartilhamento.

const CACHE = 'vio-shell-v1';

const SHELL = [
  '/',
  '/index.html',
  '/style.css',
  '/app.js',
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png',
  '/socket.io/socket.io.js',
];

const SCRIPT_SOCKET_IO = '/socket.io/socket.io.js';

self.addEventListener('install', (evento) => {
  evento.waitUntil(
    caches.open(CACHE).then((cache) =>
      // tolerante de proposito: um recurso que falhe nao pode impedir a
      // instalacao inteira — o rede-primeiro busca ele depois assim mesmo
      Promise.all(SHELL.map((url) => cache.add(url).catch(() => {})))
    )
  );
});

self.addEventListener('activate', (evento) => {
  evento.waitUntil(
    caches.keys().then((nomes) =>
      Promise.all(nomes.filter((n) => n !== CACHE).map((n) => caches.delete(n)))
    )
  );
});

function foraDeEscopo(url, req) {
  if (req.method !== 'GET') return true;
  if (url.origin !== self.location.origin) return true; // Google Fonts e afins: deixa o navegador cuidar
  if (url.pathname.startsWith('/api/')) return true;
  if (url.pathname.startsWith('/socket.io/') && url.pathname !== SCRIPT_SOCKET_IO) return true;
  return false;
}

async function redePrimeiro(req) {
  try {
    const resposta = await fetch(req);
    if (resposta && resposta.ok && resposta.type === 'basic') {
      const cache = await caches.open(CACHE);
      cache.put(req, resposta.clone());
    }
    return resposta;
  } catch {
    const guardado = await caches.match(req);
    if (guardado) return guardado;

    if (req.mode === 'navigate') {
      const shell = await caches.match('/index.html');
      if (shell) return shell;
    }
    return new Response('Sem conexão e sem cópia local deste recurso.', {
      status: 504,
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    });
  }
}

self.addEventListener('fetch', (evento) => {
  const req = evento.request;
  const url = new URL(req.url);
  if (foraDeEscopo(url, req)) return; // sem respondWith: o navegador segue o caminho normal
  evento.respondWith(redePrimeiro(req));
});

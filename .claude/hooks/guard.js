#!/usr/bin/env node
// guard.js — portao de protecao do VIO.
//
// O Claude Code executa este script ANTES de cada Bash, Write e Edit
// (ver .claude/settings.json) e obedece a decisao que ele devolve.
// E o mecanismo por tras das regras marcadas [HOOK] no CLAUDE.md: texto no
// CLAUDE.md e pedido, isto aqui e portao.
//
// Node puro, sem dependencia: usa o runtime que o projeto ja exige.

const { execSync } = require('child_process');

// Regras de CONVENCAO: valem so DENTRO deste repositorio. Elas dizem como o VIO
// e escrito, e essa opiniao nao se estende a casa dos outros — um segundo
// projeto na mesma sessao (o VIO_TEST, por exemplo) usa TypeScript e React de
// proposito. Antes desta separacao o portao barrava qualquer .ts do mundo,
// porque normalizar() so tira o prefixo quando o caminho esta dentro do repo e,
// fora dele, sobrava o caminho absoluto pro /\.tsx?$/ casar.
const REGRAS_DO_PROJETO = [
  { re: /^components\//i, motivo: 'componente React/shadcn — o VIO nao usa framework de front' },
  { re: /^lib\//i, motivo: 'helper de Tailwind/shadcn — o VIO nao usa Tailwind' },
  { re: /^pnpm-(lock|workspace)\.yaml$/i, motivo: 'o VIO usa npm, nao pnpm' },
  { re: /\.tsx?$/i, motivo: 'TypeScript — o VIO e JS puro, sem build' },
  { re: /^public\/placeholder-/i, motivo: 'placeholder de ferramenta visual (V0)' },
];

// Regras de SEGURANCA: valem em QUALQUER lugar. Segredo vazado e segredo
// vazado, esteja ele na pasta que estiver — aqui o alcance largo e o certo.
const REGRAS_UNIVERSAIS = [
  { re: /(^|\/)\.env(\.|$)/i, motivo: 'arquivo de ambiente — pode conter segredo' },
  { re: /\.(pem|key|p12|pfx)$/i, motivo: 'chave ou certificado' },
  { re: /(^|\/)id_(rsa|ed25519)(\.|$)/i, motivo: 'chave SSH' },
  { re: /(^|\/)node_modules\//, motivo: 'dependencias instaladas' },
];

function git(args) {
  return execSync(`git ${args}`, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
}

function bloquear(motivo) {
  process.stdout.write(JSON.stringify({
    hookSpecificOutput: {
      hookEventName: 'PreToolUse',
      permissionDecision: 'deny',
      permissionDecisionReason: motivo,
    },
  }));
  process.exit(0);
}

function avisar(texto) {
  process.stdout.write(JSON.stringify({ systemMessage: texto }));
  process.exit(0);
}

let raizCache;
function raizDoRepo() {
  if (raizCache === undefined) {
    try {
      raizCache = git('rev-parse --show-toplevel').replace(/\\/g, '/');
    } catch {
      raizCache = null;
    }
  }
  return raizCache;
}

// Devolve o caminho relativo e se ele esta DENTRO deste repositorio. Caminho
// relativo conta como interno: no commit os nomes vem do proprio git, ja
// relativos a raiz.
function normalizar(caminho) {
  const bruto = String(caminho).replace(/\\/g, '/').replace(/^\.\//, '');
  const raiz = raizDoRepo();
  if (raiz && bruto.toLowerCase().startsWith(raiz.toLowerCase() + '/')) {
    return { rel: bruto.slice(raiz.length + 1), dentro: true };
  }
  const absoluto = /^([a-z]:)?\//i.test(bruto);
  return { rel: bruto, dentro: !absoluto };
}

function checarProibido(caminho, contexto) {
  const { rel, dentro } = normalizar(caminho);
  const regras = dentro
    ? [...REGRAS_UNIVERSAIS, ...REGRAS_DO_PROJETO]
    : REGRAS_UNIVERSAIS;
  for (const p of regras) {
    if (p.re.test(rel)) {
      bloquear(`${contexto}: "${rel}" — ${p.motivo}. Regra [HOOK] do CLAUDE.md.`);
    }
  }
}

function verificarVersao(staged) {
  if (!staged.includes('package.json')) return;
  let diff = '';
  try {
    diff = git('diff --cached -- package.json');
  } catch {
    return;
  }
  if (!/^[+-]\s*"version"/m.test(diff)) return;

  const espelhos = ['CHANGELOG.md', 'public/changelog.json'];
  const faltando = espelhos.filter((f) => !staged.includes(f));
  if (faltando.length > 0) {
    bloquear(
      `A "version" do package.json mudou, mas ${faltando.join(' e ')} nao entrou no commit. ` +
      'O app le a versao de /api/version (package.json) e o changelog de public/changelog.json — ' +
      'se divergirem, a tela mostra um numero e o changelog mostra outro. Regra [HOOK] do CLAUDE.md.'
    );
  }
}

// Remove heredocs e trechos entre aspas antes de procurar comando perigoso.
// Sem isso, uma mensagem de commit que MENCIONA "npm install" e lida como se
// fosse a execucao — texto citado e dado, nao comando.
function semLiterais(cmd) {
  return String(cmd)
    .replace(/<<-?\s*(['"]?)(\w+)\1[\s\S]*?^\s*\2\s*$/gm, ' ')
    .replace(/'[^']*'/g, " '' ")
    .replace(/"(?:[^"\\]|\\.)*"/g, ' "" ');
}

function verificarBash(comandoBruto) {
  const comando = semLiterais(comandoBruto);

  if (/\bgit\s+push\b/.test(comando)) {
    let branch = '';
    try {
      branch = git('rev-parse --abbrev-ref HEAD');
    } catch { /* fora de repo: cai no teste textual abaixo */ }
    const alvoMain = /\borigin\s+(main|master)\b/.test(comando) || /\bHEAD:(main|master)\b/.test(comando);
    const pushImplicito = !/\borigin\s+\S/.test(comando) && (branch === 'main' || branch === 'master');
    if (alvoMain || pushImplicito) {
      bloquear(
        'Push direto na main bloqueado. Abra um PR a partir de uma branch. Regra [HOOK] do CLAUDE.md. ' +
        '(Voce mesmo pode dar o push no seu terminal — este portao vale para o Claude Code.)'
      );
    }
  }

  const npm = comando.match(/\bnpm\s+(?:i|install|add)\b([^&|;]*)/);
  if (npm) {
    // Corta no primeiro redirecionamento (">log", "2>&1") e descarta flags:
    // nada disso e nome de pacote.
    const args = npm[1].split(/\s*\d*[<>]/)[0];
    const pacotes = args.trim().split(/\s+/).filter((a) => a && !a.startsWith('-'));
    if (pacotes.length > 0) {
      bloquear(
        `"npm install ${pacotes.join(' ')}" adiciona dependencia nova. O VIO tem so express e socket.io, ` +
        'de proposito — o rate limiter, por exemplo, e feito a mao. Peca aprovacao antes. Regra [HOOK] do CLAUDE.md.'
      );
    }
  }

  if (/\bgit\s+commit\b/.test(comando)) {
    let staged = [];
    let entrando = [];
    try {
      staged = git('diff --cached --name-only').split('\n').filter(Boolean);
      // ACMR exclui remocoes: apagar um arquivo proibido e justamente o que se quer poder fazer.
      entrando = git('diff --cached --name-only --diff-filter=ACMR').split('\n').filter(Boolean);
    } catch {
      avisar('guard.js: nao consegui inspecionar o commit (git indisponivel). Commit liberado sem checagem.');
    }
    for (const arquivo of entrando) checarProibido(arquivo, 'Arquivo barrado no commit');
    verificarVersao(staged);
  }
}

let entrada = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', (d) => { entrada += d; });
process.stdin.on('end', () => {
  let evento;
  try {
    evento = JSON.parse(entrada);
  } catch {
    process.exit(0); // entrada ilegivel: nao e motivo pra travar o trabalho
  }

  const ferramenta = evento.tool_name;
  const dados = evento.tool_input || {};

  // bloquear() e avisar() encerram o processo na hora; o catch aqui existe so
  // pra falha inesperada do proprio guardiao, que nao deve travar o trabalho.
  try {
    if (ferramenta === 'Bash' && dados.command) {
      verificarBash(String(dados.command));
    } else if ((ferramenta === 'Write' || ferramenta === 'Edit') && dados.file_path) {
      checarProibido(dados.file_path, 'Arquivo barrado');
    }
  } catch { /* falha do guardiao: libera */ }

  process.exit(0);
});

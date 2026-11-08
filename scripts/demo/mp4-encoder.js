// Monta um MP4 PADRÃO (H.264, 30 fps constantes, sem áudio, índice no início = "faststart") a partir dos quadros capturados,
// compondo em cada quadro o título (em cima), a gravação do app (no meio) e a marca (embaixo), no estilo dos reels do
// NFS-e Download. Usa WebCodecs + mp4-muxer: o arquivo sai como o ffmpeg faria (um só bloco de dados, com duração), e não
// no formato "fragmentado" do MediaRecorder, que o Instagram e muitos celulares tratam como arquivo quebrado.
// Gerado com: esbuild scripts/demo/mp4-encoder.js --bundle --format=iife --outfile=scripts/demo/.build/mp4-encoder.js
import { ArrayBufferTarget, Muxer } from 'mp4-muxer';

const esperar = (ms) => new Promise((r) => setTimeout(r, ms));
const FONTE = '"Segoe UI Variable", "Segoe UI", system-ui, sans-serif';

function carregar(u) {
  return new Promise((res, rej) => { const im = new Image(); im.onload = () => res(im); im.onerror = () => rej(new Error('quadro ' + u)); im.src = u; });
}

// quebra o texto em linhas que cabem em `largura`
function linhas(g, texto, largura) {
  const palavras = texto.split(' ');
  const out = [];
  let atual = '';
  for (const p of palavras) {
    const teste = atual ? atual + ' ' + p : p;
    if (g.measureText(teste).width > largura && atual) { out.push(atual); atual = p; } else atual = teste;
  }
  if (atual) out.push(atual);
  return out;
}

function fundo(g, w, h) {
  g.fillStyle = '#050a14';
  g.fillRect(0, 0, w, h);
}

function cabecalho(g, cfg, cena) {
  g.textAlign = 'center';
  g.textBaseline = 'alphabetic';
  g.fillStyle = '#22b8e8';
  g.font = `800 40px ${FONTE}`;
  if (g.letterSpacing !== undefined) g.letterSpacing = '2px';
  g.fillText(cena.rotulo.toUpperCase(), cfg.w / 2, 92);
  if (g.letterSpacing !== undefined) g.letterSpacing = '0px';
  g.fillStyle = '#ffffff';
  g.font = `800 72px ${FONTE}`;
  const ls = linhas(g, cena.titulo, cfg.w - 120);
  ls.slice(0, 2).forEach((l, i) => g.fillText(l, cfg.w / 2, 180 + i * 86));
}

function rodape(g, cfg) {
  const y0 = cfg.topo + cfg.alturaApp;
  g.fillStyle = '#050a14';
  g.fillRect(0, y0, cfg.w, cfg.h - y0);
  g.textAlign = 'center';
  g.fillStyle = '#ffffff';
  g.font = `800 66px ${FONTE}`;
  g.fillText(cfg.marca, cfg.w / 2, y0 + 120);
  g.fillStyle = '#8fa3c7';
  g.font = `500 38px ${FONTE}`;
  g.fillText(cfg.tagline, cfg.w / 2, y0 + 190);
}

function telaFinal(g, cfg, icone) {
  const { w, h, fim } = cfg;
  fundo(g, w, h);
  const grad = g.createRadialGradient(w / 2, h / 2, 50, w / 2, h / 2, 900);
  grad.addColorStop(0, 'rgba(30,90,200,.55)');
  grad.addColorStop(1, 'rgba(5,10,20,0)');
  g.fillStyle = grad;
  g.fillRect(0, 300, w, 1330);
  g.textAlign = 'center';
  g.fillStyle = '#22b8e8';
  g.font = `800 40px ${FONTE}`;
  if (g.letterSpacing !== undefined) g.letterSpacing = '2px';
  g.fillText(fim.rotulo.toUpperCase(), w / 2, 92);
  if (g.letterSpacing !== undefined) g.letterSpacing = '0px';
  g.fillStyle = '#fff';
  g.font = `800 72px ${FONTE}`;
  g.fillText(fim.titulo, w / 2, 180);
  if (icone) g.drawImage(icone, w / 2 - 110, 560, 220, 220);
  g.font = `800 78px ${FONTE}`;
  g.fillText(fim.subtitulo, w / 2, 900);
  fim.passos.forEach((p, i) => {
    const y = 1010 + i * 150;
    g.fillStyle = '#18b9ee';
    g.beginPath(); g.arc(150, y, 48, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#04101c';
    g.font = `800 52px ${FONTE}`;
    g.fillText(String(i + 1), 150, y + 19);
    g.textAlign = 'left';
    g.fillStyle = '#fff';
    g.font = `700 54px ${FONTE}`;
    g.fillText(p.t, 235, y - 6);
    g.fillStyle = '#8fa3c7';
    g.font = `500 36px ${FONTE}`;
    g.fillText(p.sub, 235, y + 44);
    g.textAlign = 'center';
  });
  rodape(g, { ...cfg, topo: 300, alturaApp: 1330 });
}

window.codificarMp4 = async (cfg) => {
  if (!('VideoEncoder' in window)) throw new Error('VideoEncoder indisponível');
  const codec = 'avc1.64002A'; // H.264 High, nível 4.2 (cabe 1080x1920 a 30 fps)
  const suporte = await VideoEncoder.isConfigSupported({ codec, width: cfg.w, height: cfg.h, bitrate: cfg.bitrate, framerate: cfg.fps });
  if (!suporte.supported) throw new Error('H.264 não suportado neste Electron');

  const canvas = document.createElement('canvas');
  canvas.width = cfg.w; canvas.height = cfg.h;
  const g = canvas.getContext('2d');
  const icone = cfg.icone ? await carregar(cfg.icone).catch(() => null) : null;

  const muxer = new Muxer({ target: new ArrayBufferTarget(), video: { codec: 'avc', width: cfg.w, height: cfg.h, frameRate: cfg.fps }, fastStart: 'in-memory' });
  let erro = null;
  const enc = new VideoEncoder({ output: (chunk, meta) => muxer.addVideoChunk(chunk, meta), error: (e) => { erro = e; } });
  enc.configure({ codec, width: cfg.w, height: cfg.h, bitrate: cfg.bitrate, framerate: cfg.fps, latencyMode: 'quality' });

  const fim = cfg.cenas[cfg.cenas.length - 1].t1;
  const total = Math.ceil((fim / 1000) * cfg.fps);
  let k = 0;
  let imAtual = await carregar(cfg.quadros[0].u);
  let idxAtual = 0;
  for (let i = 0; i < total; i++) {
    if (erro) throw erro;
    const t = (i * 1000) / cfg.fps;
    while (k + 1 < cfg.quadros.length && cfg.quadros[k + 1].t <= t) k++;
    if (k !== idxAtual) { imAtual = await carregar(cfg.quadros[k].u); idxAtual = k; }
    const cena = cfg.cenas.find((c) => t >= c.t0 && t < c.t1) || cfg.cenas[cfg.cenas.length - 1];
    if (cena.tipo === 'fim') {
      telaFinal(g, cfg, icone);
    } else {
      fundo(g, cfg.w, cfg.h);
      cabecalho(g, cfg, cena);
      g.drawImage(imAtual, 0, cfg.topo, cfg.w, cfg.alturaApp);
      rodape(g, cfg);
    }
    const vf = new VideoFrame(canvas, { timestamp: Math.round((i * 1e6) / cfg.fps), duration: Math.round(1e6 / cfg.fps) });
    enc.encode(vf, { keyFrame: i % (cfg.fps * 2) === 0 });
    vf.close();
    while (enc.encodeQueueSize > 12) await esperar(2);
  }
  await enc.flush();
  muxer.finalize();
  window.__mp4 = new Uint8Array(muxer.target.buffer);
  return { bytes: window.__mp4.byteLength, quadros: total };
};

window.pegarParteMp4 = (inicio, tamanho) => {
  const fatia = window.__mp4.subarray(inicio, inicio + tamanho);
  let s = '';
  for (let i = 0; i < fatia.length; i += 0x8000) s += String.fromCharCode.apply(null, fatia.subarray(i, i + 0x8000));
  return btoa(s);
};

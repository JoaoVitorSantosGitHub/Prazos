// Injetado na página do app durante a gravação: cursor animado, legenda, destaque, digitação, narração e gravação da janela.
(() => {
  if (window.demo) return;
  const esperar = (ms) => new Promise((r) => setTimeout(r, ms));

  const estilo = document.createElement('style');
  estilo.textContent = `
    #demo-cursor { position: fixed; left: 0; top: 0; z-index: 2147483000; width: 26px; height: 26px; pointer-events: none;
      transition: transform 650ms cubic-bezier(.4,.1,.2,1); filter: drop-shadow(0 2px 3px rgba(0,0,0,.55)); }
    #demo-cursor .onda { position: absolute; left: -9px; top: -9px; width: 20px; height: 20px; border-radius: 50%; border: 3px solid #fff; opacity: 0; }
    #demo-cursor.clique .onda { animation: demo-onda 450ms ease-out; }
    @keyframes demo-onda { from { opacity: .95; transform: scale(.4); } to { opacity: 0; transform: scale(2.4); } }
    #demo-legenda { position: fixed; left: 50%; bottom: 22px; transform: translateX(-50%); z-index: 2147482000; max-width: 980px; width: calc(100% - 120px);
      background: rgba(5, 8, 14, .86); color: #fff; padding: 12px 20px; border-radius: 14px; font: 600 16px/1.4 "Segoe UI Variable","Segoe UI",sans-serif;
      text-align: center; pointer-events: none; opacity: 0; transition: opacity 250ms; box-shadow: 0 8px 28px rgba(0,0,0,.45); }
    #demo-legenda.on { opacity: 1; }
    .demo-anel { position: fixed; z-index: 2147481000; pointer-events: none; border: 3px solid #ffd23f; border-radius: 12px; box-shadow: 0 0 0 4px rgba(255,210,63,.25);
      transition: opacity 300ms; }
  `;
  document.head.appendChild(estilo);

  const cursor = document.createElement('div');
  cursor.id = 'demo-cursor';
  cursor.innerHTML = '<div class="onda"></div><svg viewBox="0 0 24 24" width="26" height="26"><path d="M3 2l7.5 19 2.7-7.7L21 10.6z" fill="#fff" stroke="#111" stroke-width="1.4" stroke-linejoin="round"/></svg>';
  cursor.style.transform = 'translate(160px, 120px)';
  document.body.appendChild(cursor);

  const leg = document.createElement('div');
  leg.id = 'demo-legenda';
  document.body.appendChild(leg);

  const semAcento = (s) => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  function acha(spec, escopo) {
    const todos = escopo ? [...document.querySelectorAll(escopo)] : [];
    const raiz = todos.length ? todos[todos.length - 1] : document;
    if (typeof spec !== 'string') return spec;
    if (/^[#.\[]|^(input|button|nav|textarea|summary|details|canvas|main)\b/.test(spec)) return raiz.querySelector(spec);
    const alvo = semAcento(spec.trim());
    const candidatos = [...raiz.querySelectorAll('button, [role="tab"], label, summary, [role="option"], [role="combobox"], h1, h2, h3')].filter((e) => e.offsetParent !== null || e.getClientRects().length);
    const texto = (e) => semAcento(e.textContent.replace(/\s+/g, ' ').trim());
    return candidatos.find((e) => texto(e) === alvo) || candidatos.find((e) => texto(e).includes(alvo)) || null;
  }
  async function aguardar(spec, escopo, ms = 8000) {
    const fim = Date.now() + ms;
    while (Date.now() < fim) { const e = acha(spec, escopo); if (e) return e; await esperar(120); }
    throw new Error('Elemento não encontrado: ' + spec);
  }
  async function mover(el, deslocX = 0) {
    el.scrollIntoView({ block: 'center', behavior: 'smooth' });
    await esperar(450);
    const r = el.getBoundingClientRect();
    cursor.style.transform = `translate(${Math.round(r.left + Math.min(r.width / 2, 120) + deslocX)}px, ${Math.round(r.top + r.height / 2)}px)`;
    await esperar(720);
  }
  async function clicar(spec, escopo) {
    const el = await aguardar(spec, escopo);
    await mover(el);
    cursor.classList.remove('clique'); void cursor.offsetWidth; cursor.classList.add('clique');
    await esperar(160);
    el.click();
    await esperar(350);
    return el;
  }
  async function digitar(spec, texto, ms = 75) {
    const el = await aguardar(spec);
    await mover(el);
    el.focus();
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
    setter.call(el, '');
    el.dispatchEvent(new Event('input', { bubbles: true }));
    for (let i = 1; i <= texto.length; i++) {
      setter.call(el, texto.slice(0, i));
      el.dispatchEvent(new Event('input', { bubbles: true }));
      await esperar(ms);
    }
  }
  async function destacar(spec, ms = 2200, escopo) {
    const el = await aguardar(spec, escopo);
    el.scrollIntoView({ block: 'center', behavior: 'smooth' });
    await esperar(500);
    const r = el.getBoundingClientRect();
    const anel = document.createElement('div');
    anel.className = 'demo-anel';
    Object.assign(anel.style, { left: r.left - 6 + 'px', top: r.top - 6 + 'px', width: r.width + 12 + 'px', height: r.height + 12 + 'px' });
    document.body.appendChild(anel);
    cursor.style.transform = `translate(${Math.round(r.right - 24)}px, ${Math.round(r.bottom - 8)}px)`;
    await esperar(ms);
    anel.style.opacity = '0';
    await esperar(300);
    anel.remove();
  }
  function legenda(texto) {
    if (!texto) { leg.classList.remove('on'); return; }
    leg.textContent = texto;
    leg.classList.add('on');
  }
  async function rolar(seletor, topo, ms = 900) {
    const el = document.querySelector(seletor);
    el.scrollTo({ top: topo, behavior: 'smooth' });
    await esperar(ms);
  }

  // ---- narração e gravação ----
  let ctx, destino, buffers = [];
  async function carregarAudios(listaB64) {
    ctx = new AudioContext();
    destino = ctx.createMediaStreamDestination();
    buffers = [];
    for (const b64 of listaB64) {
      const bin = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
      buffers.push(await ctx.decodeAudioData(bin.buffer));
    }
    return buffers.map((b) => b.duration);
  }
  function falar(i) {
    return new Promise((resolve) => {
      const fonte = ctx.createBufferSource();
      fonte.buffer = buffers[i];
      fonte.connect(destino);
      fonte.onended = () => resolve();
      fonte.start();
    });
  }

  let gravador, partes = [], mimeFinal = '';
  async function iniciarGravacao() {
    const video = await navigator.mediaDevices.getDisplayMedia({ video: { frameRate: 30 }, audio: false });
    const fluxo = new MediaStream([...video.getVideoTracks(), ...destino.stream.getAudioTracks()]);
    const tipos = ['video/mp4;codecs=avc1.640028,mp4a.40.2', 'video/mp4;codecs=avc1.42E01E,mp4a.40.2', 'video/mp4', 'video/webm;codecs=vp9,opus', 'video/webm'];
    mimeFinal = tipos.find((t) => MediaRecorder.isTypeSupported(t)) || '';
    partes = [];
    gravador = new MediaRecorder(fluxo, { mimeType: mimeFinal, videoBitsPerSecond: 3_000_000, audioBitsPerSecond: 128_000 });
    gravador.ondataavailable = (e) => { if (e.data.size) partes.push(e.data); };
    gravador.start(1000);
    return mimeFinal;
  }
  function pararGravacao() {
    return new Promise((resolve) => {
      gravador.onstop = () => resolve({ mime: mimeFinal, n: partes.length });
      gravador.stop();
    });
  }
  function pegarParte(i) {
    return new Promise((resolve) => {
      const leitor = new FileReader();
      leitor.onload = () => resolve(String(leitor.result).split(',')[1]);
      leitor.readAsDataURL(partes[i]);
    });
  }

  function ocultar(v) { leg.style.visibility = v ? 'hidden' : ''; cursor.style.visibility = v ? 'hidden' : ''; }

  // ---- trechos das gravações de tela do Gestta (Express e Tarefa), com blur nos dados sensíveis ----
  // O vídeo é desenhado num canvas e as regiões sensíveis são borradas ali (quadro de referência 1280x960), então o
  // que sai na gravação já está borrado; nada sensível chega a ser capturado.
  let fundoClipe, telaClipe, videoClipe, timerClipe;
  function preparaClipe() {
    if (fundoClipe) return;
    const st = document.createElement('style');
    st.textContent = `#demo-clipe { position: fixed; inset: 0; z-index: 2147480000; display: none; justify-content: center; align-items: flex-start; background: #05080e; }
      #demo-clipe canvas { height: 724px; aspect-ratio: 4 / 3; margin-top: 12px; border-radius: 8px; box-shadow: 0 6px 30px rgba(0,0,0,.6); }`;
    document.head.appendChild(st);
    fundoClipe = document.createElement('div');
    fundoClipe.id = 'demo-clipe';
    telaClipe = document.createElement('canvas');
    telaClipe.width = 1280; telaClipe.height = 960;
    fundoClipe.appendChild(telaClipe);
    document.body.appendChild(fundoClipe);
    videoClipe = document.createElement('video');
    videoClipe.muted = true;
    videoClipe.preload = 'auto';
  }
  async function clipe({ src, de, ate, duracao, regioes }) {
    preparaClipe();
    clearInterval(timerClipe);
    if (videoClipe.getAttribute('data-src') !== src) {
      videoClipe.setAttribute('data-src', src);
      videoClipe.src = src;
      await new Promise((ok, falha) => { videoClipe.onloadedmetadata = ok; videoClipe.onerror = () => falha(new Error('video')); });
    }
    await new Promise((ok) => { videoClipe.onseeked = ok; videoClipe.currentTime = de; });
    const g = telaClipe.getContext('2d');
    const desenhar = () => {
      const t = videoClipe.currentTime;
      g.filter = 'none';
      g.drawImage(videoClipe, 0, 0, 1280, 960);
      for (const r of regioes) {
        if (t < r.de || t >= r.ate) continue;
        const m = 40; // margem: o blur de uma região recortada sem ela sangra pelas bordas
        const x0 = Math.max(0, r.x - m), y0 = Math.max(0, r.y - m), x1 = Math.min(1280, r.x + r.w + m), y1 = Math.min(960, r.y + r.h + m);
        g.save();
        g.beginPath(); g.rect(r.x, r.y, r.w, r.h); g.clip();
        g.filter = 'blur(26px)';
        // o recorte de origem de um <video> é em pixels do próprio vídeo (menor que o quadro de referência 1280x960)
        const k = videoClipe.videoWidth / 1280;
        g.drawImage(videoClipe, x0 * k, y0 * k, (x1 - x0) * k, (y1 - y0) * k, x0, y0, x1 - x0, y1 - y0);
        g.filter = 'none';
        g.fillStyle = 'rgba(30,40,60,.42)'; g.fillRect(r.x, r.y, r.w, r.h);
        g.restore();
      }
    };
    desenhar();
    cursor.style.display = 'none';
    fundoClipe.style.display = 'flex';
    // reproduz o trecho na velocidade que casa com a fala (entre 0,7x e 2,5x); no fim, segura o último quadro
    videoClipe.playbackRate = Math.min(2.5, Math.max(0.7, (ate - de) / duracao));
    videoClipe.play();
    timerClipe = setInterval(() => {
      if (videoClipe.currentTime >= ate - 0.05 && !videoClipe.paused) { videoClipe.pause(); videoClipe.currentTime = ate - 0.05; } // segura o último quadro do trecho
      desenhar();
    }, 40);
  }
  function fecharClipe() {
    clearInterval(timerClipe);
    if (videoClipe) videoClipe.pause();
    if (fundoClipe) fundoClipe.style.display = 'none';
    cursor.style.display = '';
  }

  window.demo = { clipe, fecharClipe, ocultar, esperar, acha, aguardar, clicar, digitar, destacar, legenda, rolar, mover, carregarAudios, falar, iniciarGravacao, pararGravacao, pegarParte };
})();

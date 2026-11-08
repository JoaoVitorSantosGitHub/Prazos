// Regiões de blur das gravações de tela do Express e da Tarefa do Gestta (dados sensíveis do escritório: e-mail, código de
// acesso, nomes de clientes, favoritos, endereço do navegador, área de trabalho...). Coordenadas num quadro de 1280x960
// (o vídeo original é 1048x786, a mesma proporção). `de`/`ate` = intervalo do vídeo, em segundos. Os instantes foram
// medidos de segundo em segundo nas gravações originais, então TODA janela tem ~1 s de folga para cada lado: é melhor
// borrar um pouco a mais do que deixar um quadro escapar. Usado pelo vídeo (demo-page.js) e pelas capturas do manual
// (gerar-capturas-gestta.js).
const R = (de, ate, x, y, w, h) => ({ de, ate, x, y, w, h });

// tudo fora de uma janela fica borrado: [x,y,w,h] da janela
function foraDe(de, ate, [jx, jy, jw, jh], topo = 0, base = 915) {
  return [
    R(de, ate, 0, topo, jx, base - topo),
    R(de, ate, jx + jw, topo, 1280 - jx - jw, base - topo),
    R(de, ate, jx, topo, jw, jy - topo),
    R(de, ate, jx, jy + jh, jw, base - jy - jh),
  ];
}

// área de trabalho inteira borrada, menos o ícone (buraco)
function areaDeTrabalho(de, ate, [bx, by, bw, bh]) {
  return [
    R(de, ate, 0, 0, 1280, by),
    R(de, ate, 0, by + bh, 1280, 915 - by - bh),
    R(de, ate, 0, by, bx, bh),
    R(de, ate, bx + bw, by, 1280 - bx - bw, bh),
  ];
}

// barra de favoritos, endereço (a partir do domínio) e perfil do navegador
const navegador = (de, ate) => [R(de, ate, 0, 78, 1280, 28), R(de, ate, 400, 44, 690, 30), R(de, ate, 1090, 42, 190, 34)];

const JANELA_EXPRESS = [277, 185, 726, 545];

const express = [
  ...navegador(0, 29.2), ...navegador(45.6, 56.2),
  R(12.3, 22.8, 80, 195, 270, 62),            // "Olá, <nome do escritório>"
  R(17.3, 23.4, 60, 725, 265, 32),            // menu do avatar com o nome do escritório
  // filtro com o nome do escritório e lista de tarefas (nomes de clientes); de 49 a 53 a janela do Express cobre a página
  R(21.8, 29.4, 630, 118, 260, 28), R(45.6, 47.9, 630, 118, 260, 28), R(53.0, 56.2, 630, 118, 260, 28),
  R(21.8, 29.4, 75, 215, 275, 700), R(45.6, 47.9, 75, 215, 275, 700), R(53.0, 56.2, 75, 215, 275, 700),
  // código de acesso (aparece de 25 a 29; de novo em 47 e, atrás do Express, a partir de 53,3)
  R(24.6, 29.4, 540, 405, 220, 45), R(45.6, 47.9, 540, 405, 220, 45), R(53.0, 55.6, 540, 405, 220, 45),
  ...areaDeTrabalho(28.3, 31.2, [835, 452, 90, 100]),
  ...foraDe(30.8, 46.4, JANELA_EXPRESS),
  R(32.6, 46.8, 495, 352, 290, 106),          // e-mail e senha/código no Express
  ...foraDe(47.9, 53.5, JANELA_EXPRESS, 100),
  R(47.9, 52.4, 495, 352, 290, 106),
  ...areaDeTrabalho(55.3, 59.9, [835, 552, 90, 80]),
  R(58.4, 67.5, 0, 118, 215, 790),            // barra lateral do Explorer (nomes de pastas)
];

const tarefa = [
  ...navegador(0, 56.4), ...navegador(58.6, 71),
  R(12.2, 17.0, 80, 195, 270, 62), R(19.6, 20.8, 80, 195, 270, 62),     // "Olá, <nome do escritório>"
  R(38.0, 41.3, 85, 520, 1160, 395),          // listas de clientes e CNPJ
];

module.exports = { express, tarefa };

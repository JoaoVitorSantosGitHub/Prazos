// Os 5 temas do visual JVS. As cores aqui servem só pra pintar a miniatura da tela Temas (valores iguais aos de globals.css).
export interface Tema {
  id: 'neon' | 'grafite' | 'claro' | 'oceano' | 'rosa';
  nome: string;
  frase: string;
  cores: { bg: string; side: string; card: string; line: string; txt: string; mut: string; acc: string; ok: string; bad: string; warn: string };
}

export const TEMAS: Tema[] = [
  { id: 'neon', nome: 'Neon', frase: 'Escuro com destaque ciano e verde/vermelho neon. O padrão.', cores: { bg: '#080b10', side: '#0b1017', card: '#0e141d', line: '#1c2735', txt: '#e6eef8', mut: '#8497ae', acc: '#22d3ee', ok: '#39ff14', bad: '#ff073a', warn: '#ffd23f' } },
  { id: 'grafite', nome: 'Grafite', frase: 'Escuro sóbrio, sem brilho, destaque azul-claro.', cores: { bg: '#15171c', side: '#1a1d23', card: '#20242c', line: '#323844', txt: '#e8eaee', mut: '#9aa3b2', acc: '#7aa2ff', ok: '#34d399', bad: '#f87171', warn: '#fbbf24' } },
  { id: 'claro', nome: 'Claro', frase: 'Fundo branco com destaque azul institucional.', cores: { bg: '#f3f5f9', side: '#ffffff', card: '#ffffff', line: '#e1e6ee', txt: '#1c2430', mut: '#667489', acc: '#1351b4', ok: '#12a150', bad: '#d92d20', warn: '#b7791f' } },
  { id: 'oceano', nome: 'Oceano', frase: 'Azul-petróleo com destaque turquesa.', cores: { bg: '#0a1c2b', side: '#0d2437', card: '#10304a', line: '#1d4668', txt: '#e8f3fb', mut: '#8fb0c8', acc: '#4fd1c5', ok: '#5eead4', bad: '#ff7a90', warn: '#ffd36e' } },
  { id: 'rosa', nome: 'Rosa', frase: 'Claro com destaque rosa-pink.', cores: { bg: '#fff3f8', side: '#ffffff', card: '#ffffff', line: '#f7cfe1', txt: '#3d1228', mut: '#8c5a73', acc: '#e11d74', ok: '#12853f', bad: '#c81e3a', warn: '#b7791f' } },
];
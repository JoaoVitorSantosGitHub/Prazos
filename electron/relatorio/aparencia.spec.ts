import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { APARENCIA_PADRAO, AparenciaStore, ErroAparencia, misturar, validarAparencia } from './aparencia';

const PNG_MINIMO = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';

describe('validarAparencia', () => {
  it('sem nada, devolve o padrão neutro (sem logo, sem marca d’água, sem contato)', () => {
    const ap = validarAparencia(undefined);
    expect(ap).toEqual(APARENCIA_PADRAO);
    expect(ap.logo.imagem).toBeNull();
    expect(ap.marcaDagua.imagem).toBeNull();
    expect(ap.contatoAjuda).toBe('');
  });
  it('completa o que faltar e limita números fora da faixa', () => {
    const ap = validarAparencia({ logo: { largura: 9999 }, marcaDagua: { opacidade: 0, tamanho: 500 }, cores: { titulo: '#abcdef' } });
    expect(ap.logo.largura).toBe(300);
    expect(ap.marcaDagua.opacidade).toBe(0.02);
    expect(ap.marcaDagua.tamanho).toBe(100);
    expect(ap.cores.titulo).toBe('#ABCDEF');
    expect(ap.cores.critico).toBe(APARENCIA_PADRAO.cores.critico);
  });
  it('aceita PNG/JPEG em data URL e recusa o resto', () => {
    expect(validarAparencia({ logo: { imagem: PNG_MINIMO } }).logo.imagem).toBe(PNG_MINIMO);
    expect(() => validarAparencia({ logo: { imagem: 'data:image/svg+xml;base64,AAAA' } })).toThrow(ErroAparencia);
    expect(() => validarAparencia({ logo: { imagem: 'C:\\arquivo.png' } })).toThrow(ErroAparencia);
    expect(() => validarAparencia({ rodape: { imagem: 'data:image/png;base64,' + 'A'.repeat(5 * 1024 * 1024) } })).toThrow(ErroAparencia);
  });
  it('cores do 2º período e dos aniversariantes: editáveis, com padrão se faltarem (aparência salva antes delas)', () => {
    expect(validarAparencia({ cores: { titulo: '#111111' } }).cores.aniversario).toBe('#EC4899');
    const ap = validarAparencia({ cores: { segundoPeriodo: '#aabbcc', aniversario: '#001122' } });
    expect(ap.cores.segundoPeriodo).toBe('#AABBCC');
    expect(ap.cores.aniversario).toBe('#001122');
    expect(() => validarAparencia({ cores: { aniversario: 'rosa' } })).toThrow(ErroAparencia);
  });
  it('recusa cor fora do formato #RRGGBB', () => {
    expect(() => validarAparencia({ cores: { destaque: 'azul' } })).toThrow(ErroAparencia);
    expect(() => validarAparencia({ cores: { destaque: '#12345' } })).toThrow(ErroAparencia);
  });
  it('rodapé: só "texto" ou "imagem"; o resto volta ao padrão; textos são cortados em 400 caracteres', () => {
    expect(validarAparencia({ rodape: { modo: 'qualquer' } }).rodape.modo).toBe(APARENCIA_PADRAO.rodape.modo);
    expect(validarAparencia({ rodape: { modo: 'imagem' } }).rodape.modo).toBe('imagem');
    expect(validarAparencia({ rodape: { modo: 'texto', textoEsquerda: 'x'.repeat(900) } }).rodape.textoEsquerda).toHaveLength(400);
  });
});

describe('misturar', () => {
  it('t = 0 e t = 1 devolvem as pontas; no meio, a média', () => {
    expect(misturar('#000000', '#FFFFFF', 0)).toBe('#000000');
    expect(misturar('#000000', '#FFFFFF', 1)).toBe('#FFFFFF');
    expect(misturar('#000000', '#FFFFFF', 0.5)).toBe('#808080');
    expect(misturar('#EF4444', '#FFFFFF', 0.94)).toBe('#FEF4F4');
  });
});

describe('AparenciaStore', () => {
  it('salva, lê de volta e restaura o padrão', () => {
    const pasta = fs.mkdtempSync(path.join(os.tmpdir(), 'prazos-'));
    const store = new AparenciaStore(path.join(pasta, 'aparencia.json'));
    expect(store.personalizada()).toBe(false);
    expect(store.obter()).toEqual(APARENCIA_PADRAO);
    store.salvar({ contatoAjuda: '(11) 90000-0000', logo: { imagem: PNG_MINIMO, largura: 120 } });
    expect(store.personalizada()).toBe(true);
    expect(store.obter().contatoAjuda).toBe('(11) 90000-0000');
    expect(store.obter().logo.largura).toBe(120);
    expect(store.restaurar()).toEqual(APARENCIA_PADRAO);
    expect(store.personalizada()).toBe(false);
    fs.rmSync(pasta, { recursive: true, force: true });
  });
  it('arquivo corrompido não derruba o app: volta ao padrão', () => {
    const pasta = fs.mkdtempSync(path.join(os.tmpdir(), 'prazos-'));
    const arq = path.join(pasta, 'aparencia.json');
    fs.writeFileSync(arq, '{ isto não é json');
    expect(new AparenciaStore(arq).obter()).toEqual(APARENCIA_PADRAO);
    fs.rmSync(pasta, { recursive: true, force: true });
  });
});

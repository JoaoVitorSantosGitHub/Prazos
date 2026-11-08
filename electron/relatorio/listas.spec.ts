import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { ListasEmpresas, LIMITE_LISTAS } from './listas';
import { ErroValidacao } from './modelos';

function novo() {
  const pasta = fs.mkdtempSync(path.join(os.tmpdir(), 'prazos-listas-'));
  return { pasta, listas: new ListasEmpresas(path.join(pasta, 'listas-empresas.json')) };
}

describe('ListasEmpresas', () => {
  it('começa vazio, cria, lê de volta e ordena por nome', () => {
    const { pasta, listas } = novo();
    expect(listas.listar()).toEqual([]);
    listas.salvar({ nome: 'Carteira da Ana', empresas: [30, 10, 20, 10] });
    listas.salvar({ nome: 'Abertura recente', empresas: [5] });
    const todas = listas.listar();
    expect(todas.map((l) => l.nome)).toEqual(['Abertura recente', 'Carteira da Ana']);
    expect(todas[1].empresas).toEqual([10, 20, 30]); // sem repetição e em ordem
    fs.rmSync(pasta, { recursive: true, force: true });
  });
  it('atualiza uma lista existente pelo id e mantém o id', () => {
    const { pasta, listas } = novo();
    const a = listas.salvar({ nome: 'Ana', empresas: [1, 2] });
    const b = listas.salvar({ id: a.id, nome: 'Ana (nova)', empresas: [1, 2, 3] });
    expect(b.id).toBe(a.id);
    expect(listas.listar()).toHaveLength(1);
    expect(listas.listar()[0]).toMatchObject({ nome: 'Ana (nova)', empresas: [1, 2, 3] });
    fs.rmSync(pasta, { recursive: true, force: true });
  });
  it('recusa nome repetido (sem diferenciar maiúsculas e espaços), nome vazio e lista vazia', () => {
    const { pasta, listas } = novo();
    listas.salvar({ nome: 'Carteira da Ana', empresas: [1] });
    expect(() => listas.salvar({ nome: '  carteira   da ana ', empresas: [2] })).toThrow(ErroValidacao);
    expect(() => listas.salvar({ nome: '   ', empresas: [2] })).toThrow(ErroValidacao);
    expect(() => listas.salvar({ nome: 'Vazia', empresas: [] })).toThrow(ErroValidacao);
    expect(() => listas.salvar({ nome: 'Ruim', empresas: [1, 'x' as any] })).toThrow(ErroValidacao);
    expect(() => listas.salvar({ nome: 'x'.repeat(61), empresas: [1] })).toThrow(ErroValidacao);
    fs.rmSync(pasta, { recursive: true, force: true });
  });
  it('renomear a própria lista com o mesmo nome é permitido', () => {
    const { pasta, listas } = novo();
    const a = listas.salvar({ nome: 'Ana', empresas: [1] });
    expect(() => listas.salvar({ id: a.id, nome: 'ana', empresas: [1, 2] })).not.toThrow();
    fs.rmSync(pasta, { recursive: true, force: true });
  });
  it('exclui; excluir o que não existe dá erro claro', () => {
    const { pasta, listas } = novo();
    const a = listas.salvar({ nome: 'Ana', empresas: [1] });
    listas.excluir(a.id);
    expect(listas.listar()).toEqual([]);
    expect(() => listas.excluir(a.id)).toThrow(ErroValidacao);
    expect(() => listas.excluir('nao-e-id')).toThrow(ErroValidacao);
    fs.rmSync(pasta, { recursive: true, force: true });
  });
  it('arquivo corrompido não derruba o app: volta a começar sem listas', () => {
    const { pasta } = novo();
    const arq = path.join(pasta, 'listas-empresas.json');
    fs.writeFileSync(arq, '{ nao é json');
    expect(new ListasEmpresas(arq).listar()).toEqual([]);
    fs.rmSync(pasta, { recursive: true, force: true });
  });
  it('limite de listas', () => {
    const { pasta, listas } = novo();
    for (let i = 0; i < LIMITE_LISTAS; i++) listas.salvar({ nome: `L${i}`, empresas: [i + 1] });
    expect(() => listas.salvar({ nome: 'a mais', empresas: [1] })).toThrow(ErroValidacao);
    fs.rmSync(pasta, { recursive: true, force: true });
  });
});

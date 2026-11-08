import { randomUUID } from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { ErroValidacao } from './modelos';

/**
 * Listas de empresas montadas pelo usuário (ex.: "Carteira da Ana", "Clientes do Simples"), pra escritórios que dividem
 * as empresas por pessoa. Guardam só os IDs (código no Domínio) e ficam num arquivo da pasta de dados do app, por usuário
 * do Windows. Os PDFs de uma lista saem na MESMA pasta de destino dos demais relatórios.
 */
export interface ListaEmpresas {
  id: string;
  nome: string;
  /** códigos das empresas no Domínio (codi_emp), sem repetição */
  empresas: number[];
  atualizadaEm: string;
}

export const LIMITE_LISTAS = 100;
export const LIMITE_EMPRESAS_POR_LISTA = 1000;
export const LIMITE_NOME_LISTA = 60;

const REGEX_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const norm = (s: string) => s.trim().replace(/\s+/g, ' ').toLocaleLowerCase('pt-BR');

export interface SalvarLista { id?: string; nome: unknown; empresas: unknown }

function validar(dto: SalvarLista): { nome: string; empresas: number[] } {
  const nome = typeof dto.nome === 'string' ? dto.nome.trim().replace(/\s+/g, ' ') : '';
  if (!nome) throw new ErroValidacao('Dê um nome para a lista.');
  if (nome.length > LIMITE_NOME_LISTA) throw new ErroValidacao(`O nome da lista pode ter até ${LIMITE_NOME_LISTA} caracteres.`);
  if (!Array.isArray(dto.empresas)) throw new ErroValidacao('Escolha as empresas da lista.');
  const empresas = [...new Set(dto.empresas.map(Number))];
  if (empresas.some((n) => !Number.isInteger(n) || n <= 0)) throw new ErroValidacao('A lista tem um código de empresa inválido.');
  if (empresas.length === 0) throw new ErroValidacao('Marque pelo menos uma empresa para a lista.');
  if (empresas.length > LIMITE_EMPRESAS_POR_LISTA) throw new ErroValidacao(`Uma lista pode ter até ${LIMITE_EMPRESAS_POR_LISTA} empresas.`);
  return { nome, empresas: empresas.sort((a, b) => a - b) };
}

export class ListasEmpresas {
  constructor(private arquivo: string) {}

  listar(): ListaEmpresas[] {
    try {
      const bruto = JSON.parse(fs.readFileSync(this.arquivo, 'utf8'));
      if (!Array.isArray(bruto)) return [];
      return bruto
        .filter((l) => l && typeof l.id === 'string' && typeof l.nome === 'string' && Array.isArray(l.empresas))
        .map((l) => ({ id: l.id, nome: l.nome, empresas: l.empresas.map(Number).filter((n: number) => Number.isInteger(n)), atualizadaEm: String(l.atualizadaEm ?? '') }))
        .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
    } catch {
      return []; // sem arquivo, ou arquivo corrompido: começa sem listas, sem derrubar o app
    }
  }

  /** Cria (sem `id`) ou atualiza (com `id`). O nome é único, sem diferenciar maiúsculas. */
  salvar(dto: SalvarLista): ListaEmpresas {
    const { nome, empresas } = validar(dto);
    const todas = this.listar();
    if (dto.id !== undefined && !REGEX_UUID.test(String(dto.id))) throw new ErroValidacao('Lista inválida.');
    if (todas.some((l) => l.id !== dto.id && norm(l.nome) === norm(nome))) throw new ErroValidacao(`Já existe uma lista chamada “${nome}”.`);
    const agora = new Date().toISOString();
    let lista: ListaEmpresas;
    if (dto.id) {
      const atual = todas.find((l) => l.id === dto.id);
      if (!atual) throw new ErroValidacao('Essa lista não existe mais.');
      lista = { ...atual, nome, empresas, atualizadaEm: agora };
      todas[todas.indexOf(atual)] = lista;
    } else {
      if (todas.length >= LIMITE_LISTAS) throw new ErroValidacao(`O limite é de ${LIMITE_LISTAS} listas. Exclua alguma antes de criar outra.`);
      lista = { id: randomUUID(), nome, empresas, atualizadaEm: agora };
      todas.push(lista);
    }
    this.gravar(todas);
    return lista;
  }

  excluir(id: string): void {
    if (!REGEX_UUID.test(String(id))) throw new ErroValidacao('Lista inválida.');
    const todas = this.listar();
    if (!todas.some((l) => l.id === id)) throw new ErroValidacao('Essa lista não existe mais.');
    this.gravar(todas.filter((l) => l.id !== id));
  }

  private gravar(listas: ListaEmpresas[]) {
    fs.mkdirSync(path.dirname(this.arquivo), { recursive: true });
    fs.writeFileSync(this.arquivo, JSON.stringify(listas), 'utf8');
  }
}

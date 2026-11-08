import { randomUUID } from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { VARIAVEIS_RELATORIO, validarCorpoTemplate } from './template.util';

export interface ModeloRelatorio {
  id: string;
  nome: string;
  corpo: string;
  padrao: boolean;
  ativo: boolean;
}

export interface SalvarModelo {
  nome: string;
  corpo: string;
  padrao?: boolean;
  ativo?: boolean;
}

/** Erro de validação que a tela mostra como está (mensagem em português). */
export class ErroValidacao extends Error {}

/**
 * Modelos do texto do relatório (mesma regra do app Folha: um só "padrão", nome único), guardados num arquivo JSON na
 * pasta de dados do usuário -- o app não tem banco de dados.
 */
export class ModelosRelatorio {
  constructor(private arquivo: string) {}

  private ler(): ModeloRelatorio[] {
    try {
      const lista = JSON.parse(fs.readFileSync(this.arquivo, 'utf8'));
      return Array.isArray(lista) ? lista : [];
    } catch {
      return [];
    }
  }

  private gravar(lista: ModeloRelatorio[]) {
    fs.mkdirSync(path.dirname(this.arquivo), { recursive: true });
    fs.writeFileSync(this.arquivo, JSON.stringify(lista, null, 2), 'utf8');
  }

  listar(): ModeloRelatorio[] {
    return this.ler().sort((a, b) => Number(b.padrao) - Number(a.padrao) || a.nome.localeCompare(b.nome, 'pt-BR'));
  }

  buscar(id: string): ModeloRelatorio | null {
    return this.ler().find((m) => m.id === id) ?? null;
  }

  /** O modelo marcado como padrão (e ativo), se houver. */
  padrao(): ModeloRelatorio | null {
    return this.ler().find((m) => m.padrao && m.ativo) ?? null;
  }

  criar(dto: SalvarModelo): ModeloRelatorio {
    const lista = this.ler();
    const nome = this.validar(dto, lista);
    if (dto.padrao) lista.forEach((m) => { m.padrao = false; });
    const novo: ModeloRelatorio = { id: randomUUID(), nome, corpo: dto.corpo, padrao: !!dto.padrao, ativo: dto.ativo ?? true };
    lista.push(novo);
    this.gravar(lista);
    return novo;
  }

  atualizar(id: string, dto: SalvarModelo): ModeloRelatorio {
    const lista = this.ler();
    const atual = lista.find((m) => m.id === id);
    if (!atual) throw new ErroValidacao('Modelo não encontrado');
    const nome = this.validar(dto, lista, id);
    if (dto.padrao) lista.forEach((m) => { if (m.id !== id) m.padrao = false; });
    Object.assign(atual, { nome, corpo: dto.corpo, padrao: !!dto.padrao, ativo: dto.ativo ?? true });
    this.gravar(lista);
    return atual;
  }

  excluir(id: string): void {
    const lista = this.ler();
    if (!lista.some((m) => m.id === id)) throw new ErroValidacao('Modelo não encontrado');
    this.gravar(lista.filter((m) => m.id !== id));
  }

  private validar(dto: SalvarModelo, lista: ModeloRelatorio[], ignorarId?: string): string {
    const nome = (dto.nome ?? '').trim();
    if (!nome) throw new ErroValidacao('Informe o nome do modelo.');
    if (nome.length > 80) throw new ErroValidacao('O nome passa de 80 caracteres.');
    const erro = validarCorpoTemplate(dto.corpo ?? '', VARIAVEIS_RELATORIO);
    if (erro) throw new ErroValidacao(erro);
    if (lista.some((m) => m.nome === nome && m.id !== ignorarId)) throw new ErroValidacao('Já existe um modelo com esse nome.');
    return nome;
  }
}

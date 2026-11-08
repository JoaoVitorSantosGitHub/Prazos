import * as React from 'react';
import { Building2, Download, ExternalLink, Eye, FileText, FolderOpen, Layers, Palette } from 'lucide-react';
import { AparenciaPanel } from '@/pages/aparencia';
import { PreviaPdfDialog } from '@/components/app-shell/previa-pdf-dialog';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { EmpresaCombobox, buscarEmpresas, formatarCnpj, useEmpresasDominio, type EmpresaDominio } from '@/components/app-shell/empresa-combobox';
import { partesFormatadas, renderizarModelo } from '@/lib/formatacao-whatsapp';
import { cn } from '@/lib/utils';
import { processarEmFila } from '@/lib/fila-paralela';
import { chamar, type PastaDestino } from '@/lib/api';

const LIMITE_LOTE = 1000;
const PDFS_SIMULTANEOS = 4;
const LIMITE_LISTA_LOTE = 100;

interface Previa {
  codiEmp: number;
  empresa: string;
  cnpj: string | null;
  emissao: string;
  geradoEm: string;
  /** Texto do modelo; null = sem modelo (o PDF segue só o layout padrão). */
  mensagem: string | null;
  totais: { rotulo: string; valor: number; urgente?: boolean }[];
  criticos: { nome: string; diasPendentes: string; periodoEncerrado: string; prazoLimite: string; faltam: number; segundoPeriodo: string | null }[];
  regulares: { nome: string; periodoEncerrado: string; prazoLimite: string; diasPendentes: string }[];
  contratos: { nome: string; descricao: string; acao: string }[];
  contatoAjuda: string | null;
  afastados: { nome: string; motivo: string; inicio: string; retorno: string }[];
  segundoPeriodo: { nome: string; vencimento: string; limite: string }[];
  aniversariantes: { nome: string; data: string; idade: number; hoje: boolean; jaPassou: boolean }[];
}
interface ListaEmpresas { id: string; nome: string; empresas: number[]; atualizadaEm: string }
interface ModeloAPI { id: string; nome: string; corpo: string; padrao: boolean; ativo: boolean }
interface ModelosAPI { modelos: ModeloAPI[]; variaveis: string[]; limiteCaracteres: number; textoPadraoEmbutido: string }

/** "ID - CNPJ - RAZÃO SOCIAL.pdf" -- o mesmo nome com que o PDF é gravado. */
function nomeArquivo(codiEmp: number, cnpj: string | null, razao: string): string {
  const limpa = razao.replace(/[\\/:*?"<>|\u0000-\u001f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 100) || 'SEM NOME';
  return `${codiEmp} - ${cnpj || 'SEM CNPJ'} - ${limpa}.pdf`;
}

/** Mostra um texto com *negrito* e _itálico_ (mesma marcação do WhatsApp), linha a linha. */
function TextoFormatado({ texto, className }: { texto: string; className?: string }) {
  return (
    <div className={className}>
      {texto.split('\n').map((linha, i) => (
        <p key={i} className={linha ? undefined : 'h-3'}>
          {partesFormatadas(linha).map((p, j) =>
            p.negrito ? <strong key={j}>{p.texto}</strong> : p.italico ? <em key={j}>{p.texto}</em> : <React.Fragment key={j}>{p.texto}</React.Fragment>
          )}
        </p>
      ))}
    </div>
  );
}

// dados de exemplo só pra pré-visualizar o modelo no editor
function valoresExemplo(): Record<string, string> {
  const d = new Date();
  return {
    empresa: 'EMPRESA EXEMPLO LTDA',
    id: '627',
    cnpj: '12.345.678/0001-99',
    quantidade: '2',
    data: `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`,
    avisos: '• *FULANO DE TAL* (EMPRESA EXEMPLO LTDA) pode tirar férias — prazo pra conceder até *30/12/2026*.\n• *BELTRANA* (EMPRESA EXEMPLO LTDA) está afastado(a) desde *01/09/2026*.',
  };
}

/**
 * Relatório de situação das empresas: com todos os avisos de hoje, exportado em PDF formatado -- de uma empresa ou em lote
 * (um PDF por empresa, gravado direto na pasta escolhida). O texto do relatório segue um MODELO (variáveis, *negrito*,
 * _itálico_) criado aqui. Só lê o Domínio: não envia nada pra ninguém.
 */
export function RelatorioPage() {
  // ---------- modelos ----------
  const [dados, setDados] = React.useState<ModelosAPI | null>(null);
  const [modeloId, setModeloId] = React.useState('_'); // "_" = o padrão
  const [editando, setEditando] = React.useState<Partial<ModeloAPI> | null>(null);
  const [erroModelo, setErroModelo] = React.useState<string | null>(null);
  const [salvandoModelo, setSalvandoModelo] = React.useState(false);
  const [excluindo, setExcluindo] = React.useState<ModeloAPI | null>(null);
  const [previaPdf, setPreviaPdf] = React.useState<{ titulo: string; descricao: string; carregar: () => Promise<string> } | null>(null);
  const corpoRef = React.useRef<HTMLTextAreaElement>(null);

  const carregarModelos = React.useCallback(() => {
    chamar<ModelosAPI>('modelos:listar').then(setDados).catch(() => {});
  }, []);
  React.useEffect(() => { carregarModelos(); }, [carregarModelos]);

  const modeloEnviado = modeloId === '_' ? undefined : modeloId;

  // ---------- pasta de destino ----------
  // Os PDFs são gravados direto numa pasta do computador (a de um app que sincroniza com o Onvio Processos, por exemplo).
  const [pasta, setPasta] = React.useState<PastaDestino | null>(null);
  const [erroPasta, setErroPasta] = React.useState<string | null>(null);

  React.useEffect(() => {
    chamar<PastaDestino | null>('pasta:atual').then(setPasta).catch(() => {});
  }, []);

  async function handleEscolherPasta() {
    setErroPasta(null);
    try {
      const escolhida = await chamar<PastaDestino | null>('pasta:escolher');
      if (escolhida) setPasta(escolhida);
    } catch (err) {
      setErroPasta(err instanceof Error ? err.message : 'Não foi possível escolher a pasta.');
    }
  }

  // ---------- uma empresa ----------
  const [empresa, setEmpresa] = React.useState<EmpresaDominio | null>(null);
  const [previa, setPrevia] = React.useState<Previa | null>(null);
  const [carregando, setCarregando] = React.useState(false);
  const [erro, setErro] = React.useState<string | null>(null);
  const [exportando, setExportando] = React.useState(false);
  const [msgPdf, setMsgPdf] = React.useState<string | null>(null);

  const montarPrevia = React.useCallback(async (e: EmpresaDominio, modelo: string) => {
    setCarregando(true);
    setErro(null);
    try {
      setPrevia(await chamar<Previa>('relatorio:previa', e.codi_emp, modelo === '_' ? undefined : modelo));
    } catch (err) {
      setPrevia(null);
      setErro(err instanceof Error ? err.message : 'Não foi possível montar o relatório.');
    } finally {
      setCarregando(false);
    }
  }, []);

  function selecionar(e: EmpresaDominio | null) {
    setEmpresa(e);
    setPrevia(null);
    setErro(null);
    setMsgPdf(null);
    if (e) montarPrevia(e, modeloId);
  }

  function trocarModelo(id: string) {
    setModeloId(id);
    if (empresa) montarPrevia(empresa, id);
  }

  // Com pasta escolhida grava lá com o nome "ID - CNPJ - RAZÃO SOCIAL.pdf"; sem pasta, pergunta onde salvar.
  async function exportarPdf() {
    if (!empresa || !previa) return;
    setExportando(true);
    setErro(null);
    try {
      const r = await chamar<{ nome: string; pasta: string } | null>('pdf:salvar', empresa.codi_emp, modeloEnviado, true);
      setMsgPdf(r ? `Gravado em “${r.pasta}”: ${r.nome}` : null);
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Não foi possível gerar o PDF.');
    } finally {
      setExportando(false);
    }
  }
  // ---------- lote ----------
  const { empresas, carregando: carregandoEmpresas, erro: erroEmpresas, recarregar: recarregarEmpresas } = useEmpresasDominio();
  const [buscaLote, setBuscaLote] = React.useState('');
  const [marcadas, setMarcadas] = React.useState<Set<number>>(new Set());
  const [msgLote, setMsgLote] = React.useState<{ ok: boolean; texto: string } | null>(null);
  const [buscandoAtalho, setBuscandoAtalho] = React.useState(false);
  // "ativas" = todas as empresas ativas no Domínio; "lista" = uma lista salva pelo usuário; "escolher" = marcar uma a uma
  const [modoLote, setModoLote] = React.useState<'ativas' | 'lista' | 'escolher'>('ativas');
  // listas de empresas do usuário (ex.: a carteira de cada pessoa do escritório), guardadas neste computador
  const [listas, setListas] = React.useState<ListaEmpresas[]>([]);
  const [listaId, setListaId] = React.useState('');
  const [listaEmEdicao, setListaEmEdicao] = React.useState<string | null>(null);
  const [nomeNovaLista, setNomeNovaLista] = React.useState<string | null>(null);
  const [salvandoLista, setSalvandoLista] = React.useState(false);
  const carregarListas = React.useCallback(async () => {
    try { setListas(await chamar<ListaEmpresas[]>('listas:listar')); } catch { /* sem listas, segue */ }
  }, []);
  React.useEffect(() => { void carregarListas(); }, [carregarListas]);
  const [ativas, setAtivas] = React.useState<{ codiEmp: number }[] | null>(null);
  const [erroAtivas, setErroAtivas] = React.useState<string | null>(null);
  const [progresso, setProgresso] = React.useState<{ feitos: number; total: number; falhas: number; atual: string } | null>(null);
  const [gravandoLote, setGravandoLote] = React.useState(false);
  const cancelarLote = React.useRef(false);

  const carregarAtivas = React.useCallback(() => {
    setErroAtivas(null);
    chamar<{ empresas: { codiEmp: number }[] }>('relatorio:ativas')
      .then((r) => setAtivas(r.empresas))
      .catch((e) => setErroAtivas(e instanceof Error ? e.message : 'Não foi possível buscar as empresas ativas.'));
  }, []);
  React.useEffect(() => { carregarAtivas(); }, [carregarAtivas]);

  const filtradas = React.useMemo(() => buscarEmpresas(empresas, buscaLote, LIMITE_LISTA_LOTE), [empresas, buscaLote]);
  const totalAtivas = ativas?.length ?? null;
  // empresas da lista escolhida que ainda existem no Domínio
  const listaEscolhida = listas.find((l) => l.id === listaId) ?? null;
  const codisDaLista = React.useMemo(() => {
    const existentes = new Set(empresas.map((e) => e.codi_emp));
    return (listaEscolhida?.empresas ?? []).filter((c) => existentes.has(c));
  }, [listaEscolhida, empresas]);
  const totalSelecionado = modoLote === 'ativas' ? (totalAtivas ?? 0) : modoLote === 'lista' ? codisDaLista.length : marcadas.size;

  function alternar(codi: number) {
    setMarcadas((atual) => {
      const novo = new Set(atual);
      if (novo.has(codi)) novo.delete(codi); else novo.add(codi);
      return novo;
    });
  }

  function marcarVarias(codis: number[]) {
    setMarcadas((atual) => new Set([...atual, ...codis]));
  }

  // Atalhos que marcam empresas: "com avisos hoje" ou "com prazo nos próximos 3 / 6 meses" (férias, 2º período, experiência)
  async function atalho(canal: 'relatorio:com-avisos' | 'relatorio:com-prazos', meses?: 3 | 6) {
    setBuscandoAtalho(true);
    setMsgLote(null);
    try {
      const permitidas = new Set(empresas.map((e) => e.codi_emp));
      const codis = (await chamar<{ codiEmps: number[] }>(canal, ...(meses ? [meses] : []))).codiEmps;
      const validas = codis.filter((c) => permitidas.has(c));
      marcarVarias(validas);
      setMsgLote({ ok: true, texto: `${validas.length} empresa(s) marcada(s)${meses ? ` com prazo nos próximos ${meses} meses` : ' com avisos hoje'}.` });
    } catch (err) {
      setMsgLote({ ok: false, texto: err instanceof Error ? err.message : 'Não foi possível buscar as empresas.' });
    } finally {
      setBuscandoAtalho(false);
    }
  }

  const erroDe = (err: unknown, padrao: string) => (err instanceof Error ? err.message : padrao);

  // Salva a seleção atual como uma lista nova (pergunta o nome) ou atualiza a lista que está carregada.
  async function salvarLista(id?: string) {
    const existente = id ? listas.find((l) => l.id === id) : undefined;
    const nome = existente ? existente.nome : (nomeNovaLista ?? '').trim();
    setSalvandoLista(true);
    try {
      const l = await chamar<ListaEmpresas>('listas:salvar', { id, nome, empresas: [...marcadas] });
      await carregarListas();
      setListaEmEdicao(l.id);
      setNomeNovaLista(null);
      setMsgLote({ ok: true, texto: `Lista “${l.nome}” ${existente ? 'atualizada' : 'salva'} com ${l.empresas.length} empresa(s).` });
    } catch (err) {
      setMsgLote({ ok: false, texto: erroDe(err, 'Não foi possível salvar a lista.') });
    } finally {
      setSalvandoLista(false);
    }
  }

  // Põe as empresas da lista na seleção (substitui o que estava marcado) pra conferir ou ajustar.
  function carregarListaNaSelecao(id: string) {
    const l = listas.find((x) => x.id === id);
    if (!l) { setListaEmEdicao(null); return; }
    const existentes = new Set(empresas.map((e) => e.codi_emp));
    const validas = l.empresas.filter((c) => existentes.has(c));
    setMarcadas(new Set(validas));
    setListaEmEdicao(l.id);
    setNomeNovaLista(null);
    const sumiram = l.empresas.length - validas.length;
    setMsgLote({ ok: true, texto: `Lista “${l.nome}”: ${validas.length} empresa(s) marcada(s)${sumiram > 0 ? ` (${sumiram} não aparece(m) mais no Domínio)` : ''}. Ajuste a seleção e clique em Atualizar a lista, se quiser.` });
  }

  async function excluirLista(id: string) {
    const l = listas.find((x) => x.id === id);
    if (!l || !window.confirm(`Excluir a lista “${l.nome}”? As empresas continuam no Domínio; só a lista é apagada.`)) return;
    try {
      await chamar('listas:excluir', id);
      await carregarListas();
      if (listaId === id) setListaId('');
      if (listaEmEdicao === id) setListaEmEdicao(null);
      setMsgLote({ ok: true, texto: `Lista “${l.nome}” excluída.` });
    } catch (err) {
      setMsgLote({ ok: false, texto: erroDe(err, 'Não foi possível excluir a lista.') });
    }
  }

  // Um PDF por empresa, gravado direto na pasta: nada de .zip. Gera 4 por vez e segue mesmo se algum falhar.
  async function exportarLote() {
    setMsgLote(null);
    if (!pasta) {
      setMsgLote({ ok: false, texto: 'Escolha primeiro a pasta de destino dos PDFs.' });
      return;
    }
    const codis = modoLote === 'ativas' ? (ativas ?? []).map((e) => e.codiEmp) : modoLote === 'lista' ? codisDaLista : [...marcadas];
    if (codis.length === 0) return;
    cancelarLote.current = false;
    setGravandoLote(true);
    setProgresso({ feitos: 0, total: codis.length, falhas: 0, atual: '' });
    let feitos = 0;
    let falhas = 0;
    const resultado = await processarEmFila(
      codis,
      PDFS_SIMULTANEOS,
      async (codi) => {
        try {
          const r = await chamar<{ nome: string } | null>('pdf:salvar', codi, modeloEnviado, true);
          if (r) setProgresso((p) => (p ? { ...p, atual: r.nome } : p));
        } catch (err) {
          throw new Error(`Empresa ${codi}: ${err instanceof Error ? err.message : 'falha ao gerar o PDF'}`);
        }
      },
      {
        cancelado: () => cancelarLote.current,
        aoTerminarItem: (_item, erroItem) => {
          if (erroItem) falhas++; else feitos++;
          setProgresso((p) => (p ? { ...p, feitos: feitos + falhas, falhas } : p));
        },
      }
    );
    setGravandoLote(false);
    const interrompido = resultado.naoProcessados.length > 0;
    setMsgLote({
      ok: resultado.falhas.length === 0 && !interrompido,
      texto:
        `${resultado.ok.length} PDF(s) gravado(s) na pasta “${pasta.nome}”` +
        (resultado.falhas.length > 0 ? `; ${resultado.falhas.length} com falha (ex.: ${resultado.falhas[0].erro.message})` : '') +
        (interrompido ? `; parado antes do fim — ${resultado.naoProcessados.length} empresa(s) não foram feitas` : '') +
        '.',
    });
  }
  // ---------- editor de modelo ----------
  function inserirNoCorpo(antes: string, depois = '', marcador = '') {
    const el = corpoRef.current;
    const atual = editando?.corpo ?? '';
    const ini = el?.selectionStart ?? atual.length;
    const fim = el?.selectionEnd ?? atual.length;
    const selecionado = atual.slice(ini, fim);
    const meio = selecionado || marcador;
    const novo = `${atual.slice(0, ini)}${antes}${meio}${depois}${atual.slice(fim)}`;
    setEditando((m) => ({ ...m, corpo: novo }));
    requestAnimationFrame(() => {
      el?.focus();
      // com seleção (ou sem texto de apoio) o cursor vai pro fim do que foi inserido; senão o texto de apoio fica selecionado
      if (selecionado || !marcador) el?.setSelectionRange(ini + antes.length + meio.length + depois.length, ini + antes.length + meio.length + depois.length);
      else el?.setSelectionRange(ini + antes.length, ini + antes.length + marcador.length);
    });
  }

  // Traz o texto de um .docx: parágrafos viram linhas, negrito/itálico viram *…*/_…_; as {{variáveis}} escritas no Word valem.
  async function importarWord() {
    setErroModelo(null);
    try {
      const r = await chamar<{ nome: string; corpo: string } | null>('modelos:importar-docx');
      if (r) setEditando((m) => ({ ...m, corpo: r.corpo, nome: m?.nome?.trim() ? m.nome : r.nome.slice(0, 80) }));
    } catch (err) {
      setErroModelo(err instanceof Error ? err.message : 'Não foi possível importar o documento.');
    }
  }

  async function salvarModelo(e: React.FormEvent) {
    e.preventDefault();
    if (!editando) return;
    setSalvandoModelo(true);
    setErroModelo(null);
    try {
      const dto = { nome: editando.nome ?? '', corpo: editando.corpo ?? '', padrao: !!editando.padrao, ativo: editando.ativo ?? true };
      await (editando.id ? chamar('modelos:atualizar', editando.id, dto) : chamar('modelos:criar', dto));
      setEditando(null);
      carregarModelos();
      if (empresa) montarPrevia(empresa, modeloId);
    } catch (err) {
      setErroModelo(err instanceof Error ? err.message : 'Erro ao salvar.');
    } finally {
      setSalvandoModelo(false);
    }
  }

  async function excluirModelo() {
    if (!excluindo) return;
    try { await chamar('modelos:excluir', excluindo.id); } catch { /* a lista recarregada mostra o estado real */ }
    if (modeloId === excluindo.id) setModeloId('_');
    setExcluindo(null);
    carregarModelos();
  }

  const modelosAtivos = dados?.modelos.filter((m) => m.ativo) ?? [];
  const padraoAtivo = dados?.modelos.find((m) => m.padrao && m.ativo);

  const [aba, setAba] = React.useState<'empresa' | 'lote' | 'modelos' | 'aparencia'>('empresa');
  const ABAS = [
    { id: 'empresa', rotulo: 'Uma empresa', icone: Building2 },
    { id: 'lote', rotulo: 'Em lote', icone: Layers },
    { id: 'modelos', rotulo: 'Modelos de texto', icone: FileText },
    { id: 'aparencia', rotulo: 'Aparência do PDF', icone: Palette },
  ] as const;

  return (
    <div className="mx-auto flex w-full max-w-[1500px] flex-col gap-6">
      <header>
        <h1 className="text-[22px] font-bold tracking-tight">Relatório de prazos</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Férias com risco, contratos de experiência, afastamentos e aniversariantes em PDF — de uma empresa ou de todas de uma vez. O app só lê o Domínio: não envia nada pra ninguém.
        </p>
      </header>

      {/* o que vale pro relatório de uma empresa e pro lote */}
      <div className="grid gap-5 rounded-[var(--radius)] border border-border bg-card p-4 shadow-sm md:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Modelo do texto</label>
          <Select value={modeloId} onValueChange={trocarModelo}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="_">Padrão{padraoAtivo ? ` (${padraoAtivo.nome})` : ' (sem texto de modelo)'}</SelectItem>
              {modelosAtivos.map((m) => <SelectItem key={m.id} value={m.id}>{m.nome}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Pasta de destino dos PDFs</label>
          <div className="flex items-center gap-2">
            <div className={cn('flex h-9 min-w-0 flex-1 items-center gap-2 rounded-[var(--radius)] border px-3 text-sm', pasta ? 'border-border bg-secondary/40' : 'border-dashed border-border text-muted-foreground')} title={pasta?.caminho}>
              <FolderOpen className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
              <span className="truncate">{pasta ? pasta.caminho : 'Nenhuma pasta escolhida'}</span>
            </div>
            <Button type="button" variant={pasta ? 'secondary' : 'primary'} onClick={handleEscolherPasta}>{pasta ? 'Trocar' : 'Escolher…'}</Button>
            {pasta && <Button type="button" variant="ghost" size="icon" onClick={() => chamar('pasta:abrir').catch(() => {})} aria-label="Abrir pasta" title="Abrir pasta"><ExternalLink className="size-4" /></Button>}
          </div>
          {erroPasta ? <p className="text-xs text-destructive">{erroPasta}</p> : <p className="text-xs text-muted-foreground">Arquivos: “ID - CNPJ - Razão social”. Um arquivo de mesmo nome é substituído.</p>}
        </div>
      </div>

      <div role="tablist" aria-label="Seções" className="flex gap-1 border-b border-border">
        {ABAS.map(({ id, rotulo, icone: Icone }) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={aba === id}
            onClick={() => setAba(id)}
            className={cn(
              '-mb-px inline-flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-medium transition-colors duration-150',
              aba === id ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'
            )}
          >
            <Icone className="size-4" aria-hidden="true" />{rotulo}
          </button>
        ))}
      </div>
      {aba === 'aparencia' && <AparenciaPanel />}

      {aba === 'empresa' && (
      <>
      <Card>
        <CardHeader>
          <CardTitle>Relatório de uma empresa</CardTitle>
          <CardDescription>Escolha a empresa pra ver a prévia e salvar o PDF.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-5">
          <div className="flex max-w-md flex-col gap-1.5">
            <label className="text-sm font-medium">Empresa</label>
            <EmpresaCombobox value={empresa} onChange={selecionar} />
          </div>

          {empresa && carregando && <p className="text-sm text-muted-foreground">Consultando o Domínio…</p>}
          {erro && <p className="text-sm text-destructive">{erro}</p>}

          {empresa && previa && (
            <>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
                {previa.totais.map((t) => (
                  <div
                    key={t.rotulo}
                    className={cn('rounded-[var(--radius)] border p-3 text-center', t.urgente && t.valor > 0 ? 'border-destructive/50 bg-destructive/10' : 'border-border bg-secondary/40')}
                  >
                    <div className={cn('text-2xl font-bold', t.urgente && t.valor > 0 && 'text-destructive')}>{t.valor}</div>
                    <div className="text-xs text-muted-foreground">{t.rotulo}</div>
                  </div>
                ))}
              </div>

              {previa.mensagem && (
                <div>
                  <div className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Texto do modelo (vai no começo do PDF)</div>
                  <TextoFormatado texto={previa.mensagem} className="max-h-72 overflow-y-auto rounded-[var(--radius)] border border-border border-l-4 border-l-success bg-secondary/40 p-4 text-sm leading-relaxed" />
                </div>
              )}

              {/* prévia do que vai no PDF -- Relatório de Vencimentos de Férias, Experiência e Afastamentos, emitido em {previa.emissao} */}
              <div className="flex flex-col gap-4 text-sm">
                <div>
                  <div className="mb-2 flex items-center gap-2 font-semibold"><span className="size-3 rounded-full bg-destructive" /> Alertas Críticos: Férias com Risco</div>
                  {previa.criticos.length === 0 ? (
                    <p className="text-muted-foreground">Nenhum registro no momento.</p>
                  ) : (
                    <div className="flex flex-col gap-2">
                      {previa.criticos.map((c) => (
                        <div key={c.nome + c.prazoLimite} className="rounded-[var(--radius)] border-l-4 border-l-destructive bg-destructive/10 p-3">
                          <div className="font-semibold text-destructive">{c.nome}</div>
                          <ul className="mt-1 list-disc pl-5 text-muted-foreground">
                            <li><b className="text-destructive">Dias pendentes:</b> {c.diasPendentes} dias (Período aquisitivo encerrado em {c.periodoEncerrado}).</li>
                            <li><b className="text-destructive">Prazo limite para gozo:</b> {c.prazoLimite} ({c.faltam < 0 ? `Venceu há ${-c.faltam} dias` : `Faltam ${c.faltam} dias`}).</li>
                            <li>
                              <b className="text-destructive">Atenção:</b> {c.faltam < 0 ? 'O prazo já passou: a empresa está sujeita ao pagamento em dobro.' : 'Após esta data, a empresa estará sujeita ao pagamento em dobro.'}
                              {c.segundoPeriodo && ` O colaborador completará um 2º período aquisitivo no dia ${c.segundoPeriodo}.`}
                            </li>
                          </ul>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div>
                  <div className="mb-2 flex items-center gap-2 font-semibold"><span className="size-3 rounded-full bg-warning" /> Alertas de Férias: Prazos Regulares</div>
                  {previa.regulares.length === 0 ? (
                    <p className="text-muted-foreground">Nenhum registro no momento.</p>
                  ) : (
                    <div className="max-h-64 overflow-y-auto rounded-[var(--radius)] border border-border">
                      <table className="w-full text-left text-sm">
                        <thead className="bg-secondary/60 text-xs uppercase text-muted-foreground">
                          <tr><th className="px-3 py-2">Colaborador</th><th className="px-3 py-2">Período encerrado em</th><th className="px-3 py-2">Prazo limite (concessão)</th><th className="px-3 py-2">Dias pend.</th></tr>
                        </thead>
                        <tbody>
                          {previa.regulares.map((r) => (
                            <tr key={r.nome + r.prazoLimite} className="border-t border-border">
                              <td className="px-3 py-2 font-medium">{r.nome}</td><td className="px-3 py-2">{r.periodoEncerrado}</td><td className="px-3 py-2">{r.prazoLimite}</td><td className="px-3 py-2">{r.diasPendentes}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                <div>
                  <div className="mb-2 flex items-center gap-2 font-semibold"><span className="size-3 rounded-full bg-info" /> Alerta de Contrato</div>
                  {previa.contratos.length === 0 ? (
                    <p className="text-muted-foreground">Nenhum registro no momento.</p>
                  ) : (
                    <ul className="list-disc pl-5 text-muted-foreground">
                      {previa.contratos.map((c) => (
                        <li key={c.nome + c.descricao}>
                          <b className="text-foreground">{c.nome}:</b>{' '}
                          {partesFormatadas(c.descricao).map((p, j) => (p.negrito ? <b key={j} className="text-foreground">{p.texto}</b> : <React.Fragment key={j}>{p.texto}</React.Fragment>))} {c.acao}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                {previa.afastados.length > 0 && (
                  <div>
                    <div className="mb-2 flex items-center gap-2 font-semibold"><span className="size-3 rounded-full bg-muted-foreground" /> Afastados</div>
                    <ul className="list-disc pl-5 text-muted-foreground">
                      {previa.afastados.map((a) => (
                        <li key={a.nome + a.inicio}><b className="text-foreground">{a.nome}:</b> {a.motivo}, desde <b className="text-foreground">{a.inicio}</b>{a.retorno !== '—' ? `, com previsão de retorno em ${a.retorno}` : ''}.</li>
                      ))}
                    </ul>
                  </div>
                )}

                {previa.segundoPeriodo.length > 0 && (
                  <div>
                    <div className="mb-2 flex items-center gap-2 font-semibold"><span className="size-3 rounded-full bg-success" /> Vencimento de 2º Período de Férias</div>
                    <ul className="list-disc pl-5 text-muted-foreground">
                      {previa.segundoPeriodo.map((s) => (
                        <li key={s.nome + s.vencimento}><b className="text-foreground">{s.nome}:</b> 2º período completo em <b className="text-foreground">{s.vencimento}</b>; limite do período pendente: {s.limite}.</li>
                      ))}
                    </ul>
                  </div>
                )}

                {previa.aniversariantes.length > 0 && (
                  <div>
                    <div className="mb-2 flex items-center gap-2 font-semibold"><span className="size-3 rounded-full bg-pink-500" /> Aniversariantes do Mês</div>
                    <ul className="list-disc pl-5 text-muted-foreground">
                      {previa.aniversariantes.map((a) => (
                        <li key={a.nome + a.data}>
                          <b className="text-foreground">{a.nome}</b> — {a.data}, completa {a.idade} anos
                          {a.hoje ? <b className="text-foreground"> (hoje!)</b> : a.jaPassou ? ' (já passou)' : ''}.
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {previa.contatoAjuda && (
                  <div className="rounded-[var(--radius)] border-l-4 border-l-success bg-success/10 p-3">
                    <div className="font-semibold">Precisa de ajuda com esses dados?</div>
                    <p className="text-muted-foreground">Caso tenha dúvidas sobre os prazos ou queira orientações para conceder as férias, entre em contato via ligação ou mensagem pelo aplicativo do WhatsApp: <b className="text-foreground">{previa.contatoAjuda}</b>.</p>
                  </div>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <Button type="button" variant="primary" onClick={exportarPdf} disabled={exportando}>
                  <Download className="size-4" aria-hidden="true" /> {exportando ? 'Gerando PDF…' : pasta ? 'Salvar PDF na pasta' : 'Exportar PDF'}
                </Button>
                <Button
                  type="button" variant="secondary" disabled={carregando || exportando}
                  onClick={() => setPreviaPdf({ titulo: `Pré-visualização — ${previa.empresa}`, descricao: 'O PDF real desta empresa, com o modelo escolhido.', carregar: () => chamar<string>('relatorio:pdf-previa', previa.codiEmp, modeloEnviado) })}
                >
                  <Eye className="size-4" aria-hidden="true" /> Pré-visualizar PDF
                </Button>
                <Button type="button" variant="secondary" onClick={() => empresa && montarPrevia(empresa, modeloId)} disabled={carregando || exportando}>Atualizar</Button>
                <span className="text-xs text-muted-foreground">{nomeArquivo(previa.codiEmp, previa.cnpj, previa.empresa)}</span>
              </div>
              {msgPdf && <p className="text-sm text-muted-foreground">{msgPdf}</p>}
            </>
          )}
        </CardContent>
      </Card>
      </>
      )}
      {aba === 'lote' && (
      <>
      {/* ---------- lote ---------- */}
      <Card>
        <CardHeader>
          <CardTitle>Exportar em lote</CardTitle>
          <CardDescription>
            Grava o relatório individual de cada empresa, um PDF por empresa, na pasta de destino escolhida acima (sem .zip) — cada
            arquivo se chama &quot;ID - CNPJ - Razão social&quot;. Por padrão vale pra <b>todas as empresas ativas no Domínio</b>; se preferir, use <b>uma das suas listas</b> (por exemplo, a carteira de cada pessoa do escritório) ou escolha as empresas uma a uma.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-col gap-2 text-sm">
            <label className="flex items-center gap-2 font-medium">
              <input type="radio" name="modo-lote" className="size-4" checked={modoLote === 'ativas'} onChange={() => setModoLote('ativas')} />
              Todas as empresas ativas no Domínio
              {totalAtivas !== null && <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[11px] text-primary">{totalAtivas} empresas</span>}
            </label>
            {modoLote === 'ativas' && erroAtivas && (
              <p className="ml-6 flex flex-wrap items-center gap-2 text-sm text-destructive">
                {erroAtivas}
                <Button type="button" variant="secondary" size="sm" onClick={carregarAtivas}>Tentar de novo</Button>
              </p>
            )}
            <label className="flex items-center gap-2 font-medium">
              <input type="radio" name="modo-lote" className="size-4" checked={modoLote === 'lista'} onChange={() => setModoLote('lista')} />
              Uma das minhas listas
              {listas.length > 0 && <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[11px] text-primary">{listas.length} {listas.length === 1 ? 'lista' : 'listas'}</span>}
            </label>
            <label className="flex items-center gap-2 font-medium">
              <input type="radio" name="modo-lote" className="size-4" checked={modoLote === 'escolher'} onChange={() => setModoLote('escolher')} />
              Escolher as empresas
            </label>
          </div>

          {modoLote === 'lista' && (
            <div className="flex flex-col gap-3 rounded-[var(--radius)] border border-border bg-secondary/40 p-3 text-sm">
              {listas.length === 0 ? (
                <p className="text-muted-foreground">
                  Você ainda não tem listas. Em <b className="text-foreground">Escolher as empresas</b>, marque as empresas (por exemplo, a carteira de uma pessoa do escritório) e clique em <b className="text-foreground">Salvar como lista…</b>. Os PDFs da lista saem na mesma pasta de destino dos outros relatórios.
                </p>
              ) : (
                <>
                  <div className="flex flex-wrap items-center gap-2">
                    <label htmlFor="lista-lote" className="font-medium">Lista:</label>
                    <select
                      id="lista-lote" value={listaId} onChange={(e) => setListaId(e.target.value)}
                      className="h-9 min-w-56 max-w-sm rounded-[var(--radius)] border border-input bg-background px-3 text-sm"
                    >
                      <option value="">Escolha uma lista…</option>
                      {listas.map((l) => <option key={l.id} value={l.id}>{l.nome} ({l.empresas.length})</option>)}
                    </select>
                    {listaEscolhida && (
                      <>
                        <Button type="button" variant="secondary" size="sm" onClick={() => { carregarListaNaSelecao(listaEscolhida.id); setModoLote('escolher'); }}>Ver e editar</Button>
                        <Button type="button" variant="ghost" size="sm" onClick={() => excluirLista(listaEscolhida.id)}>Excluir lista</Button>
                      </>
                    )}
                  </div>
                  {listaEscolhida && (
                    <p className="text-muted-foreground">
                      {codisDaLista.length} empresa(s) vão receber o relatório
                      {listaEscolhida.empresas.length > codisDaLista.length ? `; ${listaEscolhida.empresas.length - codisDaLista.length} da lista não aparece(m) mais no Domínio e será(ão) ignorada(s)` : ''}.
                    </p>
                  )}
                </>
              )}
            </div>
          )}

          {modoLote === 'escolher' && (
            <>
              <div className="flex flex-wrap items-center gap-2">
                <Input className="max-w-sm" value={buscaLote} onChange={(e) => setBuscaLote(e.target.value)} placeholder="Filtrar por nome, CNPJ ou ID" disabled={carregandoEmpresas} />
                <Button type="button" variant="secondary" size="sm" onClick={() => atalho('relatorio:com-avisos')} disabled={buscandoAtalho || carregandoEmpresas}>Com avisos hoje</Button>
                <Button type="button" variant="secondary" size="sm" onClick={() => atalho('relatorio:com-prazos', 3)} disabled={buscandoAtalho || carregandoEmpresas} title="Férias, 2º período ou contrato de experiência com prazo nos próximos 3 meses">Prazos em 3 meses</Button>
                <Button type="button" variant="secondary" size="sm" onClick={() => atalho('relatorio:com-prazos', 6)} disabled={buscandoAtalho || carregandoEmpresas} title="Férias, 2º período ou contrato de experiência com prazo nos próximos 6 meses">Prazos em 6 meses</Button>
                <Button type="button" variant="ghost" size="sm" onClick={() => { setMarcadas(new Set()); setMsgLote(null); }} disabled={marcadas.size === 0}>Limpar seleção</Button>
              </div>

              <div className="flex flex-wrap items-center gap-2 rounded-[var(--radius)] border border-border p-2 text-sm">
                <span className="font-medium">Minhas listas:</span>
                {listas.length > 0 && (
                  <select
                    aria-label="Carregar uma lista na seleção" value={listaEmEdicao ?? ''}
                    onChange={(e) => (e.target.value ? carregarListaNaSelecao(e.target.value) : setListaEmEdicao(null))}
                    className="h-8 min-w-48 max-w-xs rounded-[var(--radius)] border border-input bg-background px-2 text-sm"
                  >
                    <option value="">Carregar uma lista…</option>
                    {listas.map((l) => <option key={l.id} value={l.id}>{l.nome} ({l.empresas.length})</option>)}
                  </select>
                )}
                {listaEmEdicao && listas.some((l) => l.id === listaEmEdicao) && (
                  <Button type="button" variant="secondary" size="sm" disabled={salvandoLista || marcadas.size === 0} onClick={() => salvarLista(listaEmEdicao)}>
                    Atualizar “{listas.find((l) => l.id === listaEmEdicao)?.nome}”
                  </Button>
                )}
                {nomeNovaLista === null ? (
                  <Button type="button" variant="secondary" size="sm" disabled={marcadas.size === 0} onClick={() => setNomeNovaLista('')} title="Guarda as empresas marcadas numa lista com o nome que você escolher">Salvar como lista…</Button>
                ) : (
                  <form className="flex flex-wrap items-center gap-2" onSubmit={(e) => { e.preventDefault(); void salvarLista(); }}>
                    <Input className="h-8 w-56" autoFocus maxLength={60} value={nomeNovaLista} onChange={(e) => setNomeNovaLista(e.target.value)} placeholder="Nome da lista (ex.: Carteira da Ana)" aria-label="Nome da nova lista" />
                    <Button type="submit" variant="primary" size="sm" disabled={salvandoLista || !nomeNovaLista.trim()}>Salvar lista</Button>
                    <Button type="button" variant="ghost" size="sm" onClick={() => setNomeNovaLista(null)}>Cancelar</Button>
                  </form>
                )}
                {listaEmEdicao && listas.some((l) => l.id === listaEmEdicao) && (
                  <Button type="button" variant="ghost" size="sm" onClick={() => excluirLista(listaEmEdicao)}>Excluir lista</Button>
                )}
              </div>

              <details className="rounded-[var(--radius)] border border-border bg-secondary/40 p-3 text-sm">
                <summary className="cursor-pointer font-medium">Como funcionam os botões de atalho?</summary>
                <div className="mt-3 flex flex-col gap-3 text-muted-foreground">
                  <p>Os botões só <b className="text-foreground">marcam empresas</b> na lista abaixo, olhando os dados do Domínio <b className="text-foreground">na hora do clique</b>. Nada é gerado até você clicar em exportar, e você pode desmarcar ou marcar mais empresas antes. Cada clique <b className="text-foreground">soma</b> às que já estão marcadas; use &quot;Limpar seleção&quot; para recomeçar.</p>
                  <div>
                    <p className="font-semibold text-foreground">Com avisos hoje</p>
                    <p>Marca as empresas que, hoje, têm pelo menos um aviso no relatório: colaboradores que já podem tirar férias (período aquisitivo encerrado), alerta de pagamento em dobro (faltando 90, 60 ou 30 dias, ou já vencido), 2º período de férias a vencer, contrato de experiência em andamento ou colaboradores afastados. Quem só tem aniversariante no mês <b>não</b> entra.</p>
                  </div>
                  <div>
                    <p className="font-semibold text-foreground">Prazos em 3 meses / Prazos em 6 meses</p>
                    <p>Olham para frente: marcam as empresas com algum <b className="text-foreground">prazo que cai até daqui a 3 (ou 6) meses</b>, contando de hoje. Entram: o limite para conceder as férias, o vencimento ou o limite do 2º período e o fim do contrato de experiência (o do 1º período, quando a prorrogação é só prevista). Prazos já vencidos também entram. Afastamentos e aniversários não contam, pois não são prazos de ação.</p>
                  </div>
                  <p>Dica: &quot;Prazos em 6 meses&quot; inclui tudo o que &quot;Prazos em 3 meses&quot; marcaria, só que mais empresas. Use 3 meses para o que precisa de ação já e 6 meses para planejar com folga.</p>
                  <p>O relatório de cada empresa marcada traz as mesmas informações de sempre; o atalho só escolhe <i>quais</i> empresas receberão um PDF.</p>
                </div>
              </details>

              <div className="max-h-80 overflow-y-auto rounded-[var(--radius)] border border-border">
                {carregandoEmpresas ? (
                  <p className="p-3 text-sm text-muted-foreground">Carregando empresas…</p>
                ) : erroEmpresas ? (
                  <p className="flex flex-wrap items-center gap-2 p-3 text-sm text-destructive">
                    {erroEmpresas}
                    <Button type="button" variant="secondary" size="sm" onClick={recarregarEmpresas}>Tentar de novo</Button>
                  </p>
                ) : filtradas.length === 0 ? (
                  <p className="p-3 text-sm text-muted-foreground">Nenhuma empresa encontrada.</p>
                ) : (
                  filtradas.map((e) => (
                    <label key={e.codi_emp} className="flex cursor-pointer items-center gap-3 border-b border-border px-3 py-2 text-sm last:border-b-0 hover:bg-secondary/60">
                      <input type="checkbox" className="size-4" checked={marcadas.has(e.codi_emp)} onChange={() => alternar(e.codi_emp)} />
                      <span className="font-mono text-xs text-muted-foreground">{e.codi_emp}</span>
                      <span className="min-w-0 flex-1 truncate font-medium">{e.razao_emp || e.nome_emp}</span>
                      <span className="hidden font-mono text-xs text-muted-foreground sm:inline">{formatarCnpj(e.cgce_emp)}</span>
                    </label>
                  ))
                )}
              </div>
              {filtradas.length === LIMITE_LISTA_LOTE && <p className="text-xs text-muted-foreground">Mostrando as {LIMITE_LISTA_LOTE} primeiras — refine o filtro pra achar outras.</p>}
            </>
          )}

          <div className="flex flex-wrap items-center gap-3">
            <Button
              type="button" variant="primary" onClick={exportarLote}
              disabled={gravandoLote || totalSelecionado === 0 || (modoLote !== 'ativas' && totalSelecionado > LIMITE_LOTE)}
            >
              <Download className="size-4" aria-hidden="true" />{' '}
              {gravandoLote
                ? 'Gravando…'
                : `Salvar PDFs na pasta (${totalSelecionado} empresa${totalSelecionado === 1 ? '' : 's'})`}
            </Button>
            {gravandoLote && <Button type="button" variant="secondary" onClick={() => { cancelarLote.current = true; }}>Parar</Button>}
            {!pasta && !gravandoLote && <span className="text-sm text-muted-foreground">Escolha a pasta de destino acima primeiro.</span>}
            {modoLote === 'escolher' && marcadas.size > LIMITE_LOTE && <span className="text-sm text-destructive">Máximo de {LIMITE_LOTE} empresas por lote — desmarque {marcadas.size - LIMITE_LOTE}.</span>}
          </div>
          {progresso && gravandoLote && (
            <div className="flex flex-col gap-1.5">
              <div className="h-2 w-full max-w-md overflow-hidden rounded-full bg-secondary">
                <div className="h-full bg-primary transition-[width] duration-150" style={{ width: `${Math.round((progresso.feitos / progresso.total) * 100)}%` }} />
              </div>
              <span className="text-xs text-muted-foreground">
                {progresso.feitos} de {progresso.total}{progresso.falhas > 0 ? ` · ${progresso.falhas} com falha` : ''}{progresso.atual ? ` · ${progresso.atual}` : ''}
              </span>
            </div>
          )}
          {msgLote && <p className={cn('text-sm', msgLote.ok ? 'text-muted-foreground' : 'text-destructive')}>{msgLote.texto}</p>}        </CardContent>
      </Card>
      </>
      )}
      {aba === 'modelos' && (
      <>
      <Card>
        <CardHeader>
          <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Texto do relatório</div>
          <CardTitle>Modelos do relatório</CardTitle>
          <CardDescription>
            Escreva o texto e use as variáveis ({'{{empresa}}'}, {'{{cnpj}}'}, {'{{avisos}}'}…), que saem em
            negrito. Use *negrito* e _itálico_ (a marcação é a mesma do WhatsApp). O texto do modelo escolhido (ou o <b>padrão</b>) aparece no começo do PDF, antes dos alertas; sem modelo, o PDF traz só os alertas.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {dados && dados.modelos.length === 0 && <p className="text-sm text-muted-foreground">Nenhum modelo criado ainda — o PDF segue só o layout padrão do Relatório de Vencimentos de Férias, Experiência e Afastamentos.</p>}
          {dados?.modelos.map((m) => (
            <div key={m.id} className="rounded-[var(--radius)] border border-border p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-sm font-medium">
                  {m.nome}
                  {m.padrao && <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[11px] text-primary">padrão</span>}
                  {!m.ativo && <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">inativo</span>}
                </div>
                {(
                  <div className="flex gap-2">
                    <Button variant="ghost" size="sm" onClick={() => setPreviaPdf({ titulo: `Pré-visualização — ${m.nome}`, descricao: 'Como o PDF fica com este modelo (empresa de exemplo, dados fictícios).', carregar: () => chamar<string>('modelos:previa-pdf', m.corpo) })}>
                      <Eye className="size-4" aria-hidden="true" /> Visualizar
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => { setErroModelo(null); setEditando(m); }}>Editar</Button>
                    <Button variant="ghost" size="sm" onClick={() => setExcluindo(m)}>Excluir</Button>
                  </div>
                )}
              </div>
              <TextoFormatado texto={m.corpo} className="mt-2 text-sm text-muted-foreground" />
            </div>
          ))}
          {(
            <div>
              <Button
                variant="secondary" size="sm"
                onClick={() => { setErroModelo(null); setEditando({ nome: '', corpo: dados?.textoPadraoEmbutido ?? '', padrao: !dados?.modelos.some((m) => m.padrao), ativo: true }); }}
              >
                + Novo modelo
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
      </>
      )}


      {/* ---------- pré-visualização do PDF ---------- */}
      <PreviaPdfDialog
        open={!!previaPdf}
        onClose={() => setPreviaPdf(null)}
        titulo={previaPdf?.titulo ?? ''}
        descricao={previaPdf?.descricao}
        carregar={previaPdf?.carregar ?? (async () => '')}
      />

      {/* ---------- editor de modelo ---------- */}
      <Dialog open={!!editando} onOpenChange={(open) => { if (!open) setEditando(null); }}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>{editando?.id ? 'Editar modelo' : 'Novo modelo'}</DialogTitle>
            <DialogDescription>Escreva o texto do relatório e use as variáveis pra puxar os dados da empresa.</DialogDescription>
          </DialogHeader>
          <form onSubmit={salvarModelo} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium">Nome</label>
              <Input value={editando?.nome ?? ''} onChange={(e) => setEditando((m) => ({ ...m, nome: e.target.value }))} maxLength={80} required />
            </div>
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium">Texto</label>
                <div className="flex items-center gap-1">
                  <button type="button" onClick={importarWord} className="mr-1 rounded border border-border px-2.5 py-0.5 text-xs hover:bg-secondary" title="Usa o texto de um documento do Word (.docx) como modelo">Importar do Word…</button>
                  <button type="button" onClick={() => inserirNoCorpo('*', '*', 'negrito')} className="rounded border border-border px-2.5 py-0.5 text-sm font-bold hover:bg-secondary" title="Negrito: *texto*" aria-label="Negrito">B</button>
                  <button type="button" onClick={() => inserirNoCorpo('_', '_', 'itálico')} className="rounded border border-border px-2.5 py-0.5 text-sm italic hover:bg-secondary" title="Itálico: _texto_" aria-label="Itálico">I</button>
                </div>
              </div>
              <textarea
                ref={corpoRef}
                rows={8}
                value={editando?.corpo ?? ''}
                onChange={(e) => setEditando((m) => ({ ...m, corpo: e.target.value }))}
                maxLength={dados?.limiteCaracteres ?? 1500}
                className="w-full rounded-[var(--radius)] border border-border bg-card p-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                required
              />
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-xs text-muted-foreground">Inserir:</span>
                {dados?.variaveis.map((v) => (
                  <button key={v} type="button" onClick={() => inserirNoCorpo(`{{${v}}}`)} className="rounded-full border border-border px-2 py-0.5 font-mono text-xs text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground">
                    {`{{${v}}}`}
                  </button>
                ))}
                <span className="ml-auto text-xs text-muted-foreground">{(editando?.corpo ?? '').length}/{dados?.limiteCaracteres ?? 1500}</span>
              </div>
            </div>
            <div>
              <div className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Como fica (dados de exemplo)</div>
              <TextoFormatado texto={renderizarModelo(editando?.corpo ?? '', valoresExemplo())} className="max-h-48 overflow-y-auto rounded-[var(--radius)] border border-border bg-secondary/40 p-3 text-sm" />
            </div>
            <label className="flex items-center gap-2 text-sm font-medium">
              <input type="checkbox" className="size-4" checked={!!editando?.padrao} onChange={(e) => setEditando((m) => ({ ...m, padrao: e.target.checked }))} />
              Usar como padrão no relatório
            </label>
            <label className="flex items-center gap-2 text-sm font-medium">
              <input type="checkbox" className="size-4" checked={editando?.ativo ?? true} onChange={(e) => setEditando((m) => ({ ...m, ativo: e.target.checked }))} />
              Modelo ativo
            </label>
            {erroModelo && <p className="text-sm text-destructive">{erroModelo}</p>}
            <DialogFooter>
              <Button
                variant="secondary" type="button" className="mr-auto"
                onClick={() => setPreviaPdf({ titulo: 'Pré-visualização do modelo', descricao: 'Como o PDF fica com o texto que está no editor (empresa de exemplo, dados fictícios).', carregar: () => chamar<string>('modelos:previa-pdf', editando?.corpo ?? '') })}
              >
                <Eye className="size-4" aria-hidden="true" /> Pré-visualizar PDF
              </Button>
              <DialogClose asChild><Button variant="ghost" type="button">Cancelar</Button></DialogClose>
              <Button variant="primary" type="submit" disabled={salvandoModelo}>{salvandoModelo ? 'Salvando…' : 'Salvar'}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ação destrutiva nunca dispara direto no clique -- sempre confirma antes (design-system.md §5) */}
      <Dialog open={!!excluindo} onOpenChange={(open) => { if (!open) setExcluindo(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Excluir modelo</DialogTitle>
            <DialogDescription>
              Excluir <b>{excluindo?.nome}</b>?{excluindo?.padrao && ' Este é o modelo padrão: sem ele, o PDF passa a sair sem o texto de abertura.'}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose asChild><Button variant="ghost">Cancelar</Button></DialogClose>
            <Button variant="destructive" onClick={excluirModelo}>Excluir</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

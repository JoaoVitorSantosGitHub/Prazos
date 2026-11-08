import * as React from 'react';
import { ImageIcon, RotateCcw, Save, Trash2, Upload } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PdfPaginas } from '@/components/app-shell/pdf-paginas';
import { chamar } from '@/lib/api';
import { cn } from '@/lib/utils';

interface Cores { faixaSuperior: string; titulo: string; destaque: string; critico: string; atencao: string; mensagem: string; segundoPeriodo: string; aniversario: string }
export interface Aparencia {
  contatoAjuda: string;
  logo: { visivel: boolean; imagem: string | null; largura: number };
  marcaDagua: { visivel: boolean; imagem: string | null; opacidade: number; tamanho: number };
  rodape: { modo: 'imagem' | 'texto'; imagem: string | null; textoEsquerda: string; textoDireita: string; barra: boolean };
  cores: Cores;
}
interface Resposta { aparencia: Aparencia; personalizada: boolean; padrao: Aparencia }

const ROTULOS_CORES: { chave: keyof Cores; rotulo: string; dica: string }[] = [
  { chave: 'faixaSuperior', rotulo: 'Faixa do topo', dica: 'Linha fina no alto de cada página' },
  { chave: 'titulo', rotulo: 'Título', dica: 'Faixa do título e barra do rodapé' },
  { chave: 'destaque', rotulo: 'Destaque', dica: 'Linha sob o título e alerta de contrato' },
  { chave: 'critico', rotulo: 'Férias com risco', dica: 'Alertas críticos (os tons de fundo saem dela)' },
  { chave: 'atencao', rotulo: 'Prazos regulares', dica: 'Alertas de férias com prazo folgado' },
  { chave: 'segundoPeriodo', rotulo: '2º período de férias', dica: 'Título da seção Vencimento de 2º Período de Férias' },
  { chave: 'aniversario', rotulo: 'Aniversariantes', dica: 'Título da seção Aniversariantes do Mês' },
  { chave: 'mensagem', rotulo: 'Texto do modelo', dica: 'Quadro do texto de abertura e de ajuda' },
];

/** Campo de imagem: miniatura (fundo xadrez, pra enxergar transparência), "Escolher imagem…" e "Remover". */
function ImagemCampo({ valor, vazio, titulo, onChange }: { valor: string | null; vazio: string; titulo: string; onChange: (v: string | null) => void }) {
  const [erro, setErro] = React.useState<string | null>(null);
  async function escolher() {
    setErro(null);
    try {
      const nova = await chamar<string | null>('aparencia:escolher-imagem', titulo);
      if (nova) onChange(nova);
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não foi possível abrir a imagem.');
    }
  }
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-3">
        <div
          className="flex h-16 w-28 shrink-0 items-center justify-center overflow-hidden rounded-[var(--radius)] border border-border"
          style={{ backgroundImage: 'repeating-conic-gradient(#8884 0% 25%, transparent 0% 50%)', backgroundSize: '12px 12px' }}
        >
          {valor ? <img src={valor} alt="" className="max-h-full max-w-full object-contain" /> : <ImageIcon className="size-5 text-muted-foreground" aria-hidden="true" />}
        </div>
        <div className="flex flex-col items-start gap-1.5">
          <Button type="button" variant="secondary" size="sm" onClick={escolher}><Upload className="size-4" aria-hidden="true" /> {valor ? 'Trocar imagem…' : 'Escolher imagem…'}</Button>
          {valor && <Button type="button" variant="ghost" size="sm" onClick={() => onChange(null)}><Trash2 className="size-4" aria-hidden="true" /> Remover</Button>}
        </div>
      </div>
      {!valor && <p className="text-xs text-muted-foreground">{vazio}</p>}
      {erro && <p className="text-xs text-destructive">{erro}</p>}
    </div>
  );
}

function Deslizante({ rotulo, valor, min, max, passo = 1, unidade, onChange }: { rotulo: string; valor: number; min: number; max: number; passo?: number; unidade: string; onChange: (v: number) => void }) {
  return (
    <label className="flex flex-col gap-1 text-sm">
      <span className="flex items-center justify-between"><span className="font-medium">{rotulo}</span><span className="text-xs tabular-nums text-muted-foreground">{valor}{unidade}</span></span>
      <input type="range" min={min} max={max} step={passo} value={valor} onChange={(e) => onChange(Number(e.target.value))} className="w-full" />
    </label>
  );
}

function Interruptor({ rotulo, marcado, onChange }: { rotulo: string; marcado: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center gap-2 text-sm font-medium">
      <input type="checkbox" className="size-4" checked={marcado} onChange={(e) => onChange(e.target.checked)} />
      {rotulo}
    </label>
  );
}

/**
 * Aparência do relatório em PDF: logo no canto superior esquerdo, marca d'água, rodapé e cores. É uma só por instalação:
 * vale pra todos os relatórios (uma empresa, lote e pré-visualizações). A prévia ao lado é o PDF de verdade, com uma
 * empresa de exemplo, e se atualiza sozinha enquanto você mexe.
 */
export function AparenciaPanel() {
  const [padrao, setPadrao] = React.useState<Aparencia | null>(null);
  const [ap, setAp] = React.useState<Aparencia | null>(null);
  const [salva, setSalva] = React.useState('');
  const [apPrevia, setApPrevia] = React.useState<Aparencia | null>(null);
  const [salvando, setSalvando] = React.useState(false);
  const [msg, setMsg] = React.useState<{ ok: boolean; texto: string } | null>(null);

  React.useEffect(() => {
    chamar<Resposta>('aparencia:obter').then((r) => { setPadrao(r.padrao); setAp(r.aparencia); setApPrevia(r.aparencia); setSalva(JSON.stringify(r.aparencia)); }).catch((e) => setMsg({ ok: false, texto: e instanceof Error ? e.message : 'Não foi possível carregar a aparência.' }));
  }, []);

  // a prévia espera ~0,7 s sem mexidas antes de gerar o PDF de novo
  React.useEffect(() => {
    if (!ap) return;
    const id = setTimeout(() => setApPrevia(ap), 700);
    return () => clearTimeout(id);
  }, [ap]);

  const alterada = ap !== null && JSON.stringify(ap) !== salva;
  const alterar = (f: (a: Aparencia) => Aparencia) => { setMsg(null); setAp((a) => (a ? f(a) : a)); };

  async function salvar() {
    if (!ap) return;
    setSalvando(true);
    setMsg(null);
    try {
      const gravada = await chamar<Aparencia>('aparencia:salvar', ap);
      setAp(gravada);
      setSalva(JSON.stringify(gravada));
      setMsg({ ok: true, texto: 'Aparência salva. Vale pra todos os próximos PDFs.' });
    } catch (e) {
      setMsg({ ok: false, texto: e instanceof Error ? e.message : 'Não foi possível salvar.' });
    } finally {
      setSalvando(false);
    }
  }

  async function restaurar() {
    if (!window.confirm('Voltar a aparência ao padrão do app (sem logo e sem marca d’água)? As suas imagens e textos serão apagados.')) return;
    try {
      const p = await chamar<Aparencia>('aparencia:restaurar');
      setAp(p);
      setSalva(JSON.stringify(p));
      setMsg({ ok: true, texto: 'Aparência restaurada ao padrão.' });
    } catch (e) {
      setMsg({ ok: false, texto: e instanceof Error ? e.message : 'Não foi possível restaurar.' });
    }
  }

  if (!ap || !padrao) return <p className="text-sm text-muted-foreground">{msg?.texto ?? 'Carregando…'}</p>;

  return (
    <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,28rem)_minmax(0,1fr)]">
      <div className="flex flex-col gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Logo</CardTitle>
            <CardDescription>Aparece no canto superior esquerdo de todas as páginas.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <ImagemCampo valor={ap.logo.imagem} titulo="Escolher o logo" vazio="Sem logo. Use um PNG (de preferência com fundo transparente) ou JPEG de até 3 MB." onChange={(v) => alterar((a) => ({ ...a, logo: { ...a.logo, imagem: v } }))} />
            <Interruptor rotulo="Mostrar o logo" marcado={ap.logo.visivel} onChange={(v) => alterar((a) => ({ ...a, logo: { ...a.logo, visivel: v } }))} />
            <Deslizante rotulo="Largura" valor={ap.logo.largura} min={60} max={280} unidade=" pt" onChange={(v) => alterar((a) => ({ ...a, logo: { ...a.logo, largura: v } }))} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Marca d’água</CardTitle>
            <CardDescription>Imagem clara no centro das páginas, atrás do conteúdo.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <ImagemCampo valor={ap.marcaDagua.imagem} titulo="Escolher a marca d’água" vazio="Sem marca d’água. Use uma imagem PNG ou JPEG; a opacidade abaixo deixa ela discreta." onChange={(v) => alterar((a) => ({ ...a, marcaDagua: { ...a.marcaDagua, imagem: v } }))} />
            <Interruptor rotulo="Mostrar a marca d’água" marcado={ap.marcaDagua.visivel} onChange={(v) => alterar((a) => ({ ...a, marcaDagua: { ...a.marcaDagua, visivel: v } }))} />
            <Deslizante rotulo="Opacidade" valor={Math.round(ap.marcaDagua.opacidade * 100)} min={2} max={100} unidade="%" onChange={(v) => alterar((a) => ({ ...a, marcaDagua: { ...a.marcaDagua, opacidade: v / 100 } }))} />
            <Deslizante rotulo="Tamanho (largura da página)" valor={ap.marcaDagua.tamanho} min={20} max={100} unidade="%" onChange={(v) => alterar((a) => ({ ...a, marcaDagua: { ...a.marcaDagua, tamanho: v } }))} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Rodapé</CardTitle>
            <CardDescription>Endereço e contatos do escritório, no pé de todas as páginas.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <div role="group" aria-label="Tipo de rodapé" className="inline-flex w-fit gap-0.5 rounded-[var(--radius)] border border-border bg-muted p-0.5">
              {(['texto', 'imagem'] as const).map((m) => (
                <button
                  key={m} type="button" aria-pressed={ap.rodape.modo === m}
                  onClick={() => alterar((a) => ({ ...a, rodape: { ...a.rodape, modo: m } }))}
                  className={cn('rounded-md px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground', ap.rodape.modo === m && 'bg-card text-foreground shadow-sm')}
                >
                  {m === 'texto' ? 'Texto' : 'Imagem'}
                </button>
              ))}
            </div>
            {ap.rodape.modo === 'texto' ? (
              <>
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="flex flex-col gap-1.5 text-sm font-medium">Bloco da esquerda
                    <textarea rows={3} maxLength={300} value={ap.rodape.textoEsquerda} onChange={(e) => alterar((a) => ({ ...a, rodape: { ...a.rodape, textoEsquerda: e.target.value } }))} placeholder={'Rua Exemplo, 100 - Sala 1\nCidade - UF'} className="rounded-[var(--radius)] border border-border bg-card p-2 text-sm font-normal" />
                  </label>
                  <label className="flex flex-col gap-1.5 text-sm font-medium">Bloco da direita
                    <textarea rows={3} maxLength={300} value={ap.rodape.textoDireita} onChange={(e) => alterar((a) => ({ ...a, rodape: { ...a.rodape, textoDireita: e.target.value } }))} placeholder={'contato@escritorio.com.br\n(00) 0000-0000'} className="rounded-[var(--radius)] border border-border bg-card p-2 text-sm font-normal" />
                  </label>
                </div>
                <Interruptor rotulo="Barra colorida na base da página" marcado={ap.rodape.barra} onChange={(v) => alterar((a) => ({ ...a, rodape: { ...a.rodape, barra: v } }))} />
              </>
            ) : (
              <ImagemCampo valor={ap.rodape.imagem} titulo="Escolher a imagem do rodapé" vazio="Uma faixa na largura da página (por exemplo 1800 × 220 px) com endereço, ícones e contatos, como o seu papel timbrado." onChange={(v) => alterar((a) => ({ ...a, rodape: { ...a.rodape, imagem: v } }))} />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Cores</CardTitle>
            <CardDescription>Clique na cor para trocar. Os tons de fundo dos cartões saem da cor escolhida.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <div className="grid gap-3 sm:grid-cols-2">
              {ROTULOS_CORES.map(({ chave, rotulo, dica }) => (
                <label key={chave} className="flex items-center gap-3 text-sm">
                  <input type="color" value={ap.cores[chave]} onChange={(e) => alterar((a) => ({ ...a, cores: { ...a.cores, [chave]: e.target.value.toUpperCase() } }))} className="h-9 w-12 shrink-0 cursor-pointer rounded border border-border bg-transparent p-0.5" />
                  <span className="min-w-0"><span className="block font-medium">{rotulo}</span><span className="block truncate text-xs text-muted-foreground" title={dica}>{dica}</span></span>
                </label>
              ))}
            </div>
            <div><Button type="button" variant="ghost" size="sm" onClick={() => alterar((a) => ({ ...a, cores: { ...padrao.cores } }))}><RotateCcw className="size-4" aria-hidden="true" /> Restaurar as cores padrão</Button></div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Contato de ajuda</CardTitle>
            <CardDescription>Telefone ou WhatsApp do quadro “Precisa de ajuda com esses dados?” no fim do relatório. Em branco, o quadro não aparece.</CardDescription>
          </CardHeader>
          <CardContent>
            <Input value={ap.contatoAjuda} maxLength={60} onChange={(e) => alterar((a) => ({ ...a, contatoAjuda: e.target.value }))} placeholder="(00) 90000-0000" />
          </CardContent>
        </Card>

        <div className="sticky bottom-0 z-10 flex flex-wrap items-center gap-3 rounded-[var(--radius)] border border-border bg-card p-3 shadow-md">
          <Button type="button" variant="primary" onClick={salvar} loading={salvando} disabled={!alterada}><Save className="size-4" aria-hidden="true" /> Salvar aparência</Button>
          <Button type="button" variant="ghost" onClick={() => setAp(JSON.parse(salva))} disabled={!alterada}>Desfazer</Button>
          <Button type="button" variant="ghost" onClick={restaurar}>Restaurar padrão</Button>
          {msg ? <span className={cn('text-sm', msg.ok ? 'text-success' : 'text-destructive')}>{msg.texto}</span> : alterada && <span className="text-sm text-warning">Alterações ainda não salvas.</span>}
        </div>
      </div>

      <div className="xl:sticky xl:top-0">
        <Card>
          <CardHeader>
            <CardTitle>Prévia</CardTitle>
            <CardDescription>O PDF de verdade, com uma empresa de exemplo (dados fictícios). Atualiza sozinho.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="max-h-[78vh] overflow-y-auto rounded-[var(--radius)] bg-secondary/50 p-3">
              {apPrevia && <PdfPaginas carregar={() => chamar<string>('modelos:previa-pdf', null, apPrevia)} chave={JSON.stringify(apPrevia)} />}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

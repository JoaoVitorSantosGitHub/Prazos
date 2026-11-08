import { useTheme } from 'next-themes';
import { Check } from 'lucide-react';
import { TEMAS, type Tema } from '@/lib/temas';
import { cn } from '@/lib/utils';

/** Miniatura do próprio app (menu, quatro indicadores e linhas verde/vermelha/amarela) pintada com as cores do tema. */
function Miniatura({ t }: { t: Tema }) {
  const c = t.cores;
  const indicadores = [c.acc, c.ok, c.bad, c.warn];
  const linhas = [c.ok, c.bad, c.warn, c.ok];
  return (
    <div aria-hidden="true" className="flex h-36 overflow-hidden rounded-[10px] border" style={{ background: c.bg, borderColor: c.line }}>
      <div className="flex w-14 flex-col gap-1.5 border-r p-2" style={{ background: c.side, borderColor: c.line }}>
        <div className="size-4 rounded" style={{ background: c.acc }} />
        {[0, 1, 2].map((i) => <div key={i} className="h-1.5 rounded-full" style={{ background: i === 0 ? c.acc : c.line }} />)}
      </div>
      <div className="flex flex-1 flex-col gap-2 p-2">
        <div className="h-2 w-1/3 rounded-full" style={{ background: c.txt, opacity: 0.8 }} />
        <div className="grid grid-cols-4 gap-1.5">
          {indicadores.map((cor, i) => (
            <div key={i} className="rounded border-l-[3px] p-1" style={{ background: c.card, borderColor: c.line, borderLeftColor: cor }}>
              <div className="h-2.5 w-3/4 rounded-sm" style={{ background: cor }} />
              <div className="mt-1 h-1 w-full rounded-full" style={{ background: c.mut, opacity: 0.5 }} />
            </div>
          ))}
        </div>
        <div className="flex flex-1 flex-col justify-between rounded border p-1" style={{ background: c.card, borderColor: c.line }}>
          {linhas.map((cor, i) => (
            <div key={i} className="flex items-center gap-1 border-l-[3px] pl-1" style={{ borderLeftColor: cor }}>
              <div className="h-1.5 flex-1 rounded-full" style={{ background: c.mut, opacity: 0.45 }} />
              <div className="h-1.5 w-6 rounded-full" style={{ background: cor }} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function TemasPage() {
  const { theme, setTheme } = useTheme();
  return (
    <div className="mx-auto flex w-full max-w-[1500px] flex-col gap-6">
      <header>
        <h1 className="text-[22px] font-bold tracking-tight">Temas</h1>
        <p className="mt-1 text-sm text-muted-foreground">Escolha o visual do app. A troca é imediata e fica lembrada neste computador.</p>
      </header>
      <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
        {TEMAS.map((t) => {
          const ativo = theme === t.id;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setTheme(t.id)}
              aria-pressed={ativo}
              className={cn(
                'cartao-jvs flex flex-col gap-3 border bg-card p-4 text-left transition-transform duration-150 hover:-translate-y-0.5',
                ativo ? 'border-primary ring-2 ring-primary/40' : 'border-border'
              )}
            >
              <Miniatura t={t} />
              <div className="flex items-center justify-between gap-2">
                <span className="text-[15px] font-semibold">{t.nome}</span>
                {ativo && (
                  <span className="inline-flex items-center gap-1 rounded-full border border-primary bg-primary/10 px-2.5 py-0.5 text-xs font-bold text-primary">
                    <Check className="size-3" aria-hidden="true" /> Em uso
                  </span>
                )}
              </div>
              <p className="text-sm text-muted-foreground">{t.frase}</p>
            </button>
          );
        })}
      </div>
    </div>
  );
}
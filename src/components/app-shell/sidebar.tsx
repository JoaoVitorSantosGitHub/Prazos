import * as React from 'react';
import { ChevronsLeft, ChevronsRight, FileText, Palette, Plug, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Logo } from '@/components/app-shell/logo';

export type Pagina = 'conexao' | 'relatorio' | 'temas';

const ITENS_NAV: { pagina: Pagina; rotulo: string; icone: LucideIcon }[] = [
  { pagina: 'conexao', rotulo: 'Conexão', icone: Plug },
  { pagina: 'relatorio', rotulo: 'Relatório', icone: FileText },
  { pagina: 'temas', rotulo: 'Temas', icone: Palette },
];

// Lembra se o menu está recolhido (só ícones) -- só vale em telas largas.
const CHAVE_COLAPSADA = 'sidebar-colapsada';

interface SidebarProps {
  pagina: Pagina;
  onNavegar: (pagina: Pagina) => void;
  /** Abaixo do breakpoint md, a sidebar vira uma gaveta sobreposta -- esses dois props controlam ela. */
  abertaMobile: boolean;
  onFecharMobile: () => void;
}

// Menu lateral do visual JVS: 230 px (recolhe pra 72 px), logo de 38 px, item ativo com barra de 3 px no destaque.
export function Sidebar({ pagina, onNavegar, abertaMobile, onFecharMobile }: SidebarProps) {
  const [colapsada, setColapsada] = React.useState(false);

  React.useEffect(() => {
    function onKeyDown(e: KeyboardEvent) { if (e.key === 'Escape') onFecharMobile(); }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onFecharMobile]);

  React.useEffect(() => {
    try { setColapsada(localStorage.getItem(CHAVE_COLAPSADA) === '1'); } catch { /* segue expandida */ }
  }, []);

  function alternar() {
    setColapsada((atual) => {
      const novo = !atual;
      try { localStorage.setItem(CHAVE_COLAPSADA, novo ? '1' : '0'); } catch { /* é só conveniência de UI */ }
      return novo;
    });
  }

  return (
    <>
      {abertaMobile && <div className="fixed inset-0 z-40 bg-black/50 md:hidden" onClick={onFecharMobile} aria-hidden="true" />}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 flex h-screen w-[230px] shrink-0 flex-col border-r border-sidebar-border bg-sidebar transition-[transform,width] duration-200',
          'md:sticky md:top-0 md:z-auto md:translate-x-0',
          abertaMobile ? 'translate-x-0' : '-translate-x-full',
          colapsada ? 'md:w-[72px]' : 'md:w-[230px]'
        )}
      >
        <div className={cn('flex items-center gap-3 border-b border-sidebar-border px-4 py-4', colapsada && 'md:justify-center md:px-0')}>
          <Logo className="size-[38px] shrink-0" />
          <div className={cn('flex min-w-0 flex-col leading-tight', colapsada && 'md:hidden')}>
            <span className="truncate text-[15px] font-bold text-sidebar-foreground">Prazos</span>
          </div>
          <button
            type="button"
            onClick={onFecharMobile}
            aria-label="Fechar menu"
            className="ml-auto rounded-[10px] p-1.5 text-sidebar-foreground hover:bg-sidebar-hover md:hidden"
          >
            ✕
          </button>
        </div>

        <nav className="flex flex-1 flex-col gap-1 overflow-y-auto p-3">
          {ITENS_NAV.map((item) => {
            const ativo = pagina === item.pagina;
            const Icone = item.icone;
            return (
              <button
                key={item.pagina}
                type="button"
                onClick={() => { onNavegar(item.pagina); onFecharMobile(); }}
                title={colapsada ? item.rotulo : undefined}
                aria-current={ativo ? 'page' : undefined}
                className={cn(
                  'flex min-h-9 items-center gap-3 rounded-[10px] border-l-[3px] border-transparent px-3 py-2 text-left text-sm text-sidebar-foreground transition-colors duration-150',
                  'hover:bg-sidebar-hover hover:text-sidebar-hover-foreground',
                  ativo && 'border-l-sidebar-active-border bg-sidebar-active font-semibold text-sidebar-active-foreground hover:bg-sidebar-active hover:text-sidebar-active-foreground',
                  colapsada && 'md:justify-center md:px-0'
                )}
              >
                <Icone className="size-[18px] shrink-0" strokeWidth={1.8} aria-hidden="true" />
                <span className={cn('truncate', colapsada && 'md:hidden')}>{item.rotulo}</span>
              </button>
            );
          })}
        </nav>

        <div className="hidden border-t border-sidebar-border p-3 md:block">
          <button
            type="button"
            onClick={alternar}
            aria-label={colapsada ? 'Expandir menu' : 'Recolher menu'}
            title={colapsada ? 'Expandir menu' : undefined}
            className={cn(
              'flex min-h-9 w-full items-center gap-3 rounded-[10px] px-3 py-2 text-sm text-muted-foreground transition-colors duration-150 hover:bg-sidebar-hover hover:text-sidebar-hover-foreground',
              colapsada && 'justify-center px-0'
            )}
          >
            {colapsada ? <ChevronsRight className="size-[18px]" strokeWidth={1.8} /> : <ChevronsLeft className="size-[18px]" strokeWidth={1.8} />}
            {!colapsada && <span>Recolher menu</span>}
          </button>
        </div>
      </aside>
    </>
  );
}

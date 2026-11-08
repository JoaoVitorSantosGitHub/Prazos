import { Menu } from 'lucide-react';
import { DominioStatus } from '@/components/app-shell/dominio-status';
import type { StatusDominio } from '@/lib/api';

interface TopbarProps {
  conectado: boolean;
  /** abre a gaveta da sidebar -- só o botão de hambúrguer (visível abaixo do md) usa isso */
  onAbrirMenu: () => void;
  onStatus: (status: StatusDominio) => void;
}

// Faixa fina com o estado da conexão com o Domínio (o app não tem login nem usuário).
export function Topbar({ conectado, onAbrirMenu, onStatus }: TopbarProps) {
  return (
    <header className="flex min-h-12 shrink-0 items-center gap-3 border-b border-border bg-card px-4 sm:px-8">
      <button
        type="button"
        onClick={onAbrirMenu}
        aria-label="Abrir menu"
        className="rounded-[10px] p-1.5 text-foreground hover:bg-secondary md:hidden"
      >
        <Menu className="size-5" />
      </button>
      <DominioStatus conectado={conectado} onStatus={onStatus} />
    </header>
  );
}

import * as React from 'react';
import { Sidebar, type Pagina } from '@/components/app-shell/sidebar';
import { Topbar } from '@/components/app-shell/topbar';
import { ConexaoPage } from '@/pages/conexao';
import { RelatorioPage } from '@/pages/relatorio';
import { TemasPage } from '@/pages/temas';
import { chamar, type StatusDominio } from '@/lib/api';

// Mesmo esqueleto do app Folha/Fiscal: sidebar + topbar + área de conteúdo. Sem login e sem rotas: duas telas só.
export function App() {
  const [pagina, setPagina] = React.useState<Pagina>('conexao');
  const [sidebarAberta, setSidebarAberta] = React.useState(false);
  const [conectado, setConectado] = React.useState(false);

  // o app pode ser aberto de novo com a conexão ainda viva (recarregar a janela): confere o estado real
  React.useEffect(() => {
    chamar<{ conectado: boolean }>('conexao:carregar').then((c) => { if (c.conectado) { setConectado(true); setPagina('relatorio'); } }).catch(() => {});
  }, []);

  function aoMudarConexao(status: StatusDominio) {
    setConectado(status.dominioOk);
  }

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar pagina={pagina} onNavegar={setPagina} abertaMobile={sidebarAberta} onFecharMobile={() => setSidebarAberta(false)} />
      <div className="flex h-screen min-w-0 flex-1 flex-col">
        <Topbar conectado={conectado} onAbrirMenu={() => setSidebarAberta(true)} onStatus={aoMudarConexao} />
        <main className="min-w-0 flex-1 overflow-x-hidden overflow-y-auto bg-background px-4 py-5 sm:px-8 sm:py-[26px]">
          {pagina === 'conexao' && <ConexaoPage conectado={conectado} onConectou={() => { setConectado(true); setPagina('relatorio'); }} onDesconectou={() => setConectado(false)} />}
          {pagina === 'temas' && <TemasPage />}
          {pagina === 'relatorio' && (conectado ? <RelatorioPage /> : <SemConexao onIr={() => setPagina('conexao')} />)}
        </main>
      </div>
    </div>
  );
}

function SemConexao({ onIr }: { onIr: () => void }) {
  return (
    <div className="mx-auto max-w-md rounded-[var(--radius)] border border-border bg-card p-6 text-center">
      <div className="mb-1 text-base font-medium">Sem conexão com o Domínio</div>
      <p className="mb-4 text-sm text-muted-foreground">Conecte primeiro para gerar os relatórios.</p>
      <button type="button" onClick={onIr} className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary-hover">Ir para Conexão</button>
    </div>
  );
}

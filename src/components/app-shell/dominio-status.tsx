import * as React from 'react';
import { chamar, type StatusDominio } from '@/lib/api';
import { cn } from '@/lib/utils';

const INTERVALO_VERIFICACAO_MS = 60_000;

/**
 * Indicador de conexão com o Domínio. Se a conexão ODBC morrer (máquina dormiu, rede caiu), o processo principal
 * reabre sozinho na próxima verificação (ver "dominio:status"); aqui só se mostra o resultado.
 */
export function DominioStatus({ conectado: conectadoApp, onStatus }: { conectado: boolean; onStatus: (status: StatusDominio) => void }) {
  const [status, setStatus] = React.useState<StatusDominio | null>(null);

  const aplicar = React.useCallback((s: StatusDominio) => { setStatus(s); onStatus(s); }, [onStatus]);

  const verificar = React.useCallback(async () => {
    try {
      aplicar(await chamar<StatusDominio>('dominio:status'));
    } catch {
      aplicar({ dominioOk: false, mensagem: 'Não foi possível consultar o Domínio.' });
    }
  }, [aplicar]);

  // reverifica quando a tela de Conexão conecta/desconecta, e a cada minuto
  React.useEffect(() => {
    verificar();
    const id = setInterval(verificar, INTERVALO_VERIFICACAO_MS);
    return () => clearInterval(id);
  }, [verificar, conectadoApp]);

  const conectado = status?.dominioOk === true;
  const verificando = status === null;

  return (
    <div className="relative flex items-center gap-2">
      <span
        role="status"
        className="flex items-center gap-1.5 text-xs text-muted-foreground"
        title={conectado && status?.latenciaMs != null ? `Resposta em ${status.latenciaMs}ms` : undefined}
      >
        <span className={cn('h-2 w-2 rounded-full shrink-0', verificando ? 'bg-muted-foreground' : conectado ? 'bg-success' : 'bg-destructive')} />
        <span className="hidden sm:inline">{verificando ? 'Domínio…' : conectado ? 'Domínio conectado' : 'Domínio desconectado'}</span>
      </span>


      {status && !status.dominioOk && status.mensagem && conectadoApp && (
        <div className="absolute left-0 top-full z-40 mt-2 w-[min(22rem,calc(100vw-2rem))] rounded-[var(--radius)] border border-destructive/40 bg-card p-3 text-xs text-foreground shadow-md">
          {status.mensagem}
        </div>
      )}
    </div>
  );
}

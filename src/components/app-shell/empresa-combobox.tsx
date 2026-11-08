import * as React from 'react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { chamar } from '@/lib/api';

const LIMITE_RESULTADOS_BUSCA = 50;

export interface EmpresaDominio {
  codi_emp: number;
  nome_emp: string;
  fantasia_emp: string | null;
  cgce_emp: string | null;
  // dados cadastrais -- usados pra preencher a Configuração a partir da razão social
  razao_emp?: string | null;
  ende_emp?: string | null;
  nume_emp?: number | null;
  comp_emp?: string | null;
  bair_emp?: string | null;
  cida_emp?: string | null;
  esta_emp?: string | null;
  cepe_emp?: string | null;
  /** 'A' = Ativa no Domínio */
  stat_emp?: string | null;
}

/** Carrega a lista de empresas do Domínio uma vez por uso do componente. */
export function useEmpresasDominio() {
  const [empresas, setEmpresas] = React.useState<EmpresaDominio[]>([]);
  const [carregando, setCarregando] = React.useState(true);
  const [erro, setErro] = React.useState<string | null>(null);

  const recarregar = React.useCallback(() => {
    setCarregando(true);
    setErro(null);
    chamar<EmpresaDominio[]>('dominio:empresas')
      .then((lista) => setEmpresas(lista))
      .catch((e) => setErro(e instanceof Error ? e.message : 'Não foi possível carregar a lista de empresas do Domínio.'))
      .finally(() => setCarregando(false));
  }, []);

  React.useEffect(() => { recarregar(); }, [recarregar]);

  return { empresas, carregando, erro, recarregar };
}

/** Mesma regra de busca do combobox: nome/razão/fantasia, CNPJ (só dígitos) ou ID. */
export function buscarEmpresas(empresas: EmpresaDominio[], busca: string, limite: number): EmpresaDominio[] {
  const termoTexto = normalizar(busca.trim());
  const termoDigitos = busca.replace(/\D/g, '');
  if (!termoTexto) return empresas.slice(0, limite);
  return empresas
    .filter((e) => {
      if (normalizar(e.nome_emp).includes(termoTexto)) return true;
      if (e.razao_emp && normalizar(e.razao_emp).includes(termoTexto)) return true;
      if (e.fantasia_emp && normalizar(e.fantasia_emp).includes(termoTexto)) return true;
      if (termoDigitos && e.cgce_emp && e.cgce_emp.includes(termoDigitos)) return true;
      if (termoDigitos && String(e.codi_emp).includes(termoDigitos)) return true;
      return false;
    })
    .slice(0, limite);
}

interface Props {
  value: EmpresaDominio | null;
  onChange: (empresa: EmpresaDominio | null) => void;
  placeholder?: string;
}

export function normalizar(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

export function formatarCnpj(cnpj: string | null): string {
  if (!cnpj || cnpj.length !== 14) return cnpj || '—';
  return `${cnpj.slice(0, 2)}.${cnpj.slice(2, 5)}.${cnpj.slice(5, 8)}/${cnpj.slice(8, 12)}-${cnpj.slice(12)}`;
}

export function rotuloEmpresa(e: EmpresaDominio): string {
  return e.fantasia_emp || e.nome_emp;
}

/**
 * Campo de busca de empresa do Domínio -- por nome, CNPJ ou ID (codi_emp).
 * Usado no import de funcionários e no extrato da folha; centralizado aqui
 * pra não duplicar a lógica de busca/filtro nos dois lugares.
 */
export function EmpresaCombobox({ value, onChange, placeholder }: Props) {
  const { empresas, carregando, erro } = useEmpresasDominio();
  const [busca, setBusca] = React.useState(value ? rotuloEmpresa(value) : '');
  const [listaAberta, setListaAberta] = React.useState(false);
  const containerRef = React.useRef<HTMLDivElement>(null);

  // Mantém o texto do campo em sincronia se o valor for trocado de fora
  // (ex: outro componente reseta a seleção).
  React.useEffect(() => {
    setBusca(value ? rotuloEmpresa(value) : '');
  }, [value]);

  // Fecha a lista ao clicar fora -- não é um <Select> do Radix, é um campo
  // de busca escrito à mão, então esse comportamento é manual.
  React.useEffect(() => {
    if (!listaAberta) return;
    function handler(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setListaAberta(false);
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [listaAberta]);

  const resultados = React.useMemo(() => buscarEmpresas(empresas, busca, LIMITE_RESULTADOS_BUSCA), [busca, empresas]);

  function selecionar(e: EmpresaDominio) {
    onChange(e);
    setBusca(rotuloEmpresa(e));
    setListaAberta(false);
  }

  function handleChangeBusca(valor: string) {
    setBusca(valor);
    if (value) onChange(null);
    setListaAberta(true);
  }

  return (
    <div ref={containerRef} className="relative flex flex-col gap-1.5">
      <Input
        value={busca}
        onChange={(e) => handleChangeBusca(e.target.value)}
        onFocus={() => setListaAberta(true)}
        onKeyDown={(e) => { if (e.key === 'Escape') setListaAberta(false); }}
        disabled={carregando}
        placeholder={carregando ? 'Carregando...' : placeholder || 'Busque por nome, CNPJ ou ID'}
        autoComplete="off"
      />

      {listaAberta && !carregando && (
        <div className="absolute top-full left-0 right-0 z-50 mt-1 max-h-72 overflow-y-auto rounded-[var(--radius)] border border-border bg-card text-card-foreground shadow-md">
          {resultados.length === 0 ? (
            <div className="px-3 py-2 text-sm text-muted-foreground">Nenhuma empresa encontrada.</div>
          ) : (
            resultados.map((e) => (
              <button
                key={e.codi_emp}
                type="button"
                onClick={() => selecionar(e)}
                className={cn(
                  'flex w-full flex-col gap-0.5 px-3 py-2 text-left text-sm transition-colors duration-150 hover:bg-secondary',
                  value?.codi_emp === e.codi_emp && 'bg-secondary'
                )}
              >
                <span className="font-medium">{rotuloEmpresa(e)}</span>
                <span className="text-xs text-muted-foreground">
                  ID {e.codi_emp} · {formatarCnpj(e.cgce_emp)}
                  {e.fantasia_emp && e.fantasia_emp !== e.nome_emp && ` · ${e.nome_emp}`}
                </span>
              </button>
            ))
          )}
          {resultados.length === LIMITE_RESULTADOS_BUSCA && (
            <div className="px-3 py-1.5 text-xs text-muted-foreground border-t border-border">
              Mostrando os {LIMITE_RESULTADOS_BUSCA} primeiros resultados — refine a busca pra achar outra empresa.
            </div>
          )}
        </div>
      )}

      {erro && <p className="text-xs text-destructive">{erro}</p>}
      {value && (
        <p className="text-xs text-muted-foreground">
          Selecionada: ID {value.codi_emp} · {formatarCnpj(value.cgce_emp)}
        </p>
      )}
    </div>
  );
}

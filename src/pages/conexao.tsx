import * as React from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Logo } from '@/components/app-shell/logo';
import { chamar, type StatusDominio } from '@/lib/api';

interface ConfigConexao {
  usuario: string;
  padrao: { driver: string; server: string; database: string; host: string };
  conectado: boolean;
}

/**
 * Conexão com o banco do Domínio (Sybase SQL Anywhere 17, somente leitura). Só usuário e senha vêm da tela -- driver,
 * servidor, banco e endereço já vêm preenchidos (mesmos do Domínio Connect) e ficam em "Avançado". A senha nunca é gravada.
 */
export function ConexaoPage({ conectado, onConectou, onDesconectou }: { conectado: boolean; onConectou: () => void; onDesconectou: () => void }) {
  const [config, setConfig] = React.useState<ConfigConexao | null>(null);
  const [usuario, setUsuario] = React.useState('');
  const [senha, setSenha] = React.useState('');
  const [lembrar, setLembrar] = React.useState(true);
  const [avancado, setAvancado] = React.useState({ driver: '', server: '', database: '', host: '' });
  const [conectando, setConectando] = React.useState(false);
  const [erro, setErro] = React.useState<string | null>(null);
  const [avisoDriver, setAvisoDriver] = React.useState<string | null>(null);
  const [dsns, setDsns] = React.useState<string[]>([]);

  React.useEffect(() => {
    chamar<ConfigConexao>('conexao:carregar').then((c) => {
      setConfig(c);
      setUsuario(c.usuario);
      setAvancado(c.padrao);
    }).catch(() => {});
    chamar<string[]>('conexao:dsns').then(setDsns).catch(() => {});
  }, []);

  async function conectar(e: React.FormEvent | null, dsn?: string) {
    e?.preventDefault();
    setConectando(true);
    setErro(null);
    try {
      const status = await chamar<StatusDominio>('conexao:conectar', dsn ? { dsn } : { usuario: usuario.trim(), senha, lembrar, ...avancado });
      if (status.dominioOk) {
        setSenha('');
        onConectou();
      } else {
        setErro(status.mensagem || 'Não foi possível conectar ao Domínio.');
      }
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Não foi possível conectar ao Domínio.');
    } finally {
      setConectando(false);
    }
  }

  async function desconectar() {
    await chamar('conexao:desconectar').catch(() => {});
    onDesconectou();
  }

  return (
    <div className="mx-auto flex max-w-md flex-col gap-6 pt-4 sm:pt-10">
      <div className="flex flex-col items-center gap-3 text-center">
        <Logo className="size-16 drop-shadow-md" />
        <div>
          <h1 className="text-[22px] font-bold tracking-tight">Prazos</h1>
          <p className="text-sm text-muted-foreground">Relatórios de prazos direto do Domínio</p>
        </div>
      </div>
      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle>Conectar ao Domínio</CardTitle>
          <CardDescription>
            Informe o usuário e a senha do banco do Domínio. O app só <b>lê</b> o banco (nenhum dado é alterado) e a senha não fica gravada neste computador.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!conectado && dsns.length > 0 && (
            <div className="mb-5 flex flex-col gap-2 rounded-[var(--radius)] border border-primary/40 bg-primary/10 p-3 text-sm">
              <p className="font-medium">Conexão já configurada neste PC</p>
              <p className="text-xs text-muted-foreground">É a conexão ODBC do Windows (a mesma que outros sistemas do escritório usam): o usuário, a senha e o servidor já estão guardados nela. É o jeito mais simples: um clique e pronto.</p>
              <div className="flex flex-wrap gap-2">
                {dsns.map((d) => (
                  <Button key={d} type="button" variant="primary" size="sm" loading={conectando} onClick={() => conectar(null, d)}>Entrar com {d}</Button>
                ))}
              </div>
              {erro && <p className="text-sm text-destructive">{erro}</p>}
              <p className="text-xs text-muted-foreground">Ou preencha os dados abaixo.</p>
            </div>
          )}
          <form onSubmit={(e) => conectar(e)} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="usuario" className="text-sm font-medium">Usuário do banco do Domínio</label>
              <Input id="usuario" value={usuario} onChange={(e) => setUsuario(e.target.value)} autoComplete="username" required disabled={conectado} />
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="senha" className="text-sm font-medium">Senha</label>
              <Input id="senha" type="password" value={senha} onChange={(e) => setSenha(e.target.value)} autoComplete="current-password" required disabled={conectado} />
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" className="size-4" checked={lembrar} onChange={(e) => setLembrar(e.target.checked)} disabled={conectado} />
              Lembrar usuário
            </label>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="host" className="text-sm font-medium">Servidor do Domínio (endereço:porta)</label>
              <Input id="host" value={avancado.host} onChange={(e) => setAvancado((a) => ({ ...a, host: e.target.value }))} placeholder="ex.: 192.168.0.10:2638" autoComplete="off" disabled={conectado} />
              <p className="text-xs text-muted-foreground">O endereço do computador onde roda o banco do Domínio (pergunte ao suporte do Domínio ou a quem cuida da rede). Fica lembrado neste PC.</p>
            </div>

            <details className="rounded-[var(--radius)] border border-border p-3 text-sm">
              <summary className="cursor-pointer font-medium">Avançado</summary>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                {([['driver', 'Driver ODBC'], ['server', 'Nome do servidor'], ['database', 'Banco']] as const).map(([chave, rotulo]) => (
                  <div key={chave} className="flex flex-col gap-1.5">
                    <label className="text-xs text-muted-foreground">{rotulo}</label>
                    <Input value={avancado[chave]} onChange={(e) => setAvancado((a) => ({ ...a, [chave]: e.target.value }))} disabled={conectado} />
                  </div>
                ))}
              </div>
              {config && <p className="mt-2 text-xs text-muted-foreground">Já vêm com os nomes da instalação padrão do Domínio; só mude se a sua for diferente.</p>}
            </details>

            {erro && !(dsns.length > 0 && !conectado) && <p className="text-sm text-destructive">{erro}</p>}
            {erro && /não está instalado/i.test(erro) && (
              <div className="flex flex-col gap-2 rounded-[var(--radius)] border border-warning/50 bg-warning/10 p-3 text-sm">
                <p>O app precisa do driver ODBC <b>SQL Anywhere 17</b> neste PC. O instalador abre numa janela do PowerShell e pede permissão de administrador.</p>
                <div><Button type="button" variant="secondary" size="sm" onClick={() => chamar('driver:instalar').then(() => setAvisoDriver('Abri uma janela azul do PowerShell (pode ficar atrás deste app). Siga as instruções lá e, quando terminar, clique em Conectar de novo.')).catch((e) => setErro(e instanceof Error ? e.message : 'Não foi possível abrir o instalador.'))}>Instalar driver ODBC</Button></div>
                {avisoDriver && <p className="text-xs text-foreground">{avisoDriver}</p>}
              </div>
            )}
            {conectado && <p className="text-sm text-success">Conectado ao Domínio. Vá em Relatório para gerar os PDFs.</p>}

            <div className="flex gap-3">
              {conectado ? (
                <Button type="button" variant="destructive" onClick={desconectar}>Desconectar</Button>
              ) : (
                <Button type="submit" variant="primary" size="lg" className="w-full" loading={conectando}>Conectar</Button>
              )}
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

# Prazos

Aplicativo desktop (Electron) que conecta direto ao banco do Domínio (Sybase SQL Anywhere 17, **somente leitura**) e gera o
*Relatório de Vencimentos de Férias, Experiência e Afastamentos* em PDF — a aba **Relatório** do app Folha, sem servidor,
sem banco de dados próprio e sem login.

## O que cada parte reaproveita

| Aqui | Vem de |
|---|---|
| `electron/dominio/db.js`, `queries.js` | `FOLHA\dominio-bridge` (conexão ODBC + consultas de monitoramento) |
| `electron/dominio/dominio.service.ts` | `FOLHA\backend\src\dominio` (sem a ponte HTTP) |
| `electron/relatorio/*` | `FOLHA\backend\src\notificacoes` (avisos, PDF, modelos de texto) |
| `src/pages/relatorio.tsx` e `src/components/ui` | `FOLHA\frontend` (mesmas cores e telas) |
| Tela **Conexão** | `CONEXAO` (Domínio Connect): usuário/senha, driver `SQL Anywhere 17`; o endereço do servidor é informado por cada escritório |

## Documentação
- [Guia de uso](documentacao/guia-de-uso.md) (também em PDF) e vídeo documentacao/prazos-tutorial.mp4.

## Dados locais (pasta do usuário, `%APPDATA%\Prazos`)
- `config.json` — usuário lembrado e pasta de destino dos PDFs (a senha **nunca** é gravada)
- `modelos-relatorio.json` — modelos do texto do relatório
- `aparencia.json` — logo, marca d’água, rodapé e cores do PDF (o app não traz marca de nenhum escritório)

## Comandos
```
npm install
npm run dev     # janela com hot reload
npm start       # build + abre o app
npm test        # testes (regras do relatório)
npm run dist    # gera o instalador em release\Prazos_Setup.exe
```

Requisito no PC: driver ODBC **SQL Anywhere 17** instalado (o mesmo do Domínio Connect). Não precisa de Node.js instalado.

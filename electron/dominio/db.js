const odbc = require('odbc');

// Conexão ODBC com o banco do Domínio (Sybase SQL Anywhere 17), montada aqui, sem depender de DSN pré-configurado no
// Windows. CharSet=utf-8 força o driver a converter de windows-1252 (charset real do banco) pra UTF-8, senão texto
// acentuado vem corrompido. Driver e nomes do servidor/banco são os da instalação padrão do Domínio; o endereço
// (host:porta) é de cada escritório e vem da tela (o app lembra o último que conectou).
const PADRAO = {
    driver: 'SQL Anywhere 17',
    server: 'srvContabil',
    database: 'Contabil',
    host: '',
};

let config = { ...PADRAO, user: '', password: '', dsn: '' };
let pool;

function definirConexao(nova) {
    config = { ...PADRAO, ...nova };
}

// Valor de connection string ODBC entre chaves: ';' e '=' dentro de {...} deixam de ser separadores; '}' literal vira '}}'.
// ATENÇÃO: o driver do SQL Anywhere NÃO entende {chaves} (testado: PWD={1234} dá "Invalid user ID or password", ele
// leva as chaves como parte da senha). Ele aceita aspas simples ou duplas, então protegemos com a que não aparece no valor.
function valorOdbc(valor) {
    const s = String(valor);
    if (!/[;"'{}\s]/.test(s)) return s; // '=' e espaço no meio já passam sem proteção (testado)
    // Testado no driver: aspas protegem espaço, mas com ';' dentro dão "Parse error"; só as chaves passam por ';'.
    if (s.includes(';')) return `{${s.replace(/}/g, '}}')}}`;
    return s.includes('"') ? `'${s}'` : `"${s}"`;
}

function buildConnectionString() {
    // DSN = conexão ODBC já configurada no Windows (com usuário/senha guardados nela); senão monta pelos dados da tela
    let connStr = config.dsn
        ? `DSN=${config.dsn};CharSet=utf-8`
        : `Driver={${config.driver}};ServerName=${config.server};DatabaseName=${config.database};Host=${config.host};CharSet=utf-8`;
    if (config.user) connStr += `;UID=${valorOdbc(config.user)}`;
    if (config.password) connStr += `;PWD=${valorOdbc(config.password)}`;
    return connStr;
}

// Pool em vez de connect() por consulta: o app fica aberto o dia todo, reabrir a conexão ODBC a cada consulta seria
// desperdício. 1-5 conexões é suficiente pra um uso desktop.
async function getPool() {
    if (!pool) pool = await odbc.pool({ connectionString: buildConnectionString(), initialSize: 1, maxSize: 5 });
    return pool;
}

// SELECT apenas -- nunca usar esta função pra INSERT/UPDATE/DELETE/DDL. O usuário ODBC do Domínio é do tipo "Externo"
// (somente leitura), mas a restrição vale como regra do código também, não só do lado do banco.
async function query(sql, params = []) {
    const p = await getPool();
    return p.query(sql, params);
}

// Promise.race com timeout -- uma conexão "morta" (máquina que dormiu, rede que caiu) pode simplesmente não responder em
// vez de dar erro, e sem limite isso travaria o botão de reconectar indefinidamente.
function comTimeout(promessa, ms, mensagem) {
    let timer;
    const limite = new Promise((_, rejeitar) => { timer = setTimeout(() => rejeitar(new Error(mensagem)), ms); });
    return Promise.race([promessa, limite]).finally(() => clearTimeout(timer));
}

// Consulta mínima só pra provar que a conexão está viva E que o usuário ODBC enxerga o schema do Domínio. Devolve a latência em ms.
async function verificar() {
    const inicio = Date.now();
    await comTimeout(query('SELECT TOP 1 codi_emp FROM bethadba.geempre'), 15000, 'O Domínio não respondeu em 15s.');
    return Date.now() - inicio;
}

async function fechar() {
    const antigo = pool;
    pool = undefined;
    if (antigo) {
        try { await comTimeout(antigo.close(), 5000, 'timeout ao fechar o pool antigo'); } catch { /* pool já morto, segue */ }
    }
}

// Descarta o pool atual (o que costuma travar depois de sleep/queda de rede) e abre um novo.
async function reconectar() {
    await fechar();
    return verificar();
}

module.exports = { PADRAO, definirConexao, query, verificar, reconectar, fechar };

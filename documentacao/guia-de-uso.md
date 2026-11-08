# Prazos — Guia de uso

O **Prazos** é um aplicativo para Windows que lê o banco do Domínio (**somente leitura**) e gera, em PDF, o
**Relatório de Vencimentos de Férias, Experiência e Afastamentos** de cada empresa: de uma empresa, de várias ou de todas as ativas de uma só vez.

> Não tem login, não tem servidor e não tem banco de dados próprio. Tudo roda no seu computador.
> Vídeo com o passo a passo, incluindo a entrega pelo Gestta: **prazos-tutorial.mp4** (mesma pasta deste guia).

---

## 1. Antes de começar

| Você precisa de | Como conferir |
|---|---|
| Windows 10 ou 11 (64 bits) | — |
| Driver ODBC **SQL Anywhere 17** (64 bits) | O mesmo usado pelo Domínio Connect. Se faltar, o próprio app oferece o botão **Instalar driver ODBC** (ver seção 3). |
| Acesso de rede ao servidor do Domínio | O PC precisa alcançar o servidor do Domínio (endereço:porta, normalmente porta 2638). Peça o endereço ao suporte do Domínio ou a quem cuida da rede. |
| Usuário e senha do banco do Domínio | O mesmo usuário "Externo" (somente leitura) usado em outros sistemas que leem o Domínio. |

## 2. Instalação

1. Execute **Prazos_Setup.exe**.
2. Escolha a pasta de instalação (ou deixe a sugerida) e conclua. O instalador cria o atalho **Prazos** na Área de Trabalho e no Menu Iniciar.
3. O Windows pode mostrar o aviso "O Windows protegeu o computador" (SmartScreen), porque o instalador não é assinado digitalmente. Clique em **Mais informações → Executar assim mesmo**.

**Atualizar:** rode o novo `Prazos_Setup.exe` por cima; os modelos e a pasta de destino são mantidos.
**Desinstalar:** Configurações do Windows → Aplicativos → Prazos.

Dados guardados neste computador (pasta `%APPDATA%\Prazos`): `config.json` (usuário e servidor lembrados e pasta de destino), `modelos-relatorio.json` (modelos de texto), `aparencia.json` (logo, marca d’água, rodapé e cores do PDF) e `listas-empresas.json` (suas listas de empresas). **A senha nunca é gravada.**

## 3. Conexão com o Domínio

![Tela Conexão](img/01-conexao.png)

1. Abra o **Prazos**. A primeira tela é **Conexão**.
2. Informe o **usuário** e a **senha** do banco do Domínio. Marque **Lembrar usuário** se quiser que o usuário já venha preenchido na próxima vez (a senha você digita sempre).
3. Clique em **Conectar**. Quando der certo, o app abre direto na tela **Relatório**.

![Conexão preenchida, com a área Avançado aberta](img/02-conexao-preenchida.png)

**Sem digitar senha:** se este PC já tem uma conexão ODBC do Windows para o Domínio (a mesma que outros sistemas do escritório usam), aparece no topo o quadro **Conexão já configurada neste PC** com o botão **Entrar com** o nome da conexão. O usuário e a senha já estão guardados nessa conexão, então não precisa digitar nada.

**Servidor do Domínio:** o endereço do computador onde roda o banco, com a porta (ex.: `192.168.0.10:2638`). O app já preenche sozinho se achar o endereço nas conexões ODBC deste PC; senão, informe uma vez e ele fica lembrado.

**Avançado:** driver (`SQL Anywhere 17`), nome do servidor (`srvContabil`) e banco (`Contabil`). Já vêm com os nomes da instalação padrão do Domínio; só mude se a sua for diferente.

**Indicador no topo:** a bolinha verde "Domínio conectado" mostra que o banco está respondendo. Se a conexão cair (computador dormiu, rede oscilou), o app **tenta reconectar sozinho** a cada verificação (1 minuto). Se não conseguir, o indicador fica vermelho e o Relatório pede para conectar de novo.

**Desconectar:** na tela Conexão, com o app conectado, aparece o botão **Desconectar**.

### Se aparecer "Driver ODBC … não está instalado"
Aparece um aviso amarelo com o botão **Instalar driver ODBC**. Ele abre uma janela do PowerShell com o script de instalação e pede permissão de administrador.
O script procura o instalador (`sqla17*.exe` ou `.msi`) ao lado do script, na pasta **Downloads** ou numa pasta informada; também aceita um link direto. A SAP não oferece download público do driver, então **peça o instalador ao suporte do Domínio** (ou a quem administra o servidor) e coloque na pasta Downloads antes de clicar.

## 4. Gerando relatórios

A tela **Relatório** começa com duas escolhas que valem para tudo:

![Topo da tela Relatório](img/03-relatorio-topo.png)

- **Modelo do texto:** o texto que abre o PDF. *Padrão* usa o modelo marcado como padrão (ou nenhum texto, se não houver).
- **Pasta de destino dos PDFs:** clique em **Escolher…** (ou **Trocar**). Os PDFs são gravados direto lá, por exemplo na pasta do app que sincroniza com o Onvio Processos. Cada arquivo se chama **`ID - CNPJ - Razão social.pdf`**; se já existir um com o mesmo nome, ele é **substituído**. O ícone ao lado abre a pasta.

Abaixo ficam três abas: **Uma empresa**, **Em lote** e **Modelos de texto**.

### 4.1 Uma empresa

1. Na aba **Uma empresa**, digite parte do nome, o CNPJ ou o ID e escolha a empresa na lista.
2. O app consulta o Domínio e mostra a **prévia**: os totais no topo e os alertas.

![Prévia: totais e alertas críticos](img/04-previa-topo.png)

![Prévia: demais alertas](img/05-previa-alertas.png)

3. Clique em **Pré-visualizar PDF** para ver o relatório **exatamente como vai sair**, página por página. Nada é gravado.

![Pré-visualização do PDF](img/06-previa-pdf.png)

4. Clique em **Salvar PDF na pasta**. Se ainda não escolheu a pasta, o Windows pergunta onde salvar.

![PDF salvo](img/07-pdf-salvo.png)

**Atualizar** consulta o Domínio de novo (use depois de alterar algo lá; o app guarda os resultados por até 1 minuto).

### 4.2 Em lote (um PDF por empresa)

![Aba Em lote](img/08-lote.png)

- **Todas as empresas ativas no Domínio** (padrão): gera para todas as empresas com situação *Ativa*. Mostra quantas são.
- **Uma das minhas listas:** gera só para as empresas de uma lista que você montou (ver abaixo).
- **Escolher as empresas:** marque uma a uma, com filtro por nome, CNPJ ou ID (até **1000** por lote).

Atalhos que **marcam** empresas por você (somam às já marcadas):

| Botão | Marca as empresas que… |
|---|---|
| **Com avisos hoje** | têm pelo menos um aviso **hoje**: colaborador que já pode tirar férias, alerta de pagamento em dobro (90, 60 ou 30 dias, ou já vencido), 2º período a vencer, contrato de experiência em andamento ou afastado. Quem só tem aniversariante no mês **não** entra. |
| **Prazos em 3 meses** | têm algum prazo que cai **até daqui a 3 meses**, contando de hoje: limite de gozo de férias, vencimento/limite do 2º período ou fim do contrato de experiência (1º período, quando a prorrogação é só prevista). Prazos já vencidos também entram. Afastamentos e aniversários não contam. |
| **Prazos em 6 meses** | o mesmo, para os próximos 6 meses (inclui tudo o que o de 3 meses marcaria, mais as empresas com prazo folgado). |
| **Limpar seleção** | desmarca tudo. |

Como usar: os botões só **marcam empresas** na lista, com os dados do Domínio no momento do clique; nada é gerado até você exportar. Cada clique **soma** às empresas já marcadas (use "Limpar seleção" para recomeçar), e você pode desmarcar ou marcar mais antes de exportar. Use 3 meses para o que pede ação já e 6 meses para planejar com folga. Dentro do app, o mesmo texto está em "Como funcionam os botões de atalho?", logo abaixo dos botões.

![Atalhos de seleção](img/09-atalhos.png)

Clique em **Salvar PDFs na pasta (N empresas)**. O app gera **4 por vez**, mostra a barra de andamento e o nome do arquivo atual; se uma empresa falhar, **as outras continuam** e, no fim, a mensagem informa quantas foram gravadas e o primeiro erro. **Parar** interrompe o lote.

![Lote em andamento](img/10-lote-andamento.png)

![Lote concluído](img/11-lote-concluido.png)

> O lote exige a pasta de destino escolhida.

**Listas personalizadas de empresas.** Em escritórios em que cada pessoa cuida de uma carteira de empresas, salve uma **lista** para cada uma e gere só aquelas empresas, sem marcar tudo de novo a cada vez:

1. Em **Escolher as empresas**, marque as empresas da carteira (use o filtro, os atalhos ou os dois).
2. Clique em **Salvar como lista…**, digite o nome (por exemplo, *Carteira da Ana*) e clique em **Salvar lista**.

![Dando nome à lista](img/21-lista-nome.png)

![Lista salva](img/22-lista-salva.png)

3. Da próxima vez, escolha **Uma das minhas listas**, selecione a lista e clique em **Salvar PDFs na pasta**. Os PDFs saem **na mesma pasta de destino** dos demais relatórios (por exemplo, a pasta do Express).

![Lista escolhida para gerar o lote](img/23-lista-escolhida.png)

Para mudar uma lista, em **Escolher as empresas** use **Carregar uma lista…** (ou **Ver e editar**, na lista escolhida), ajuste as marcações e clique em **Atualizar “nome da lista”**. **Excluir lista** apaga só a lista; as empresas continuam no Domínio.

- O nome da lista é único (maiúsculas e minúsculas não contam). Cada lista guarda até 1000 empresas, e cada computador pode ter até 100 listas.
- A lista guarda só o **código da empresa**. Se alguma empresa deixar de existir no Domínio, ela é ignorada e o app avisa quantas foram.
- As listas ficam no computador e no usuário do Windows de quem as criou (arquivo `listas-empresas.json`). Para usar as mesmas listas em outro computador, copie esse arquivo para a mesma pasta `%APPDATA%\Prazos` de lá.


### 4.3 Modelos de texto

O modelo é o texto que **abre o PDF**, antes dos alertas. Sem modelo, o PDF traz só os alertas.

![Lista de modelos](img/12-modelos.png)

Clique em **+ Novo modelo** (ou **Editar** em um existente):

![Editor de modelo](img/13-editor-modelo.png)

- **Nome:** único. **Texto:** até 1500 caracteres.
- **Formatação:** `*negrito*` e `_itálico_` (a mesma marcação do WhatsApp). Os botões **B** e **I** inserem as marcas.
- **Variáveis** (botões "Inserir:" ou digitadas entre chaves duplas): `{{empresa}}`, `{{id}}`, `{{cnpj}}`, `{{data}}`, `{{quantidade}}` (número de avisos) e `{{avisos}}` (a lista de avisos). Qualquer outra `{{coisa}}` é recusada ao salvar, para não sair "{{empresaa}}" no PDF.
- **Importar do Word…:** traz o texto de um arquivo **.docx** (parágrafos viram linhas; negrito e itálico viram `*…*` e `_…_`; listas viram marcadores). As `{{variáveis}}` escritas no Word valem. Arquivos `.doc` antigos: abra no Word e use *Salvar como → Documento do Word (.docx)*.
- **Usar como padrão no relatório:** só um modelo é o padrão por vez. **Modelo ativo:** desmarque para tirar da lista de escolha sem apagar.
- **Pré-visualizar PDF:** mostra como o PDF fica **com o texto que está no editor** (empresa de exemplo, dados fictícios), sem precisar salvar.

![Pré-visualização do modelo](img/14-previa-modelo.png)

Na lista de modelos, **Visualizar** faz o mesmo para um modelo já salvo, **Editar** altera e **Excluir** pede confirmação.

### 4.4 Aparência do PDF

O app não traz a marca de nenhum escritório: o PDF sai **neutro** (sem logo e sem marca d’água) até você colocar a sua identidade. A aparência é **uma só por instalação** e vale para todos os relatórios (uma empresa, lote e pré-visualizações).

![Aparência do PDF, ainda no padrão](img/17-aparencia-padrao.png)

Na aba **Aparência do PDF**, o formulário fica à esquerda e a **prévia do PDF de verdade** à direita; ela se atualiza sozinha enquanto você mexe.

- **Logo:** imagem PNG (de preferência com fundo transparente) ou JPEG de até 3 MB, no canto superior esquerdo. Ajuste a largura ou desmarque *Mostrar o logo*.
- **Marca d’água:** imagem clara no centro das páginas, atrás do conteúdo. Ajuste a **opacidade** e o **tamanho**.
- **Rodapé:** dois modos. **Texto**: um bloco à esquerda e outro à direita (endereço, e-mail, telefone), mais a barra colorida na base. **Imagem**: uma faixa na largura da página (por exemplo 1800 × 220 px) com o endereço, ícones e contatos do seu papel timbrado.
- **Cores:** faixa do topo, título, destaque (e Alerta de Contrato), férias com risco, prazos regulares, 2º período de férias, aniversariantes e texto do modelo. Os tons de fundo dos cartões saem da cor escolhida. **Restaurar as cores padrão** desfaz só as cores.
- **Contato de ajuda:** o telefone/WhatsApp do quadro "Precisa de ajuda com esses dados?" no fim do relatório. Em branco, o quadro não aparece.

![Papel timbrado de exemplo carregado: logo, marca d’água e rodapé em imagem](img/18-aparencia-papel-timbrado.png)

![Cor do título trocada; a prévia acompanha](img/19-aparencia-cores.png)

Clique em **Salvar aparência** (o aviso "Alterações ainda não salvas" some). **Desfazer** volta ao último salvo e **Restaurar padrão** apaga logo, marca d’água, textos e cores personalizados.

![Aparência salva](img/20-aparencia-salva.png)

Dica: se você já tem um papel timbrado em PDF/imagem, recorte o logo, a marca d’água e o rodapé em arquivos separados (PNG ou JPEG) e carregue cada um no seu campo. Na pasta `documentacao\exemplo-papel-timbrado` há um conjunto de exemplo de um escritório fictício (logo, marca d’água e rodapé) para testar o recurso.

## 5. Entrega pelo Gestta (Express e tarefa recorrente)

Esta parte é opcional: serve para quem usa o **Gestta** (Onvio Gestão) e quer que os PDFs cheguem sozinhos às tarefas dos clientes. O Prazos continua só gerando os arquivos; quem envia é o **Express**, um programa do próprio Gestta.

> Nas imagens desta seção, **e-mail, código de acesso, nomes de clientes e CNPJ, favoritos, endereço do navegador e a área de trabalho foram ocultados com blur.** Vídeo com o passo a passo (cenas finais): **prazos-tutorial.mp4**.

### 5.1 Como funciona

1. O **Prazos** grava os PDFs numa pasta, com o nome `ID - CNPJ - Razão social.pdf`.
2. Essa pasta é a pasta do **Express**. O Express envia cada arquivo para o Gestta.
3. No Gestta, uma **tarefa recorrente** tem o relatório como atividade com anexo, ligado a um **template de documento**. O template confere o conteúdo do PDF e permite a baixa automática da atividade.

Por isso são duas configurações, feitas **uma vez**: entrar no Express (5.2 e 5.3) e preparar a tarefa e o template no Gestta (5.4 e 5.5). Depois disso a rotina é só gerar os PDFs (5.6).

### 5.2 Entrar no Express (código de acesso)

O Express pede login. O jeito mais seguro é o **login por código**, que dispensa a senha.

1. No navegador, entre no **Onvio** e abra **Gestão** pelo menu de aplicações.

![Onvio: página inicial](img/gestta/g01-onvio-inicio.jpg)

![Menu de aplicações do Onvio, com a opção Gestão](img/gestta/g02-onvio-aplicacoes.jpg)

2. Já no Gestta, clique no seu **avatar** (canto inferior esquerdo) e escolha **Código de Acesso**.

![Gestta: painel inicial](img/gestta/g03-gestta-dashboard.jpg)

![Menu do avatar: Perfil, Código de Acesso e Sair](img/gestta/g04-gestta-avatar.jpg)

3. Na janela **Autenticação Gestta**, clique em **Gerar código**. O código aparece na tela e **vale por poucos segundos**; o botão ao lado dele copia o código.

![Código de acesso gerado (ocultado na imagem)](img/gestta/g05-codigo-acesso.jpg)

4. No computador, abra o **Express** pelo ícone da área de trabalho.

![Ícone do Express na área de trabalho](img/gestta/g06-express-icone.jpg)

5. Na tela de login, informe o **e-mail do Gestta** e clique em **Fazer login por Código** (para voltar ao login com senha, o mesmo link vira **Fazer login por Senha**).

![Tela de login do Express](img/gestta/g07-express-login.jpg)

![E-mail informado (ocultado na imagem)](img/gestta/g08-express-email.jpg)

6. Cole o código no campo **Código** e clique em **Entrar**. Se o código expirar, gere outro no Gestta e tente de novo.

![Código colado no Express](img/gestta/g09-express-codigo.jpg)

7. Com o login feito, o Express mostra a mensagem de que os arquivos da pasta foram encaminhados. O botão **LOGOUT**, no canto, encerra a sessão.

![Express conectado](img/gestta/g10-express-pronto.jpg)

### 5.3 A pasta Express e o Prazos

O Express trabalha com uma pasta própria no computador, chamada **Express** (no exemplo, na área de trabalho). **Os arquivos colocados nela são enviados ao Gestta.**

![Pasta Express, ainda vazia](img/gestta/g11-pasta-express.jpg)

No Prazos, na tela **Relatório**, em **Pasta de destino dos PDFs**, clique em **Escolher…** e selecione essa pasta **Express**. A partir daí, **Salvar PDF na pasta** e **Salvar PDFs na pasta** (lote) gravam direto nela, e o Express cuida do envio.

### 5.4 Configurar a tarefa recorrente

1. No Gestta, clique em **Configure**. No quadro **Tarefas recorrentes**, escolha **Gerenciar**.

![Menu Configure do Gestta](img/gestta/g12-menu-configure.jpg)

2. Na lista de recorrentes, use a busca para achar a tarefa pelo nome (aqui, **Relatório de Vencimentos de Férias, Experiência e Afastamentos**). Se ainda não existir, crie com **+ Nova tarefa**.

![Lista de tarefas recorrentes](img/gestta/g13-recorrentes.jpg)

![Busca pelo nome da tarefa](img/gestta/g14-recorrentes-busca.jpg)

3. Clique no nome da tarefa para editar. Na aba **Detalhes**, a configuração usada no exemplo é:

![Edição da tarefa: aba Detalhes](img/gestta/g15-tarefa-detalhes.jpg)

| Campo | Valor no exemplo |
|---|---|
| Nome | Relatório de Vencimentos de Férias, Experiência e Afastamentos |
| Concluir automaticamente a tarefa ao encerrar as atividades | Ligado |
| Esfera | Regime federal |
| Frequência | Semanal |
| Data legal | Segunda-feira |
| Data meta / Competência | 0 |
| Dia útil | Ligado |
| Departamento | Pessoal |
| Notificar o cliente | Por e-mail e por WhatsApp (conforme o seu escritório quiser) |

Os valores dependem da rotina do seu escritório; o que importa para o Prazos é que a tarefa exista, seja recorrente e tenha o template ligado (passos seguintes).

4. Na aba **Clientes**, adicione as empresas que vão receber o relatório. À esquerda ficam os **clientes do sistema** e, à direita, os **clientes da tarefa**; marque as empresas e use **Adicionar** (ou **Excluir** para tirar da tarefa).

![Aba Clientes (nomes e CNPJ ocultados na imagem)](img/gestta/g16-tarefa-clientes.jpg)

5. Na aba **Atividades com anexo**, deve constar o documento **Relatório de Vencimentos de Férias, Experiência e Afastamentos**. Ele é o template de documento que reconhece o PDF e dá a **baixa automática** da atividade. Clique no nome para abrir o template.

![Aba Atividades com anexo](img/gestta/g17-tarefa-anexos.jpg)

### 5.5 Configurar o template do documento

O template diz ao Gestta como reconhecer o PDF do Prazos. Ele fica em **Configure → Templates de Documentos**, e abre também pelo link da atividade com anexo.

1. Abra o documento e vá na aba **Templates**. O modelo aparece na lista, marcado como válido.

![Lista de templates do documento](img/gestta/g18-template-lista.jpg)

2. Abra o template. Em **Conteúdo**, cada linha é um texto que **precisa existir no PDF**; em **Formatos de data**, o formato de data aceito:

![Regras do template](img/gestta/g19-template-regras.jpg)

| Regra | O que confere | Onde está no PDF do Prazos |
|---|---|---|
| Relatório de Vencimentos de Férias, Experiência e Afastamentos | O título | Faixa do título |
| CNPJ | A palavra CNPJ | Linha "ID … · CNPJ …" |
| Empresa | A palavra Empresa | "Empresa: …" |
| Formato de data **DD/MM/AAAA** | A data | "Data de Emissão: dd/mm/aaaa" |

Deixe **Validar pela competência** ligado, como no exemplo.

3. Para **testar**: clique em **Subir modelo e salvar** e escolha um PDF gerado pelo Prazos (por exemplo, o de uma empresa). Depois clique em **Validar modelo e salvar**. Se as quatro verificações ficarem marcadas, o modelo está correto.

![Validações do modelo todas marcadas](img/gestta/g20-template-validacoes.jpg)

4. Clique em **Salvar**. O Gestta avisa que o template foi atualizado.

![Template de documento atualizado](img/gestta/g21-template-salvo.jpg)

> Se alguma verificação falhar, o PDF testado não traz aquele texto. Gere o arquivo de novo pelo Prazos (não renomeie nem edite o PDF) e repita o teste. Se você mudar o **título** ou o texto do relatório em algum momento, a regra do template precisa ser atualizada.

### 5.6 Rotina para enviar os relatórios

1. Abra o **Express** e confira que está logado (se não estiver, faça o login por código, 5.2).
2. Abra o **Prazos** e conecte ao Domínio.
3. Na tela **Relatório**, confira que a **Pasta de destino dos PDFs** é a pasta **Express**.
4. Em **Em lote**, escolha **Uma das minhas listas** (a carteira de cada pessoa) ou marque as empresas (por exemplo, **Com avisos hoje** ou **Prazos em 3 meses**, seção 4.2) e clique em **Salvar PDFs na pasta**.
5. O Express envia os arquivos ao Gestta. Confira no Gestta, na tarefa recorrente, se as atividades foram baixadas.

Se o seu escritório gera o relatório toda semana, faça isso na segunda-feira, que é a data legal da tarefa de exemplo.

### 5.7 Problemas comuns no Gestta e no Express

| Sintoma | O que fazer |
|---|---|
| O código de acesso não é aceito | Ele expira em poucos segundos: gere outro em **Código de Acesso** e cole logo em seguida. |
| O Express volta para a tela de login | A sessão foi encerrada (**LOGOUT** ou tempo); entre de novo por código. |
| O arquivo não chega ao Gestta | Confirme que o Express está logado e que o PDF foi gravado **dentro** da pasta Express (e não em outra pasta). |
| A validação do template falha | Gere o PDF pelo Prazos, sem renomear nem editar, e valide de novo (5.5). |
| A empresa não recebe o relatório | Confira se ela está em **Clientes da tarefa** (5.4). |

## 6. O que o relatório mostra

| Seção | Regra |
|---|---|
| **Férias com risco** | Período aquisitivo completo, com dias pendentes, e prazo limite para gozo **em até 90 dias** (após o prazo, a empresa paga em dobro). Mostra quando o colaborador completa um 2º período. |
| **Prazos regulares de férias** | Mesmo caso, com mais de 90 dias até o limite. |
| **Contratos de experiência** | Contratos em curso. O Domínio grava o contrato inteiro na admissão (ex.: 30 + 60 dias), então enquanto o 1º período não termina a prorrogação é só **prevista**; o alerta usa o prazo que importa agora. |
| **Afastados** | Situação mais recente que não seja Trabalhando, Demitido ou Férias, sem data fim ou com data fim futura. |
| **2º período de férias** | Quem tem 1 período completo sem gozar e está perto de completar o seguinte (janela de 120 dias). |
| **Aniversariantes do mês** | Empregados ativos (com categoria eSocial; sócios com pró-labore ficam de fora). |

**Quem entra:** só **empresas ativas** (situação *A* no Domínio) e **empregados ativos** — o status mais recente no histórico de afastamentos não é *Demitido*.

## 7. Temas

Na tela **Temas**, clique no cartão do visual desejado: **Neon** (padrão), **Grafite**, **Claro**, **Oceano** ou **Rosa**. A troca é imediata e fica lembrada neste computador.

![Tela Temas](img/15-temas.png)

![Tema Claro](img/16-tema-claro.png)

O botão **Recolher menu** (rodapé do menu lateral) deixa só os ícones.

## 8. Problemas comuns

| Sintoma | O que fazer |
|---|---|
| "Driver ODBC … não está instalado" | Use **Instalar driver ODBC** (seção 3). |
| "Usuário ou senha inválidos" ao conectar | Confira usuário e senha com o suporte (precisam ser os do banco do Domínio, não os do sistema). Enquanto isso, use o botão **Entrar com** o nome da conexão, se ele aparecer. |
| Não conecta / demora e dá erro | Confira o endereço do servidor e a porta, e se o PC alcança o servidor (rede/VPN) e se o Domínio está no ar. |
| Indicador vermelho depois de um tempo | A conexão caiu e a reconexão automática não conseguiu: volte em **Conexão** e conecte de novo. |
| "A pasta de destino não existe mais" | Clique em **Trocar** e escolha a pasta de novo. |
| A empresa não aparece na lista | Só aparecem as cadastradas no Domínio; a lista é carregada ao conectar (reconecte para atualizar). |
| PDF sem alertas | A empresa está em dia: o PDF sai só com o texto do modelo e a mensagem de que não há avisos. |
| Um dado "parece errado" | Compare com o cadastro no Domínio (férias, afastamentos) e leve o caso ao suporte; o app só lê o que está no banco. |

## 9. Segurança e privacidade

- O app **só executa consultas de leitura** (SELECT); nunca altera o Domínio.
- A **senha não é gravada** em nenhum lugar; fica só na memória enquanto o app está aberto.
- Os PDFs contêm nomes de empregados: guarde-os em pastas com acesso restrito.
- O Prazos não envia nada para a internet nem para ninguém: ele apenas gera arquivos. O envio ao Gestta (seção 5) é feito pelo **Express**, um programa à parte, só com os arquivos que estiverem na pasta Express.
- No Express, prefira o **login por código** (sem senha) e não compartilhe o código de acesso: ele dá acesso à conta do Gestta por alguns segundos.

## 10. Para quem mantém o projeto

Código em `relatorios-dominio\` (Electron + React + Vite).

```
npm install        # dependências
npm run dev        # janela com recarga automática
npm test           # testes das regras do relatório
npm run dist       # gera release\Prazos_Setup.exe
```

Regravar o vídeo e as capturas deste guia (dados 100% fictícios, nada do Domínio real):

```
npm run build
npx esbuild scripts/demo/pdf-exemplo.ts --bundle --platform=node --external:pdfkit --outfile=scripts/demo/.build/pdf-exemplo.js
powershell -File scripts/demo/narracao.ps1 -Saida <pasta-dos-wav>
npx electron scripts/demo/gravar-demo.js <pasta-dos-wav> documentacao
```

O roteiro da narração está em `scripts/demo/roteiro.json`.

As cenas do Gestta (Express e tarefa) usam duas gravações de tela, `Express.mp4` e `Config Tarefa.mp4` (por padrão em `C:\Users\ti\Videos`; outro caminho em `PRAZOS_VIDEO_EXPRESS` e `PRAZOS_VIDEO_TAREFA`). Os dados sensíveis dessas gravações (e-mail, código, nomes de clientes, favoritos, endereço, área de trabalho) são borrados por `scripts/demo/gestta-blur.js`, que lista as regiões e os intervalos de tempo; **se trocar as gravações, refaça essa lista e confira o resultado**. As capturas do guia (`documentacao\img\gestta`) saem de `scripts/demo/gerar-capturas-gestta.js`. As gravações originais **não** devem ser distribuídas, só o vídeo e as imagens já borrados.

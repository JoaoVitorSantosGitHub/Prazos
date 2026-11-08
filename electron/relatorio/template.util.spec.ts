import { renderizarTemplate, semNegrito, validarCorpoTemplate, variaveisUsadas, TEXTO_PADRAO_AVISOS, TEXTO_PADRAO_RELATORIO, VARIAVEIS_RELATORIO } from './template.util';

const valores = { empresa: 'ACME LTDA', avisos: '• FULANO pode tirar férias', quantidade: '1', data: '08/10/2026' };

describe('template.util', () => {
  it('troca as variáveis (com ou sem espaço dentro das chaves)', () => {
    expect(renderizarTemplate('Olá {{empresa}} / {{ data }}: {{avisos}}', valores)).toBe('Olá *ACME LTDA* / *08/10/2026*: • FULANO pode tirar férias');
  });

  it('o texto padrão embutido é válido e usa só variáveis permitidas', () => {
    expect(validarCorpoTemplate(TEXTO_PADRAO_AVISOS)).toBeNull();
    expect(renderizarTemplate(TEXTO_PADRAO_AVISOS, valores)).not.toContain('{{');
  });

  it('recusa variável desconhecida (erro de digitação) e texto vazio ou grande demais', () => {
    expect(validarCorpoTemplate('Oi {{empresaa}}')).toMatch(/\{\{empresaa\}\}/);
    expect(validarCorpoTemplate('   ')).toMatch(/vazio/);
    expect(validarCorpoTemplate('x'.repeat(1501))).toMatch(/1500/);
  });

  it('empresa, data e quantidade saem em negrito do WhatsApp; avisos já vem marcado linha a linha', () => {
    expect(renderizarTemplate('{{empresa}} tem {{quantidade}} aviso(s) em {{data}}', valores)).toBe('*ACME LTDA* tem *1* aviso(s) em *08/10/2026*');
    expect(renderizarTemplate('{{avisos}}', { ...valores, avisos: '• *FULANO* até *01/01/2027*' })).toBe('• *FULANO* até *01/01/2027*');
  });

  it('se o modelo já pôs o negrito em volta da variável, não dobra; asterisco no valor é removido', () => {
    expect(renderizarTemplate('Olá *{{empresa}}*!', valores)).toBe('Olá *ACME LTDA*!');
    expect(renderizarTemplate('{{empresa}}', { ...valores, empresa: 'A*B' })).toBe('*AB*');
  });

  it('semNegrito tira as marcas', () => {
    expect(semNegrito('• *FULANO* até *01/01/2027*')).toBe('• FULANO até 01/01/2027');
  });

  it('lista cada variável usada uma vez só', () => {
    expect(variaveisUsadas('{{empresa}} {{avisos}} {{empresa}}')).toEqual(['empresa', 'avisos']);
  });

  it('o modelo do relatório aceita {{id}} e {{cnpj}}, que o do WhatsApp recusa', () => {
    expect(validarCorpoTemplate('{{id}} {{cnpj}}')).toMatch(/Variável desconhecida/);
    expect(validarCorpoTemplate('{{id}} {{cnpj}} {{empresa}}', VARIAVEIS_RELATORIO)).toBeNull();
    expect(validarCorpoTemplate(TEXTO_PADRAO_RELATORIO, VARIAVEIS_RELATORIO)).toBeNull();
  });

  it('variável já em itálico no modelo não empilha negrito por cima', () => {
    expect(renderizarTemplate('em _{{data}}_', valores)).toBe('em _08/10/2026_');
  });

  it('id e cnpj também saem em negrito no relatório', () => {
    const v = { ...valores, id: '627', cnpj: '12.345.678/0001-99' };
    expect(renderizarTemplate('ID {{id}} · {{cnpj}}', v)).toBe('ID *627* · *12.345.678/0001-99*');
  });
});
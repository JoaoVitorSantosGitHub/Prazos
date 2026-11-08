import { htmlParaTextoModelo } from './importar-docx';

describe('htmlParaTextoModelo (modelo vindo do Word)', () => {
  it('parágrafos viram linhas, negrito e itálico viram a marcação do modelo', () => {
    expect(htmlParaTextoModelo('<p>Olá <strong>{{empresa}}</strong></p><p>Veja <em>abaixo</em>:</p><p>{{avisos}}</p>')).toBe(
      'Olá *{{empresa}}*\nVeja _abaixo_:\n{{avisos}}'
    );
  });
  it('listas viram marcadores e entidades HTML são desfeitas', () => {
    expect(htmlParaTextoModelo('<ul><li>A &amp; B</li><li>C</li></ul>')).toBe('• A & B\n• C');
  });
  it('espaço dentro do negrito fica fora das marcas', () => {
    expect(htmlParaTextoModelo('<p>x<strong> ID </strong>y</p>')).toBe('x *ID* y');
  });
});

/**
 * Roda `tarefa` pra cada item, no máximo `simultaneas` ao mesmo tempo, na ordem da lista. Um item que falha não derruba os
 * outros: o resultado diz quem deu certo e quem falhou. `cancelado()` é consultado antes de cada item novo.
 */
export async function processarEmFila<T>(
  itens: T[],
  simultaneas: number,
  tarefa: (item: T) => Promise<void>,
  opcoes: { cancelado?: () => boolean; aoTerminarItem?: (item: T, erro: Error | null) => void } = {}
): Promise<{ ok: T[]; falhas: { item: T; erro: Error }[]; naoProcessados: T[] }> {
  const ok: T[] = [];
  const falhas: { item: T; erro: Error }[] = [];
  let proximo = 0;
  async function trabalhador() {
    while (proximo < itens.length && !opcoes.cancelado?.()) {
      const item = itens[proximo++];
      try {
        await tarefa(item);
        ok.push(item);
        opcoes.aoTerminarItem?.(item, null);
      } catch (e) {
        const erro = e instanceof Error ? e : new Error(String(e));
        falhas.push({ item, erro });
        opcoes.aoTerminarItem?.(item, erro);
      }
    }
  }
  await Promise.all(Array.from({ length: Math.max(1, Math.min(simultaneas, itens.length)) }, trabalhador));
  return { ok, falhas, naoProcessados: itens.slice(proximo) };
}
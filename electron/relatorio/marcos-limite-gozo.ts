// Alertas do limite de gozo de férias, em 3 marcos de aproximação: 90, 60 e 30 dias.
// Em cada momento vale UM só marco -- o mais próximo que já foi atingido --, e cada marco
// é avisado uma vez por período (o histórico de avisos impede repetição). Quem já passou
// do prazo continua no marco de 30 dias (a mensagem diz que venceu).
export type TipoMarcoLimiteGozo = 'LIMITE_GOZO_90' | 'LIMITE_GOZO_60' | 'LIMITE_GOZO_30';

export function marcoLimiteGozo(diasAteLimite: number): TipoMarcoLimiteGozo | null {
  if (diasAteLimite <= 30) return 'LIMITE_GOZO_30';
  if (diasAteLimite <= 60) return 'LIMITE_GOZO_60';
  if (diasAteLimite <= 90) return 'LIMITE_GOZO_90';
  return null;
}
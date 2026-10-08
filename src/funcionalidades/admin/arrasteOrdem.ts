/** Índices adjacentes para levar `from` até `to` com trocas de vizinhos. */
export function passosTroca(from: number, to: number): Array<[number, number]> {
  if (from < 0 || to < 0 || from === to) return []
  const passo = from < to ? 1 : -1
  const passos: Array<[number, number]> = []
  for (let i = from; i !== to; i += passo) {
    passos.push([i, i + passo])
  }
  return passos
}

/** O caminho não pode começar, terminar ou atravessar um índice bloqueado. */
export function podeMover(
  from: number,
  to: number,
  bloqueado: (indice: number) => boolean,
): boolean {
  if (from < 0 || to < 0 || from === to) return false
  if (bloqueado(from) || bloqueado(to)) return false
  const passo = from < to ? 1 : -1
  for (let i = from; i !== to; i += passo) {
    if (bloqueado(i + passo)) return false
  }
  return true
}

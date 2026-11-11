/** Chaves dos itens escondidos enquanto uma remoção espera pelo "Anular". */
export const undoKey = {
  scheduled: (id: string) => `scheduled:${id}`,
  shift: (id: string) => `shift:${id}`,
  account: (id: string) => `account:${id}`,
  gear: (id: string) => `gear:${id}`,
  cost: (id: string) => `cost:${id}`,
  snapshot: (id: number) => `snapshot:${id}`,
};

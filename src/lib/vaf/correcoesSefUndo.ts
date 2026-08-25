/**
 * Histórico local das correções em lote de códigos SEF, para permitir desfazer
 * e restaurar o nome cadastrado anterior de cada prefeitura.
 */
export type CorrecaoSefItem = {
  id: string;
  codigoAnterior: string;
  nomeAnterior: string;
  nomeAplicado: string;
};

export type CorrecaoSefLote = {
  loteId: string;
  em: string;
  itens: CorrecaoSefItem[];
};

const CHAVE = "apuravaf:correcoes-sef-lote";
const MAX_LOTES = 5;

function seguro(): Storage | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}

export function lerLotesSef(): CorrecaoSefLote[] {
  const store = seguro();
  if (!store) return [];
  try {
    const bruto = store.getItem(CHAVE);
    if (!bruto) return [];
    const dados = JSON.parse(bruto);
    return Array.isArray(dados) ? (dados as CorrecaoSefLote[]) : [];
  } catch {
    return [];
  }
}

export function registrarLoteSef(itens: CorrecaoSefItem[]): CorrecaoSefLote | null {
  if (itens.length === 0) return null;
  const store = seguro();
  const lote: CorrecaoSefLote = {
    loteId: `${Date.now()}`,
    em: new Date().toISOString(),
    itens,
  };
  if (store) {
    const lotes = [lote, ...lerLotesSef()].slice(0, MAX_LOTES);
    try {
      store.setItem(CHAVE, JSON.stringify(lotes));
    } catch {
      /* ignora quota */
    }
  }
  return lote;
}

export function removerLoteSef(loteId: string) {
  const store = seguro();
  if (!store) return;
  try {
    store.setItem(CHAVE, JSON.stringify(lerLotesSef().filter((l) => l.loteId !== loteId)));
  } catch {
    /* ignora */
  }
}

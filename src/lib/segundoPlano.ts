/**
 * Ajuda tarefas longas do navegador a continuarem com a aba em segundo plano.
 * - `cederVez` substitui setTimeout(0), que o navegador atrasa (1s ou mais) em abas ocultas.
 * - `manterAtivo` segura um Web Lock, que impede o navegador de congelar a aba durante a tarefa.
 */
export function cederVez(): Promise<void> {
  return new Promise((resolve) => {
    if (typeof MessageChannel === "undefined") return void setTimeout(resolve, 0);
    const canal = new MessageChannel();
    canal.port1.onmessage = () => {
      canal.port1.close();
      resolve();
    };
    canal.port2.postMessage(null);
  });
}

let contador = 0;
export async function manterAtivo<T>(tarefa: () => Promise<T>): Promise<T> {
  const locks = typeof navigator !== "undefined" ? navigator.locks : undefined;
  if (!locks?.request) return tarefa();
  contador += 1;
  return locks.request(`tarefa-longa-${contador}`, () => tarefa()) as Promise<T>;
}

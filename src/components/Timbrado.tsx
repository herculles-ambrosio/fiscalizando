import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import marcaAsset from "@/assets/timbrado-logo.png.asset.json";
import marcaDaguaAsset from "@/assets/timbrado-dagua.png.asset.json";

export const CONTATO_HTECH = {
  endereco: "Rua Frederico Dolabela, 703 - Centro - Manhuaçu - MG",
  contatos: "33 98414 2223 | contato@htechminas.com.br | www.htechminas.com.br",
};

/**
 * Camada fixa do timbrado (logo no topo, marca d'água ao centro e faixa no pé).
 * É renderizada via portal no <body> para escapar dos containers flex/overflow
 * do layout; elementos fixos são repetidos pelo navegador em todas as páginas.
 */
function CamadaTimbrado() {
  const [pronto, setPronto] = useState(false);
  useEffect(() => setPronto(true), []);
  if (!pronto || typeof document === "undefined") return null;

  return createPortal(
    <div className="timbrado-fixo" aria-hidden>
      <div className="timbrado-cabecalho">
        <img src={marcaAsset.url} alt="" />
      </div>
      <div className="timbrado-dagua">
        <img src={marcaDaguaAsset.url} alt="" />
      </div>
      <div className="timbrado-rodape">
        <span className="timbrado-rodape-barra" />
        <div className="timbrado-rodape-texto">
          <p>{CONTATO_HTECH.endereco}</p>
          <p>{CONTATO_HTECH.contatos}</p>
        </div>
      </div>
    </div>,
    document.body,
  );
}

/**
 * Papel timbrado H-Tech Minas aplicado a TODOS os relatórios (não aos ofícios,
 * que têm layout próprio em .docx).
 *
 * A tabela em volta do conteúdo apenas reserva o espaço do cabeçalho e do
 * rodapé em cada página impressa (thead/tfoot se repetem); o desenho em si vem
 * da camada fixa acima, sempre alinhada à página.
 */
export function Timbrado({ children }: { children: ReactNode }) {
  return (
    <>
      <CamadaTimbrado />
      <table className="timbrado-tabela">
        <thead className="timbrado-espaco-topo" aria-hidden>
          <tr>
            <td />
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>{children}</td>
          </tr>
        </tbody>
        <tfoot className="timbrado-espaco-pe" aria-hidden>
          <tr>
            <td />
          </tr>
        </tfoot>
      </table>
    </>
  );
}


import marcaAsset from "@/assets/htechminas-marca.png.asset.json";
import marcaDaguaAsset from "@/assets/htechminas-marca-dagua.png.asset.json";

export const CONTATO_HTECH = {
  endereco: "Rua Frederico Dolabela, 703 - Centro - Manhuaçu - MG",
  contatos: "33 98414 2223 | contato@htechminas.com.br | www.htechminas.com.br",
};

/**
 * Papel timbrado H-Tech Minas (cabeçalho, marca d'água e rodapé),
 * exibido somente na impressão / exportação em PDF dos relatórios.
 * Não é usado em ofícios (gerados em .docx com layout próprio).
 */
export function Timbrado() {
  return (
    <>
      <div className="timbrado-cabecalho">
        <img src={marcaAsset.url} alt="" aria-hidden />
        <div className="timbrado-marca">
          <p className="timbrado-marca-nome">
            <strong>H-TECH</strong> MINAS
          </p>
          <p className="timbrado-marca-sub">CONSULTORIA TRIBUTÁRIA</p>
          <p className="timbrado-marca-sub">DESENVOLVIMENTO DE SISTEMAS</p>
        </div>
      </div>

      <div className="timbrado-dagua" aria-hidden>
        <img src={marcaDaguaAsset.url} alt="" />
      </div>

      <div className="timbrado-rodape">
        <span className="timbrado-rodape-barra" />
        <div className="timbrado-rodape-texto">
          <p>{CONTATO_HTECH.endereco}</p>
          <p>{CONTATO_HTECH.contatos}</p>
          <p className="timbrado-rodape-nota">
            Apura VAF 2.0 — relatório gerado em {new Date().toLocaleDateString("pt-BR")}
          </p>
        </div>
      </div>
    </>
  );
}

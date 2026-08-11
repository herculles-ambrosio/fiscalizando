import { Packer } from "docx";
import { writeFileSync } from "fs";
import { construirOficioZerado } from "@/lib/oficios/zerados";

const doc = construirOficioZerado({
  contribuinte: { nome: "SUPERMERCADO EXEMPLO LTDA", cnpj: "12345678000199", inscricao_estadual: "4470123456700", endereco: "AV BRASIL, 1000 - CENTRO - NANUQUE/MG" },
  config: {
    nome_prefeitura: "PREFEITURA MUNICIPAL DE NANUQUE",
    estado: "ESTADO DE MINAS GERAIS",
    secretaria: "SECRETARIA MUNICIPAL DE FAZENDA",
    setor: "SETOR DE TRIBUTAÇÃO E FISCALIZAÇÃO DE RENDAS",
    endereco_rodape: "Rua Francisco Romualdo de Aquino, 155 – Palmeiras",
    cidade_data: "Nanuque/MG",
    signatario_nome: "Fulano de Tal",
    signatario_cargo: "Responsável pelo VAF",
    texto_assinatura: "Secretaria Municipal da Fazenda",
  },
  exercicio: 2024,
  dataOficio: "2026-08-11",
});
Packer.toBuffer(doc).then((b) => { writeFileSync("/tmp/qa/oficio.docx", b); console.log("ok"); });

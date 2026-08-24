import { Document, Packer, Paragraph, TextRun } from "docx";
import { cabecalhoTimbrado, rodapeTimbrado, MARGENS_TIMBRADO } from "./src/lib/reportTimbrado";
import fs from "fs";
const get = async (u: string) => (await fetch("http://localhost:8080" + u)).arrayBuffer();
const marca = await get("/__l5e/assets-v1/3a13dfc3-aae7-45aa-b344-3788034e75df/htechminas-marca.png");
const marcaDagua = await get("/__l5e/assets-v1/352d7bf6-83c5-4dd2-8658-11e4a9794b7f/htechminas-marca-dagua.png");
const doc = new Document({ styles:{default:{document:{run:{font:"Arial",size:20}}}}, sections:[{properties:{page:{margin:MARGENS_TIMBRADO}},headers:{default:cabecalhoTimbrado({marca,marcaDagua})},footers:{default:rodapeTimbrado("Apura VAF 2.0 — teste")},children:[new Paragraph({children:[new TextRun("Conteúdo do relatório de teste ".repeat(60))]})]}]});
fs.writeFileSync("/tmp/qa/out.docx", await Packer.toBuffer(doc));
console.log("ok");

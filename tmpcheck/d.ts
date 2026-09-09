import { readFileSync } from "fs";
import * as XLSX from "xlsx";
import { normalizarTexto } from "../src/lib/icms/esportes/parser";
const wb = XLSX.read(new Uint8Array(readFileSync("/mnt/user-uploads/Índice_Educação._Provisório_2027_-_28-08-26.xlsx")), { type: "array" });
console.log(wb.SheetNames);
const l = XLSX.utils.sheet_to_json<any[]>(wb.Sheets["Consolidado"]!, { header: 1, blankrows: false, defval: null });
console.log(l.slice(0, 8).map(r => r.slice(0,5)));
console.log("norm", normalizarTexto("MUNICÍPIO"), normalizarTexto("Consolidado"));

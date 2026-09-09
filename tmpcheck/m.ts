import { readFileSync } from "fs";
import * as XLSX from "xlsx";
import { canonicalizarMunicipio } from "../src/lib/icms/criterios/municipiosMg";
const wb = XLSX.read(new Uint8Array(readFileSync("/mnt/user-uploads/Índice_Educação._Provisório_2027_-_28-08-26.xlsx")), { type: "array" });
const l = XLSX.utils.sheet_to_json<any[]>(wb.Sheets["Consolidado"]!, { header: 1, blankrows: false, defval: null });
for (const r of l.slice(4)) { const n = r[2]; if (n && !canonicalizarMunicipio(String(n))) console.log("NAO", n, r[0]); }

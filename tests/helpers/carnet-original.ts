/**
 * Harnais anti-régression : exécute le code JavaScript ORIGINAL du carnet
 * (tests/fixtures/carnet-original.html, copie exacte de l'artefact publié)
 * dans un bac à sable Node, sans le modifier, pour comparer ses résultats
 * à ceux de la nouvelle application.
 *
 * Méthode : le script du carnet est analysé avec acorn ; on en extrait les
 * déclarations utiles par leur nom (texte source intact), puis on les exécute
 * avec un faux `$` (sélecteur) qui remplace la page.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import vm from "node:vm";
import * as acorn from "acorn";

/* eslint-disable @typescript-eslint/no-explicit-any */
export type Any = any;

const CHEMIN = fileURLToPath(new URL("../fixtures/carnet-original.html", import.meta.url));

/** Noms des déclarations reprises telles quelles du carnet. */
const NOMS = [
  "num", "fr", "eur", "pc", "esc", "isN",
  "pAtMost", "pOver", "avgs", "lambdaOf", "CTX", "byId",
  "reliability", "missingOf", "analysis", "riskLvl", "evalM1", "evalM3",
  "remL", "calcL1", "calcH1", "calcFB", "calcV3",
  "pnl", "settled", "total", "fullExportText",
];

export interface CarnetOriginal {
  api: Any;
  /** Éléments factices de la page, par sélecteur. */
  els: Record<string, { value: string; checked: boolean; innerHTML: string }>;
  setBets(b: Any[]): void;
  setSettings(s: Any): void;
  setData(d: Any): void;
  setHMode(m: string): void;
  setFbMode(m: string): void;
  setChosen(c: string[]): void;
}

export function chargerCarnetOriginal(): CarnetOriginal {
  const html = readFileSync(CHEMIN, "utf8");
  const debut = html.lastIndexOf("<script>");
  const fin = html.lastIndexOf("</script>");
  const script = html.slice(debut + "<script>".length, fin);
  const ast = acorn.parse(script, { ecmaVersion: "latest" }) as Any;
  const iife = ast.body[0].expression.callee.body.body as Any[];

  const morceaux: string[] = [];
  const trouves = new Set<string>();
  for (const st of iife) {
    let noms: string[] = [];
    if (st.type === "FunctionDeclaration") noms = [st.id.name];
    else if (st.type === "VariableDeclaration") noms = st.declarations.map((d: Any) => d.id.name);
    if (noms.some((n) => NOMS.includes(n))) {
      morceaux.push(script.slice(st.start, st.end));
      noms.forEach((n) => trouves.add(n));
    }
  }
  const absents = NOMS.filter((n) => !trouves.has(n));
  if (absents.length) throw new Error("Déclarations introuvables dans le carnet : " + absents.join(", "));

  const code = `"use strict";
    let bets=[], settings={bank:200,pct:2}, data={matchs:[]}, hMode="contre", fbMode="book", chosen=["Ligue 1","Serie A"];
    const LS={get:(k,d)=>d,set:()=>{}};
    const __els={};
    const $=s=>__els[s]||(__els[s]={value:"",checked:false,innerHTML:""});
    ${morceaux.join("\n")}
    globalThis.__carnet={
      api:{${NOMS.join(",")}},
      els:__els,
      setBets:b=>{bets=b}, setSettings:s=>{settings=s}, setData:d=>{data=d},
      setHMode:m=>{hMode=m}, setFbMode:m=>{fbMode=m}, setChosen:c=>{chosen=c}
    };`;
  const ctx: Any = {};
  vm.createContext(ctx);
  vm.runInContext(code, ctx, { filename: "carnet-original.js" });
  return ctx.__carnet as CarnetOriginal;
}

/** Copie profonde vers le domaine « principal » (les objets du bac à sable ont d'autres prototypes). */
export function versJson<T>(x: T): T {
  return JSON.parse(JSON.stringify(x));
}

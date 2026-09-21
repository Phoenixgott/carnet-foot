/** Enregistre un texte comme fichier dans les téléchargements du téléphone. */
export function telechargerFichier(nom: string, texte: string, mime: string): void {
  const url = URL.createObjectURL(new Blob([texte], { type: mime }));
  const a = document.createElement("a");
  a.href = url;
  a.download = nom;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

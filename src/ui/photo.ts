/**
 * Photo du ticket d'un pari : redimensionnée avant d'être enregistrée, pour rester légère
 * sur ce téléphone (elle n'est jamais envoyée nulle part). Fonctions du navigateur (canvas),
 * donc non testables sans navigateur : couvertes par les tests de bout en bout.
 */

/** Redimensionne une image (jamais agrandie) et la recompresse en JPEG. */
export async function redimensionnerImage(fichier: File | Blob, maxLargeur = 1280, qualite = 0.82): Promise<Blob> {
  const bitmap = await createImageBitmap(fichier);
  try {
    const echelle = Math.min(1, maxLargeur / bitmap.width);
    const largeur = Math.max(1, Math.round(bitmap.width * echelle));
    const hauteur = Math.max(1, Math.round(bitmap.height * echelle));
    const canvas = document.createElement("canvas");
    canvas.width = largeur;
    canvas.height = hauteur;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Impossible de traiter cette image sur ce téléphone.");
    ctx.drawImage(bitmap, 0, 0, largeur, hauteur);
    return await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("Impossible d'enregistrer cette image."))), "image/jpeg", qualite);
    });
  } finally {
    bitmap.close();
  }
}

/** Taille lisible : « 240 Ko », « 1,4 Mo ». */
export function tailleLisible(octets: number): string {
  if (octets < 1024) return `${octets} o`;
  if (octets < 1024 * 1024) return `${Math.round(octets / 1024)} Ko`;
  return `${(octets / 1024 / 1024).toFixed(1).replace(".", ",")} Mo`;
}

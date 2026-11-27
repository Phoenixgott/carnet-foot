// Sauvegarde : export / import JSON.
import { Directory, Encoding, Filesystem } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import { isNative } from './native';
import { normalize } from './store';
import { todayISO } from './defaults';
import type { AppData } from './types';

export interface BackupFile {
  app: 'over15-methode';
  format: 3;
  exportedAt: string;
  data: AppData;
}

export function buildBackup(data: AppData): string {
  const file: BackupFile = { app: 'over15-methode', format: 3, exportedAt: new Date().toISOString(), data: { ...data, settings: { ...data.settings } } };
  return JSON.stringify(file, null, 2);
}

export function backupFileName() {
  return `outsiders-sauvegarde-${todayISO()}.json`;
}

/** Exporte : partage du fichier sur Android (Fichiers, Drive, mail…), téléchargement sur le web. */
export async function exportBackup(data: AppData): Promise<'shared' | 'downloaded'> {
  const json = buildBackup(data);
  const name = backupFileName();
  if (isNative) {
    const res = await Filesystem.writeFile({ path: name, data: json, directory: Directory.Cache, encoding: Encoding.UTF8 });
    await Share.share({ title: 'Sauvegarde Outsiders', text: 'Sauvegarde de mes données Outsiders', files: [res.uri], dialogTitle: 'Enregistrer la sauvegarde' });
    return 'shared';
  }
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
  return 'downloaded';
}

/** Lit un fichier de sauvegarde (ou l'objet de données brut). */
export function parseBackup(text: string): AppData {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new Error('Ce fichier n\'est pas un JSON valide.');
  }
  if (!raw || typeof raw !== 'object') throw new Error('Fichier vide ou illisible.');
  const obj = raw as Partial<BackupFile> & Partial<AppData>;
  const data = obj.app === 'over15-methode' && obj.data ? obj.data : obj.settings || obj.bets ? (obj as AppData) : null;
  if (!data) throw new Error('Ce fichier ne vient pas de l\'application Outsiders.');
  return normalize(data);
}

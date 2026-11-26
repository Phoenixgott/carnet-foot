// Accès aux fonctions natives (Capacitor) avec repli web.
import { Capacitor } from '@capacitor/core';
import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics';
import { Browser } from '@capacitor/browser';
import { App } from '@capacitor/app';
import { SplashScreen } from '@capacitor/splash-screen';
import { Clipboard } from '@capacitor/clipboard';
import { getState } from './store';

export const isNative = Capacitor.isNativePlatform();

function enabled() {
  return getState().settings.haptics;
}

export const haptic = {
  tap() {
    if (!enabled()) return;
    if (isNative) Haptics.impact({ style: ImpactStyle.Light }).catch(() => {});
    else navigator.vibrate?.(8);
  },
  medium() {
    if (!enabled()) return;
    if (isNative) Haptics.impact({ style: ImpactStyle.Medium }).catch(() => {});
    else navigator.vibrate?.(15);
  },
  success() {
    if (!enabled()) return;
    if (isNative) Haptics.notification({ type: NotificationType.Success }).catch(() => {});
    else navigator.vibrate?.([10, 40, 20]);
  },
  warning() {
    if (!enabled()) return;
    if (isNative) Haptics.notification({ type: NotificationType.Warning }).catch(() => {});
    else navigator.vibrate?.([20, 60, 20]);
  },
  error() {
    if (!enabled()) return;
    if (isNative) Haptics.notification({ type: NotificationType.Error }).catch(() => {});
    else navigator.vibrate?.([40, 60, 40]);
  },
};

export async function openUrl(url: string) {
  if (/^(tel|mailto):/.test(url)) {
    window.location.href = url;
    return;
  }
  if (isNative) {
    try {
      await Browser.open({ url, toolbarColor: '#050b08' });
      return;
    } catch {
      /* repli */
    }
  }
  window.open(url, '_blank', 'noopener');
}

/** Copie un texte dans le presse-papiers. */
export async function copyText(text: string): Promise<boolean> {
  try {
    if (isNative) await Clipboard.write({ string: text });
    else await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

/** Lit le texte du presse-papiers (null si impossible). */
export async function readText(): Promise<string | null> {
  try {
    if (isNative) {
      const r = await Clipboard.read();
      return typeof r.value === 'string' ? r.value : null;
    }
    return await navigator.clipboard.readText();
  } catch {
    return null;
  }
}

export function hideSplash() {
  if (isNative) SplashScreen.hide({ fadeOutDuration: 250 }).catch(() => {});
}

// Bouton retour Android : pile de gestionnaires (le dernier ajouté passe en premier).
type BackHandler = () => boolean;
const backStack: BackHandler[] = [];

export function pushBack(h: BackHandler): () => void {
  backStack.push(h);
  return () => {
    const i = backStack.lastIndexOf(h);
    if (i >= 0) backStack.splice(i, 1);
  };
}

export function initBackButton(fallback: () => boolean) {
  if (!isNative) return;
  App.addListener('backButton', () => {
    for (let i = backStack.length - 1; i >= 0; i--) {
      if (backStack[i]()) return;
    }
    if (fallback()) return;
    App.minimizeApp().catch(() => App.exitApp());
  }).catch(() => {});
}

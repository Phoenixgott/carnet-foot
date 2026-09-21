/**
 * Déclarations minimales de React 19 pour TypeScript.
 *
 * Les définitions officielles (@types/react) n'ont pas pu être installées
 * (registre npm inaccessible depuis l'environnement de construction).
 * Ce fichier couvre ce que l'application utilise ; à remplacer par
 * `npm i -D @types/react @types/react-dom` dès que le registre est accessible.
 */
declare module "react" {
  export type ReactNode = any;
  export type Key = string | number;
  export type SetStateAction<S> = S | ((prev: S) => S);
  export type Dispatch<A> = (value: A) => void;
  export interface RefObject<T> { current: T }
  export interface Context<T> { Provider: any; Consumer: any; _t?: T }
  export type FC<P = object> = (props: P) => ReactNode;
  export type FormEvent<T = Element> = Event & { currentTarget: T };
  export type ChangeEvent<T = Element> = Event & { currentTarget: T; target: T };
  export type MouseEvent<T = Element> = globalThis.MouseEvent & { currentTarget: T };
  export type KeyboardEvent<T = Element> = globalThis.KeyboardEvent & { currentTarget: T };

  export function useState<S>(initial: S | (() => S)): [S, Dispatch<SetStateAction<S>>];
  export function useReducer<S, A>(reducer: (s: S, a: A) => S, initial: S): [S, Dispatch<A>];
  export function useEffect(effect: () => void | (() => void), deps?: readonly unknown[]): void;
  export function useLayoutEffect(effect: () => void | (() => void), deps?: readonly unknown[]): void;
  export function useMemo<T>(factory: () => T, deps: readonly unknown[]): T;
  export function useCallback<T extends (...args: any[]) => any>(cb: T, deps: readonly unknown[]): T;
  export function useRef<T>(initial: T): RefObject<T>;
  export function useRef<T>(initial: T | null): RefObject<T | null>;
  export function useId(): string;
  export function useContext<T>(c: Context<T>): T;
  export function createContext<T>(defaut: T): Context<T>;
  export const Fragment: any;
  export const StrictMode: any;
}

declare module "react/jsx-runtime" {
  export const jsx: any;
  export const jsxs: any;
  export const Fragment: any;
  export namespace JSX {
    type Element = any;
    interface ElementChildrenAttribute { children: object }
    interface IntrinsicAttributes { key?: string | number }
    interface IntrinsicElements { [nom: string]: any }
  }
}

declare module "react-dom/client" {
  export interface Root { render(node: any): void; unmount(): void }
  export function createRoot(el: Element): Root;
}

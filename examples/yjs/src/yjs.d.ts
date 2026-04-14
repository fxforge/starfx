declare module "yjs" {
  export type Transaction = unknown;
  export type YEvent<T> = { target: T };

  export class Doc {
    constructor(options?: { autoLoad?: boolean });
    getMap<T = unknown>(name?: string): Map<T>;
    transact(fn: () => void): void;
  }

  export class Map<T = unknown> {
    set(key: string, value: unknown): void;
    get<V = unknown>(key: string): V;
    toJSON(): T;
    observeDeep(
      observer: (events: YEvent<unknown>[], transaction: Transaction) => void,
    ): void;
  }

  export class Array<T = unknown> {
    push(items: T[]): void;
  }
}
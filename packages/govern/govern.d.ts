type Unsubscriber = () => void;

export = Govern;
export as namespace Govern;

declare namespace Govern {
  
  export function sequence<
  T extends Component<any, any>
>(a: T): T;

  export function sequence<
    T1 extends Component<any, any>,
    T2 extends Component<T1['_tso'], any>
  >(a: T1, b: T2):
    Constructor<ClassComponent<T1['_tsi'], T2['_tso']>>;

  export function sequence<
    T1 extends Component<any, any>,
    T2 extends Component<T1['_tso'], any>,
    T3 extends Component<T2['_tso'], any>
  >(a: T1, b: T2, c: T3):
    Constructor<ClassComponent<T1['_tsi'], T3['_tso']>>;

  export function sequence<
    T1 extends Component<any, any>,
    T2 extends Component<T1['_tso'], any>,
    T3 extends Component<T2['_tso'], any>,
    T4 extends Component<T3['_tso'], any>
  >(a: T1, b: T2, c: T3, d: T4):
    Constructor<ClassComponent<T1['_tsi'], T4['_tso']>>;
    
  export function sequence<
    T1 extends Component<any, any>,
    T2 extends Component<T1['_tso'], any>,
    T3 extends Component<T2['_tso'], any>,
    T4 extends Component<T3['_tso'], any>,
    T5 extends Component<T4['_tso'], any>
  >(a: T1, b: T2, c: T3, d: T4, e: T5):
    Constructor<ClassComponent<T1['_tsi'], T5['_tso']>>;
  
  export function parallel<T extends { [name: string]: Component<any, any> }>(components: T):
    Constructor<ClassComponent<T[keyof T]['_tsi'], { [K in keyof T]: T[K]['_tso'] }>>

  export function merge<I, C extends Component<any, any>, O>(component: C, fn: (props: I, output: C['_tso']) => O):
    Constructor<ClassComponent<I, O>>;

  export function map<I, O>(fn: (input: I) => O):
    FunctionComponent<I, O>;

  export type Input<C extends Component<any, any>> = C['_tsi']
  export type Output<C extends Component<any, any>> = C['_tso']

  // TODO
  // - factory
  // - subscribe

  export type Component<I, O> = (
    Constructor<ClassComponent<I, O>> |
    FunctionComponent<I, O>
  )

  export interface FunctionComponent<I, O> {
      (input: I): O;

      defaultProps?: Partial<I>

      _tsi?: I;
      _tso?: O;
  }

  export interface Constructor<C extends ClassComponent<any, any>> {
      new(input: C['_tsi']): ClassComponent<C['_tsi'], C['_tso']>;

      // This can be used instead of defaultProps
      defaultInput?: Partial<C['_tsi']>;

      // These are here to help ease the transition for people who are used to
      // React.
      defaultProps?: Partial<C['_tsi']>;
      propTypes?: object;

      _tsi?: C['_tsi'];
      _tso?: C['_tso'];
      _tsc?: C;
  }
  
  export abstract class ClassComponent<I, O> {
      abstract createGovernController(): Controller<I, O>;

      _tsi?: I;
      _tso?: O;
  }

  export interface Outlet<O> {
    // TODO: rename to getOutput
    get(): O;

    subscribe(
      // Should only be called between `onTransactionStart` and `onTransactionEnd`
      onChange: (output: O) => void,

      // Should be called before any possible side effects
      onTransactionStart: () => void,

      // Should be called once out of the side effect zone. The `done`
      // function should be called once the subscriber has processed all of
      // the transaction's changes.
      onTransactionEnd: (confirm: () => void) => void,

      // Signals that there will be no further transactions or changes.
      onDestroy: () => void,
    ): Unsubscriber;
  }

  export interface Controller<I, O> extends Outlet<O> {
    // If this is called on a component with no subscribers, the new props won't
    // be processed until a `getOutput`, `subscribe`, or subsequent
    // `scheduleChange` is called. In the case that  no `getOutput` is called
    // before a subsequent `scheduleChange`, `componentWillReceiveProps`
    // will be called, but `output` will not be (but may be called where
    // required on nested components)
    /// TODO: rename to scheduleInput
    set(newInput: I): void;

    // Should close any open transactions.
    destroy(): void;

    // A helper method to return an outlet. Useful fro when you want to pass a
    // controller somewhere without giving it control authority.
    getOutlet(): Outlet<O>;
  }

  export function createController<I, O>(type: Component<I, O>, initialInput: I): Controller<I, O>;

  // A simple type of GovernComponentClass that can be used as a base class.
  export class StatefulComponent<I=any, O=any, S=any> extends ClassComponent<I, O> {
    // These are also effectively read-only, but can be assigned to in the
    // child's constructor.
    actions: { [name: string]: (...args: any[]) => void };
    state: S;
    
    readonly props: I;
    
    constructor(props: I);

    setState(state: Partial<S>): void;

    componentWillReceiveProps(nextProps: I): void;

    output(): O;

    reconcile(prevOutput: O, nextOutput: O): boolean;

    componentWillBeDestroyed(): void;

    createGovernController(): Controller<I, O>;

    bindAction<K extends keyof this>(key: K): this[K];
    bindActions<Ks extends keyof this>(...keys: Ks[]): { [K in Ks]: this[K] };
  }
}

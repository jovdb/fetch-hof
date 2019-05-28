
namespace jo {

  type OneArgFn<TIn, TOut> = (x: TIn) => TOut;

  /**
   * Execute a chainfunctions on a start value:
   * The first argument is the start value, the next values arefunctions that are chained
   * - The start value is passed as input for the firstfunction
   * - The output of the firstfunction is passed as input for the secondfunction
   * - The output of the secondfunction is passed as input for the thirdfunction
   * - ...
   *
   * Example:
   * pipe(10,
   * x => x + 1,  // or pass addOnefunction
   * x => x * 2,  // or pass doublefunction
   * ) // Result: 42
   *
   * // Object composition
   * pipe({x: 1},
   * obj => { obj["y"] = 2; return obj; }, // or pass addFeatureYfunction
   * obj => { obj["z"] = 3; return obj; }, // or pass addFeatureZfunction
   * ) // Result: {x: 1, y: 2, z: 3}
   *
   * //function composition
   * pipe(() => 10,
   * fn => () => fn() + 1,
   * fn => () => fn() * 2,
   * ) // Result: () => 42
   *
   */
  export function pipe<TIn, TOut, T1, T2, T3, T4, T5, T6, T7, T8, T9, T10>(start: TIn, fn1: OneArgFn<TIn, T1>, fn2: OneArgFn<T1, T2>, fn3: OneArgFn<T2, T3>, fn4: OneArgFn<T3, T4>, fn5: OneArgFn<T4, T5>, fn6: OneArgFn<T5, T6>, fn7: OneArgFn<T6, T7>, fn8: OneArgFn<T7, T8>, fn9: OneArgFn<T8, T9>, fn10: OneArgFn<T9, T10>, fn11: OneArgFn<T10, TOut>): TOut;

  export function pipe<TIn, TOut, T1, T2, T3, T4, T5, T6, T7, T8, T9>(start: TIn, fn1: OneArgFn<TIn, T1>, fn2: OneArgFn<T1, T2>, fn3: OneArgFn<T2, T3>, fn4: OneArgFn<T3, T4>, fn5: OneArgFn<T4, T5>, fn6: OneArgFn<T5, T6>, fn7: OneArgFn<T6, T7>, fn8: OneArgFn<T7, T8>, fn9: OneArgFn<T8, T9>, fn10: OneArgFn<T9, TOut>): TOut;

  export function pipe<TIn, TOut, T1, T2, T3, T4, T5, T6, T7, T8>(start: TIn, fn1: OneArgFn<TIn, T1>, fn2: OneArgFn<T1, T2>, fn3: OneArgFn<T2, T3>, fn4: OneArgFn<T3, T4>, fn5: OneArgFn<T4, T5>, fn6: OneArgFn<T5, T6>, fn7: OneArgFn<T6, T7>, fn8: OneArgFn<T7, T8>, fn9: OneArgFn<T8, TOut>): TOut;

  export function pipe<TIn, TOut, T1, T2, T3, T4, T5, T6, T7>(start: TIn, fn1: OneArgFn<TIn, T1>, fn2: OneArgFn<T1, T2>, fn3: OneArgFn<T2, T3>, fn4: OneArgFn<T3, T4>, fn5: OneArgFn<T4, T5>, fn6: OneArgFn<T5, T6>, fn7: OneArgFn<T6, T7>, fn8: OneArgFn<T7, TOut>): TOut;

  export function pipe<TIn, TOut, T1, T2, T3, T4, T5, T6>(start: TIn, fn1: OneArgFn<TIn, T1>, fn2: OneArgFn<T1, T2>, fn3: OneArgFn<T2, T3>, fn4: OneArgFn<T3, T4>, fn5: OneArgFn<T4, T5>, fn6: OneArgFn<T5, T6>, fn7: OneArgFn<T6, TOut>): TOut;

  export function pipe<TIn, TOut, T1, T2, T3, T4, T5>(start: TIn, fn1: OneArgFn<TIn, T1>, fn2: OneArgFn<T1, T2>, fn3: OneArgFn<T2, T3>, fn4: OneArgFn<T3, T4>, fn5: OneArgFn<T4, T5>, fn6: OneArgFn<T5, TOut>): TOut;

  /** Execute a chainfunctions on a start value */
  export function pipe<TIn, TOut, T1, T2, T3, T4>(start: TIn, fn1: OneArgFn<TIn, T1>, fn2: OneArgFn<T1, T2>, fn3: OneArgFn<T2, T3>, fn4: OneArgFn<T3, T4>, fn5: OneArgFn<T4, TOut>): TOut;

  /** Execute a chainfunctions on a start value */
  export function pipe<TIn, TOut, T1, T2, T3>(start: TIn, fn1: OneArgFn<TIn, T1>, fn2: OneArgFn<T1, T2>, fn3: OneArgFn<T2, T3>, fn4: OneArgFn<T3, TOut>): TOut;

  /** Execute a chainfunctions on a start value */
  export function pipe<TIn, TOut, T1, T2>(start: TIn, fn1: OneArgFn<TIn, T1>, fn2: OneArgFn<T1, T2>, fn3: OneArgFn<T2, TOut>): TOut;

  /** Execute a chainfunctions on a start value */
  export function pipe<TIn, TOut, T1>(start: TIn, fn1: OneArgFn<TIn, T1>, fn2: OneArgFn<T1, TOut>): TOut;

  /** Execute a chainfunctions on a start value */
  export function pipe<TIn, TOut>(start: TIn, fn1: OneArgFn<TIn, TOut>): TOut;

  /** Execute a chainexport functions on a start value */
  export function pipe<TIn>(start: TIn): TIn;


  export function pipe<TIn>(start: TIn, ...fns: Function[]) {
    // For better type inference, I included the start value as argument
    return fns.reduce(function piping(prevFn: any, fn: Function) { return fn(prevFn); }, start);
  }
}
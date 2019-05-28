namespace jo {

  export function withChaosMonkey<TArgs extends any[] = any[]>({
    getCancelToken,
    shouldThrow = () => Math.random() < 0.2,
    getDelayInMs = () => Math.floor(3 ** (Math.random() * 8)), // Max 3**8 = 6561
  }: {
    getCancelToken?: (args: TArgs) => CancelToken | undefined;
    shouldThrow?: () => boolean;
    getDelayInMs?: () => number;
  }) {

    logger.log(`Added Chaos Monkey 🐵...`);

    return <TFn extends (...args: TArgs) => any>(fn: TFn): TFn => ((...args: TArgs) => {

      const cancelToken = getCancelToken ? getCancelToken(args) : undefined;

      const delayInMs = getDelayInMs();
      const willThrow = shouldThrow();
      logger.log(`Chaos Monkey 🐵 will add ${delayInMs}ms delay ${ willThrow ? "with" : "without" } error.`);

      // Call original function
      return fn(...args)

        // Add random Delay
        .then((result: any) => waitAsync({
          cancelToken,
          delayInMs,
          value: result,
        }).catch(() => result)) // If canceled, just retrun result

        // Add random Error
        .then((result: any) => {
          // Throw if not canceled
          if (willThrow && (cancelToken ? !cancelToken.requested : true)) throw new Error("Thrown by Chaos Monkey 🐵");
          return result;
        });

    }) as any;
  }
}
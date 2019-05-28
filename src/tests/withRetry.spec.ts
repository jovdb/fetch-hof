namespace jo {

  interface IWithRetryTestInfo {
    testName: string;
    durationInMs: number;
    cancelInfo: ReturnType<typeof CancelToken["source"]> | undefined;
    cancelDelayInMs: number | undefined;
    getRetryDelayInMs: (retryCount: number) => number;
    validate(err: Error | undefined, fail: Function, executionCount: number): void;
  }

  const info: IWithRetryTestInfo[] = [{
    testName: "should execute and fail, no retries",
    durationInMs: 10,
    cancelInfo: undefined,
    cancelDelayInMs: undefined,
    getRetryDelayInMs: () => -1,
    validate: (err, fail, executionCount) => {
      if (!err) fail("Expected to fail");
      if (executionCount !== 1) fail("Expected to execute once");
    },
  }, {
    testName: "should execute, retry twice and fail",
    durationInMs: 10,
    cancelInfo: undefined,
    cancelDelayInMs: undefined,
    getRetryDelayInMs: retryCount => retryCount < 2 ? 10 : -1, // retry once
    validate: (err, fail, executionCount) => {
      if (!err) fail("Expected to fail");
      if (executionCount !== 3) fail(`Executed #${executionCount}, Expected to execute 3x`);
    },
  }, {
    testName: "should cancel during second retry delay",
    durationInMs: 10,
    cancelInfo: CancelToken.source(),
    cancelDelayInMs: 28,
    getRetryDelayInMs: retryCount => retryCount < 5 ? 10 : -1, // retry once
    validate: (err, fail, executionCount) => {
      if (!err) fail("Expected to fail");
      if (err && err.message !== "C") fail("Expected to fail with CancelError");
      if (executionCount !== 1) fail(`Executed #${executionCount}, Expected to execute 2x`);
    },
  }, {
    testName: "should cancel during execution",
    durationInMs: 20,
    cancelInfo: CancelToken.source(),
    cancelDelayInMs: 35,
    getRetryDelayInMs: retryCount => retryCount < 5 ? 10 : -1, // retry once
    validate: (err, fail, executionCount) => {
      if (!err) fail("Expected to fail");
      if (err && err.message !== "C") fail("Expected to fail with CancelError");
      if (executionCount !== 1) fail(`Executed #${executionCount}, Expected to execute 2x`);
    },
  }];


  tester && tester.group("withRetry", ({test}) => {

    return Promise.all(

      // 2 Durations
      info.map(({ durationInMs, validate, testName, getRetryDelayInMs, cancelDelayInMs, cancelInfo }) => {

        // Should cancel?
        if (cancelInfo && cancelDelayInMs) {
          waitAsync({delayInMs: cancelDelayInMs})
            .then(() => {
                logger.log("Canceling");
                cancelInfo.cancel(new CancelError("C"));
            });
        }

        return test(testName, ({fail, done}) => {

          let executionCount = 0;
          // Start function with timeout
          return pipe(
            (cancelToken?: CancelToken) => {
              logger.log(`Executing async call (${durationInMs}ms)...`);
              ++executionCount;
              return waitAsync({
                delayInMs: durationInMs,
                cancelToken,
              }).then(() => {
                logger.log("Async call ends with error.");
                throw new Error("A");
              });
            },
            withRetry({
              getRetryDelayInMs,
              getCancelToken: cancelInfo ? args => args[0] : undefined,
            }),
          )(cancelInfo ? cancelInfo.token : undefined)

            // Check results
            .then(() => {
              // Check Timeout
              validate(undefined, fail, executionCount);
              done();
            })

            .catch(err => {
              validate(err, fail, executionCount);
              done();
            });

        });

      })
    );
  });
}

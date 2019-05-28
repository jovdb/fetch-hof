namespace jo {

  const delayAsync = (delayInMs: number) => new Promise(resolve => {
    setTimeout(resolve, delayInMs);
  });

  interface IWithTimeoutTestInfo {
    testName: string;
    durationInMs: number;
    timeoutInMs: number;
    cancelInfo: ReturnType<typeof CancelToken["source"]> | undefined;
    cancelDelayInMs: number | undefined;
    shouldFail: boolean;
    isValidateError?(err: Error, fail: Function): void;
  }

  const info: IWithTimeoutTestInfo[] = [{
    testName: "should not fail if not timed out",
    durationInMs: 10,
    timeoutInMs: 15,
    cancelInfo: undefined,
    cancelDelayInMs: undefined,
    shouldFail: false,
  }, {
    testName: "should fail because timed out",
    durationInMs: 10,
    timeoutInMs: 5,
    cancelInfo: undefined,
    cancelDelayInMs: undefined,
    shouldFail: true,
    isValidateError: err => err.message === "TO",
  }, {
    testName: "should fail because timed out and cancelToken not called",
    durationInMs: 10,
    timeoutInMs: 5,
    cancelInfo: CancelToken.source(),
    cancelDelayInMs: undefined,
    shouldFail: true,
    isValidateError: err => err.message === "TO",
  }, {
    testName: "should fail because timed out and cancelled after resolve",
    durationInMs: 10,
    timeoutInMs: 5,
    cancelInfo: CancelToken.source(),
    cancelDelayInMs: 15,
    shouldFail: true,
    isValidateError: err => err.message === "TO",
  }, {
    testName: "should fail because canceled",
    durationInMs: 15,
    timeoutInMs: 10,
    cancelInfo: CancelToken.source(),
    cancelDelayInMs: 5,
    shouldFail: true,
    isValidateError: err => err.message === "C",
  }, {
    testName: "should not fail if cancelled after resolve",
    durationInMs: 5,
    timeoutInMs: 15,
    cancelInfo: CancelToken.source(),
    cancelDelayInMs: 15,
    shouldFail: false
  }];


  tester && tester.group("withTimeout", ({test}) => {

    return Promise.all(

      // 2 Durations
      info.map(({ durationInMs, isValidateError, timeoutInMs, testName, cancelDelayInMs, cancelInfo, shouldFail }) => {

        return test(testName, ({fail, done}) => {

          // Cancel
          if (cancelDelayInMs && cancelDelayInMs > 0) delayAsync(cancelDelayInMs).then(() => { cancelInfo!.cancel(new Error("C")); });

          // Start function with timeout
          return pipe(
            delayAsync,
            withTimeout({
              getTimeoutInMs: () => timeoutInMs,
              getTimeoutError: () => Error("TO"),

              getCancelToken: () => cancelInfo ? cancelInfo.token : undefined,
            }),
          )(durationInMs)

            // Check results
            .then(() => {
              // Check Timeout
              if (shouldFail) fail(`Expected to fail.`);
              done();
            })

            .catch(err => {
              const isOk = shouldFail && (isValidateError ? isValidateError(err, fail) : true);

              if (!isOk) fail(`Didn't expect to fail.`);
              done();
            });
        });
      })
    );
  });
}

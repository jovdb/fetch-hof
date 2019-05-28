namespace jo {

  // Boxed myself some test functions that I can use without the need of a dependency

  export type TestResult = boolean | string;

  export interface ITestLogger<TGroupStart = void, TTestStart = void> {
    groupStart(groupName: string): TGroupStart;
    testStart(testName: string, groupInfo: TGroupStart): TTestStart;
    testEnd(errorMessages: string[], testInfo: TTestStart): void;
    groupEnd(groupInfo: TGroupStart): void;
  }

  function getErrorMessage(result?: TestResult) {
    if (!result) return ""; // OK
    if (result === true) return "Failed";
    return `${result}`;
  }

  const isPromise = <T = any>(o: any): o is Promise<T> => !!(o && o.then);

  const use = <T, TBeforeResult>({
    before,
    after,
    cb
  } : {
    before: () => TBeforeResult;
    cb: (beforeResult: TBeforeResult) => T;
    after: (beforeResult: TBeforeResult, err?: any) => any;
  }): T => {
    const beforeResult = before();
    try {

      const result = cb(beforeResult);

      if (isPromise(result)) {
        return result.then(r => {
          after(beforeResult);
          return r;
        }).catch(err => {
          after(beforeResult, err);
          throw err;
        }) as any;
      } else {
        after(beforeResult);
        return result;
      }

    } catch(err) {
      after(beforeResult, err);
      throw err;
    }
  };


  export function createTester<T, U>(logger: ITestLogger<T, U>) {

    function group(groupName: string, cb: (methods: {
      test: typeof test;
      group: typeof group;
    }) => any, groupInfos: any[] = []) {

      function test(testName: string, cb: (options: {
        done: (result?: TestResult) => void;
        fail: (result: TestResult) => void;
      }) => void, groupInfos: any[] = []): Promise<undefined> {

        const errorMessages: string[] = [];

        const promise = new Promise<undefined>(resolve => {

          const done = () => {
            resolve();
          };

          const fail = (result: TestResult) => {
            const errorMessage = getErrorMessage(result);
            if (errorMessage) errorMessages.push(errorMessage);
          };

          cb({ done, fail });
        });

        return use({
          before: () => logger.testStart(testName, groupInfos[groupInfos.length - 1]),
          cb: () => promise,
          after: (testInfo) => logger.testEnd(errorMessages, testInfo),
        });
      }

      use({
        before: () => {
          return logger.groupStart(groupName);
        },

        cb: groupInfo => {
          cb({
            test(testName: string, cb: any) {
              return test(testName, cb, [...groupInfos, groupInfo]);
            },
            group(groupName: string, cb: any) {
              group(groupName, cb, groupInfos);
            }
          });
        },

        after: groupInfo => {
          logger.groupEnd(groupInfo);
        },
      });
    }

    return {
      group,
    };
  }

  export function createTesterToDiv(el: HTMLElement) {

    const logger: ITestLogger<HTMLDivElement, HTMLDivElement> = {
      groupStart: groupName => {
        const groupEl = document.createElement("div");
        groupEl.classList.add("test__group", "test__group--busy");
        groupEl.innerText = groupName;
        el.appendChild(groupEl);
        return groupEl;
      },

      testStart: (testName, groupEl) => {
        const lineEl = document.createElement("div");
        lineEl.innerText = testName;
        lineEl.classList.add("test__result");
        lineEl.classList.add("test__result--busy");
        groupEl.appendChild(lineEl);
        return lineEl;
      },

      testEnd: (errorMessages, lineEl) => {
        lineEl.classList.remove("test__result--busy");
        if (!errorMessages || errorMessages.length === 0) {
          lineEl.classList.add("test__result--success");
        } else {
          lineEl.classList.add("test__result--failed");
          const errorsEl = document.createElement("div");
          errorsEl.classList.add("error__lines");

          errorMessages.forEach(msg => {
            const errorEl = document.createElement("div");
            errorEl.innerText = msg;
            errorEl.classList.add("error__line");
            errorsEl.appendChild(errorEl);
          });
          lineEl.appendChild(errorsEl);
        }
      },

      groupEnd: groupEl => {
        groupEl.classList.remove("test__group--busy");
        groupEl.classList.add("test__group--success");
      },
    };

    return createTester(logger);
  }

  const testsEl = document.getElementById("tests");
  export const tester = testsEl
    ? createTesterToDiv(testsEl)
    : undefined;
}
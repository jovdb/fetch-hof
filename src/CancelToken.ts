namespace jo {

  // inspired by:
  // https://github.com/zenparsing/es-cancel-token
  // https://github.com/inikulin/cancelable-promise/blob/master/Cancel%20Tokens.md


  interface ICancelToken<TCancelError extends CancelError = CancelError> {

    /** Synchronously returns a Boolean value indicating whether cancellation has been requested for this token. */
    requested: boolean;

    /** Returns a promise which will be resolved with a CancelError if cancellation has been requested for this token. */
    // promise: Promise<TCancelError>;

    /** Prefered a synchronous subscribe over an async promise */
    subscribe(cb: (error: TCancelError) => void): () => void;

    /** Synchronously throws a CancelError if cancellation has been requested for this token. */
    throwIfRequested(): void;
  }
  // source(): { token, cancel }


  export class CancelToken<TCancelError extends CancelError = CancelError> implements ICancelToken<TCancelError> {

    private _requested: boolean;
    private _error: TCancelError | undefined;
    private _listeners:  ((error: TCancelError) => void)[] | undefined;

    constructor(executer: (cancel: (error: TCancelError) => void) => void) {
      this._requested = false;
      this._listeners = [];

      executer((error: TCancelError) => {
        this._requested = true;
        this._error = error;
        if (this._listeners) this._listeners.forEach(listener => listener(error));
        this._listeners = undefined;
      });
    }

    /** Synchronously returns a Boolean value indicating whether cancellation has been requested for this token. */
    public get requested(): boolean {
      return this._requested;
    }

    public subscribe(cb: (error: TCancelError) => void): () => void {

      // Already Canceled?
      if (this._error) {
        cb(this._error);
        return () => undefined;
      }

      if (!this._listeners) return () => undefined;
      this._listeners.push(cb);

      logger.debug(`subscribed to CancelToken`);

      // Return unsubscribe
      return () => {
        logger.debug(`unsubscribed from CancelToken`);
        if (!this._listeners) return;
        const index = this._listeners.indexOf(cb);
        if (index < 0) return;
        this._listeners!.splice(index, 1);
      };
    }

    /** Synchronously throws a CancelError if cancellation has been requested for this token. */
    public throwIfRequested(): void {
      if (this._requested) throw this._error;
    }

    // /** Create a child token that will cancel if the parent cancels, but can independently be canceled without affecting the parent */
    // public createChildToken<TChildCancelError extends CancelError = TCancelError | CancelError>(executer?: (cancel: (error: TChildCancelError) => void) => void) {
    //   return new CancelToken<TChildCancelError | TCancelError>(cancel => {
    //     this.subscribe(error => cancel(error));
    //   });
    // }

    // /** Create a new token that will cancel if one of the specified tokens cancels */
    // static race(...tokens: CancelToken[]) {
    //   return new CancelToken(cancel => {
    //     for (const token of tokens) {
    //       token.subscribe(error => cancel(error));
    //     }
    //   });
    // }

    static source<TCancelError extends CancelError = CancelError>() {
      let _cancel: ((error: TCancelError) => void) | undefined;
      const token = new CancelToken<TCancelError>(cancel => _cancel = cancel);
      return { cancel: _cancel!, token };
    }

  }

  export class CancelError extends Error {
    constructor(message: string) {
      super(message);
      this.name = "CancelError";
    }
  }

  export function isCancelError(error: any): error is CancelError {
    return error instanceof Error && error.name === "CancelError" ;
  }
}
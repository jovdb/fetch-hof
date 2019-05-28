# fetch-hof
Experiment with fetch higher order functions and abortability

[You can play with it here...](https://jovdb.github.io/fetch-hof)

## Some remarks about the CancelToken
I based my code on this [CancelToken](https://github.com/zenparsing/es-cancel-token) proposal.

What I didn't like on that proposal is that there is now handy way to get the `CancelError`:
- You can wrap `throwIfRequested()` in a try/catch to get the exception
- You can `promise.then()` to get the CancelToken, but then you have to take the asynchronicity into account.
  
Instead of `promise` , I used a `subscribe` function that returns an unsubscribe function.
You pass an onCancel callback that will be called with the `CancelError` only once when cancel is called or when it is already cancelled at subscribe.

[Here an example](https://github.com/jovdb/fetch-hof/blob/master/src/withProgress.ts#L58_L63) where I prefer to get the CancelError synchronous.

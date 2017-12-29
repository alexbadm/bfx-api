# bfx-api

Websocket API for Bitfinex exchange

## Usage

### NodeJS example

``` typescript
import * as WebSocket from 'ws';

import BfxApi from 'bfx-api';

const api = new BfxApi({ WebSocket, logger: console });
api.connect();

api.subscribeTicker('BTCUSD', onEventCallback)
.then((e) => global.console.log('app subscribed ticker', e))
.catch((error) => global.console.log('app subscribe error', error));

api.subscribeTrades('BTCUSD', onEventCallback)
.then((e) => {
  global.console.log('app subscribed trades', e);
  global.console.log('app let\'s unsubscribe');
  api.unsubscribe(e.chanId)
  .then((unsEvent) => {
    global.console.log('app unsubscribed', unsEvent);
  });
});

api.subscribeCandles('BTCUSD', onEventCallback)
.then((e) => global.console.log('app subscribed candles', e))
.catch((error) => global.console.log('app subscribe error', error));

api.auth(
  'your key',
  'your secret',
  onEventCallback)
.then((e) => global.console.log('app auth success', e))
.catch((e) => global.console.log('app auth fail', e));
```

Replace every `onEventCallback` by relevant callback.

For console output replace it by `(msg) => global.console.log('my tag', msg)`.

Every `subscribeXXX` method returns Promise that resolves or rejects by exchange response.

Replace the `'BTCUSD'` pair by the desired.

import * as crypto from 'crypto-js';
import * as WS from 'ws';
import * as config from '../config.json';
import ActionsStack from './ActionsStack';
import {
  AuthEvent,
  NotificationBody,
  OrderRequest,
  SubscribeEvent,
  UnsubscribeEvent,
} from './bitfinexTypes';
import Expectations, { MatchFunc } from './Expectations';
import { setTimeout } from 'timers';

const allowedVersions = config.BitfinexAPIVersions;
const bfxAPI = config.BitfinexDefaultAPIUrl;

function MatchChannel(chanId: number): MatchFunc {
  return (msg: any[]) => msg[0] === chanId;
}

function heartbeatCb() { return; }

function SnapshotAndHeartbeatCallback(snapCb: SnapshotCallback, hbCb: SnapshotCallback = heartbeatCb) {
  return (msg: any[]) => msg[1] === 'hb' ? hbCb(msg) : snapCb(msg);
}

export type SnapshotCallback = (msg: Array<number|string>) => void;

export interface BfxApiParameters {
  logger?: Console;
  url?: string;
}

const defaultBfxApiParameters: BfxApiParameters = {
  logger: console,
  url: bfxAPI,
};

type voidFunction = (...p: any[]) => void;

interface MsgInfo {
  code: number;
}

interface SubscribeParams {
  symbol: string;
  prec?: string;
  key?: string;
}

class BfxApi {
  private url: string;

  private log: voidFunction;
  private debug: voidFunction;
  private error: voidFunction;
  private logger: Console;

  private authorized: boolean;
  private paused: boolean;
  private resumeStack: ActionsStack;
  private pingCounter: number;

  private expectations: Expectations;
  private ws: WS | WebSocket;

  constructor(params: BfxApiParameters = defaultBfxApiParameters) {
    params = { ...defaultBfxApiParameters, ...params };
    this.url = params.url;
    this.logger = params.logger;

    this.log = this.logger.log;
    this.debug = this.log; // this.logger.debug || this.log;
    this.error = this.logger.error || this.log;

    this.authorized = false;
    this.paused = true;
    this.resumeStack = new ActionsStack();
    this.pingCounter = 0;

    this.expectations = new Expectations();

    this.auth = this.auth.bind(this);
    this.close = this.close.bind(this);
    this.connect = this.connect.bind(this);
    this.ping = this.ping.bind(this);
    this.restart = this.restart.bind(this);
  }

  public connect() {
    this.debug('connect');
    this.expectations.once(
      (msg) => msg.event === 'info' && msg.version,
      (msg) => {
        this.debug('api version', msg.version);
        if (allowedVersions.indexOf(msg.version) === -1) {
          this.error('unexpected version', msg.version);
          this.close();
        }
      },
    );

    this.ws = (typeof global === 'object') ? new WS(this.url) : new WebSocket(this.url);
    this.ws.onmessage = this.handleMessage.bind(this);
    this.ws.onopen = this.resume.bind(this);
  }

  public close() {
    this.log('closing socket');
    this.ws.close();
  }

  public auth(apiKey: string, apiSecret: string, callback: SnapshotCallback) {
    const authNonce = Date.now() * 1000;
    const authPayload = 'AUTH' + authNonce;
    const authSig = crypto
      .HmacSHA384(authPayload, apiSecret)
      .toString(crypto.enc.Hex);

    const payload = {
      apiKey,
      authNonce,
      authPayload,
      authSig,
      event: 'auth',
    };

    // const heartbeating = () => this.debug('Heartbeating auth channel');

    return new Promise((resolve, reject) => {
      if (typeof callback !== 'function') {
        reject(new TypeError('BfxApi.auth error: callback must be a function'));
        return;
      }
      this.expectations.once(
        (msg) => msg.event === 'auth' && msg.chanId === 0,
        (event: AuthEvent) => {
          if (event.status === 'OK') {
            this.expectations.observe(MatchChannel(0), SnapshotAndHeartbeatCallback(callback));
            this.authorized = true;
            resolve(event);
          } else {
            reject(event);
          }
        },
      );

      this.send(payload);
    });
  }

  public subscribeTicker(pair: string, callback: SnapshotCallback) {
    return this.subscribe('ticker', { symbol: 't' + pair }, callback);
  }

  public subscribeFTicker(pair: string, callback: SnapshotCallback) {
    return this.subscribe('fticker', { symbol: 'f' + pair }, callback);
  }

  public subscribeTrades(pair: string, callback: SnapshotCallback) {
    return this.subscribe('trades', { symbol: 't' + pair }, callback);
  }

  public subscribeFTrades(pair: string, callback: SnapshotCallback) {
    return this.subscribe('trades', { symbol: 'f' + pair }, callback);
  }

  public subscribeBooks(pair: string, callback: SnapshotCallback) {
    return this.subscribe('book', { symbol: 't' + pair }, callback);
  }

  public subscribeRawBooks(pair: string, callback: SnapshotCallback) {
    return this.subscribe('book', { symbol: 't' + pair, prec: 'R0' }, callback);
  }

  public subscribeCandles(pair: string, callback: SnapshotCallback, timeFrame = '1m') {
    return this.subscribe('candles', { symbol: '', key: `trade:${timeFrame}:t${pair}` }, callback);
  }

  public ping() {
    const cid = ++this.pingCounter;
    this.expectations.once((msg) => msg.event === 'pong' && msg.cid === cid, ({ ts }) => {
      this.log('proper ping/pong, ts is', ts);
    });
    this.send({ cid, event: 'ping' });
  }

  public unsubscribe(chanId: number) {
    const event = 'unsubscribe';
    this.send({ event, chanId });

    return new Promise<UnsubscribeEvent>((resolve) => {
      this.expectations.once(
        (msg) => msg.event === 'unsubscribed' && msg.chanId === chanId,
        (msg) => resolve(msg),
      );
    });
  }

  public newOrder(order: OrderRequest): Promise<NotificationBody> {
    return new Promise((resolve, reject) => {
      if (!this.authorized) {
        reject(new Error('User is not authorized on the exchange'));
        return;
      }

      const cid = Date.now();

      this.expectations.once(
        (msg) => msg[0] === 0 && msg[1] === 'n' && msg[2][1] === 'on-req' && msg[2][4][2] === cid,
        (msg: Notification) => msg[2][6] === 'SUCCESS' ? resolve(msg[2]) : reject(msg[2]),
      );

      const payload = {
        // gid: 1,
        // amount: '1.0',
        cid,
        hidden: 0,
        // price: '500',
        // symbol: 'tBTCUSD',
        type: 'EXCHANGE MARKET',
        ...order,
      };

      this.send([ 0, 'on', null, payload ]);
    });
  }

  public newOrders(orders: OrderRequest[]): Promise<NotificationBody[]> {
    return new Promise((resolve, reject) => {
      if (!this.authorized) {
        reject(new Error('User is not authorized on the exchange'));
        return;
      }

      if (!orders || !orders.length) {
        reject(new Error('No operations given'));
        return;
      }

      if (orders.length > 15) {
        reject(new Error('Submiting more than 15 operations is not allowed'));
        return;
      }

      const cid = Date.now();
      const responses: NotificationBody[] = Array(orders.length);
      let responseCounter = 0;

      const payload = orders.map((order, idx) => {
        const orderCid = cid + idx;
        this.expectations.once(
          (msg) => msg[0] === 0 && msg[1] === 'n' && msg[2][1] === 'on-req' && msg[2][4][2] === orderCid,
          (msg: Notification) => {
            responses[idx] = msg[2];
            responseCounter++;
            if (responseCounter === orders.length) {
              responses.every((resp) => resp[6] === 'SUCCESS')
                ? resolve(responses)
                : reject(responses);
            }
          },
        );
        return [ 'on', { cid: orderCid, hidden: 0, ...order } ];
      });

      this.send([ 0, 'ox_multi', null, payload ]);
    });
  }

  public trades(orders: OrderRequest[]): Promise<any[]> {
    if (!this.authorized) {
      return Promise.reject(new Error('User is not authorized on the exchange'));
    }

    if (!orders || !orders.length) {
      return Promise.reject(new Error('No operations given'));
    }

    if (orders.length > 15) {
      return Promise.reject(new Error('Submiting more than 15 operations is not allowed'));
    }

    const cid = Date.now();

    const payload: Array<['on', OrderRequest]> = [];
    const promises = orders.map((order, idx) => new Promise((resolve, reject) => {
      const orderCid = cid + idx;
      this.expectations.once(
        (msg) => msg[0] === 0 && msg[1] === 'n' && msg[2][1] === 'on-req' && msg[2][4][2] === orderCid,
        (msg: Notification) => {
          const notif = msg[2];
          if (notif[6] === 'SUCCESS') {
            const orderId = notif[4][0];
            this.expectations.once(
              (trdMsg) => trdMsg[0] === 0 && trdMsg[1] === 'tu' && trdMsg[2][3] === orderId,
              (trdMsg) => resolve(trdMsg),
            );
          } else {
            reject(notif);
          }
        },
      );
      payload.push([ 'on', { cid: orderCid, hidden: 0, ...order } ]);
    }));

    this.send([ 0, 'ox_multi', null, payload ]);
    return Promise.all(promises);
  }

  private handleMessage(rawMsg: MessageEvent) {
    const msg = JSON.parse(rawMsg.data);

    if (this.expectations.exec(msg)) {
      return;
    }

    if (msg.event === 'info') {
      this.processMsgInfo(msg);
      return;
    }

    this.debug('unprocessed message', msg);
  }

  private processMsgInfo(msg: MsgInfo) {
    this.debug('info message', msg);

    switch (msg.code) {
      case 20051:
        this.close();
        setTimeout(this.connect, 5000);
        // this.restart();
        break;
      case 20060:
        this.pause();
        break;
      case 20061:
        this.resume();
        break;
      default:
        this.log('unknown info message code', msg.code);
    }
  }

  private pause() {
    this.debug('pause');
    this.paused = true;
  }

  private resume() {
    this.debug('resume');
    this.paused = false;
    this.resumeStack.fire();
  }

  private restart() {
    this.debug('restart');
    this.close();
    this.connect();
  }

  private send(data: object | string) {
    if (this.paused || !this.ws || this.ws.readyState !== this.ws.OPEN) {
      this.resumeStack.add(this.send.bind(this, data));
      return;
    }
    if (typeof data !== 'string') {
      data = JSON.stringify(data);
    }
    this.ws.send(data);
  }

  private subscribe(
    channel: string, params: SubscribeParams, callback: SnapshotCallback,
  ): Promise<SubscribeEvent> {
    return new Promise((resolve, reject) => {
      if (typeof callback !== 'function') {
        reject(new TypeError('BfxApi.subscribe error: callback must be a function'));
        return;
      }

      // const heartbeating = ([chanId]: [number]) => this.debug('Heartbeating', {chanId});

      this.expectations.once(
        (msg) => msg.channel === channel && (msg.symbol === params.symbol || msg.key === params.key),
        (e: SubscribeEvent) => {
          if (e.event === 'subscribed') {
            this.expectations.whenever(MatchChannel(e.chanId), SnapshotAndHeartbeatCallback(callback));
            resolve(e);
          } else {
            reject(e);
          }
        },
      );
      this.send({ event: 'subscribe', channel, ...params });
    });
  }
}

export default BfxApi;

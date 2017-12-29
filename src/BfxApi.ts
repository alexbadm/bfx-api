import * as crypto from 'crypto-js';
import * as WebSocket from 'ws';
import * as config from '../config.json';
import ActionsStack from './ActionsStack';
import Expectations, { MatchFunc } from './Expectations';

const allowedVersions = config.BitfinexAPIVersions;
const bfxAPI = config.BitfinexDefaultAPIUrl;

// function MatchHeartbeat(chanId: number): MatchFunc {
//   return (msg: any[]) => msg[0] === chanId && msg[1] === 'hb';
// }

// function MatchSnapshot(chanId: number): MatchFunc {
//   return (msg: any[]) => msg[0] === chanId && msg[1] !== 'hb';
// }

function MatchChannel(chanId: number): MatchFunc {
  return (msg: any[]) => msg[0] === chanId;
}

function SnapshotAndHeartbeatCallback(snapCb: SnapshotCallback, hbCb: SnapshotCallback) {
  return (msg: any[]) => msg[1] === 'hb' ? hbCb(msg) : snapCb(msg);
}

export type SnapshotCallback = (msg: Array<number|string>) => void;

// export type wsOnOpen = (this: WebSocket, ev: { target: WebSocket } | Event) => any;
export interface IBfxApiParameters {
  logger?: Console;
  url?: string;
  WebSocket?: typeof WebSocket;
}

const defaultBfxApiParameters: IBfxApiParameters = {
  logger: console,
  url: bfxAPI,
};

type voidFunction = (...p: any[]) => void;

interface IMsgInfo {
  code: number;
}

export interface ISubscribeEvent {
  chanId: number;
  channel: string;
  event: string;
  pair?: string;
  symbol?: string;
}

export interface IUnsubscribeEvent {
  chanId: number;
  event: string;
}

interface ISubscribeParams {
  symbol: string;
  prec?: string;
  key?: string;
}

export interface IAuthEvent {
  event: 'auth';
  status: 'OK' | 'FAIL';
  chanId: 0;
  userId: number;
  caps: string;
  code: number;
}

class BfxApi {
  private url: string;

  private log: voidFunction;
  private debug: voidFunction;
  private error: voidFunction;
  private logger: Console;

  private paused: boolean;
  private resumeStack: ActionsStack;
  private pingCounter: number;

  private expectations: Expectations;
  private ws: WebSocket;
  private WebSocket: typeof WebSocket;

  constructor(params: IBfxApiParameters = defaultBfxApiParameters) {
    params = { ...defaultBfxApiParameters, ...params };
    this.url = params.url;
    this.WebSocket = params.WebSocket || WebSocket;
    this.logger = params.logger;

    this.log = this.logger.log;
    this.debug = this.logger.debug || this.log;
    this.error = this.logger.error || this.log;

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
        this.debug('msg.version', msg.version);
        if (allowedVersions.indexOf(msg.version) === -1) {
          this.error('unexpected version', msg.version);
          this.error('closing socket');
          this.ws.close();
        }
      },
    );

    this.ws = new this.WebSocket(this.url);
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

    const heartbeating = () => this.debug('Heartbeating auth channel');

    return new Promise((resolve, reject) => {
      if (typeof callback !== 'function') {
        reject(new TypeError('BfxApi.auth error: callback must be a function'));
        return;
      }
      this.expectations.once(
        (msg) => msg.event === 'auth' && msg.chanId === 0,
        (event: IAuthEvent) => {
          if (event.status === 'OK') {
            this.expectations.whenever(MatchChannel(0), SnapshotAndHeartbeatCallback(callback, heartbeating));
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

    return new Promise<IUnsubscribeEvent>((resolve) => {
      this.expectations.once(
        (msg) => msg.event === 'unsubscribed' && msg.chanId === chanId,
        (msg) => resolve(msg),
      );
    });
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

  private processMsgInfo(msg: IMsgInfo) {
    this.debug('info message', msg);

    switch (msg.code) {
      case 20051:
        this.restart();
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
    if (this.paused || !this.ws || this.ws.readyState !== WebSocket.OPEN) {
      this.resumeStack.add(this.send.bind(this, data));
      return;
    }
    if (typeof data !== 'string') {
      data = JSON.stringify(data);
    }
    this.ws.send(data);
  }

  private subscribe(
    channel: string, params: ISubscribeParams, callback: SnapshotCallback,
  ): Promise<ISubscribeEvent> {
    return new Promise((resolve, reject) => {
      if (typeof callback !== 'function') {
        reject(new TypeError('BfxApi.subscribe error: callback must be a function'));
        return;
      }

      const heartbeating = ([chanId]: [number]) => this.debug('Heartbeating', {chanId});

      this.expectations.once(
        (msg) => msg.channel === channel && (msg.symbol === params.symbol || msg.key === params.key),
        (e: ISubscribeEvent) => {
          if (e.event === 'subscribed') {
            this.expectations.whenever(MatchChannel(e.chanId), SnapshotAndHeartbeatCallback(callback, heartbeating));
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

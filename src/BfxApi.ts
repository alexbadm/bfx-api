import * as WebSocket from 'ws';
import * as config from '../config.json';
import ActionsStack from './ActionsStack';
import Expectations, { MatchFunc } from './Expectations';

const allowedVersions = config.BitfinexAPIVersions;
const bfxAPI = config.BitfinexDefaultAPIUrl;

function MatchHeartbeat(chanId: number): MatchFunc {
  return (msg: any[]) => msg[0] === chanId && msg[1] === 'hb';
}

function MatchSnapshot(chanId: number): MatchFunc {
  return (msg: any[]) => msg[0] === chanId && msg[1] !== 'hb';
}

function mustBeFunction(callback: any) {
  if (typeof callback !== 'function') {
    throw new TypeError('BfxApi.subscribe error: callback must be a function');
  }
}

export type SnapshotCallback = (msg: Array<number|string>) => void;

export type wsOnOpen = (this: WebSocket, ev: { target: WebSocket } | Event) => any;
export interface IBfxApiParameters {
  apiKey?: string;
  apiSecret?: string;
  logger?: Console;
  url?: string;
  WebSocket?: typeof WebSocket;
}

const defaultBfxApiParameters = {
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

class BfxApi {
  private apiKey: string;
  private apiSecret: string;
  private url: string;

  private log: voidFunction;
  private debug: voidFunction;
  private error: voidFunction;
  private logger: Console;

  private paused: boolean;
  private resumeStack: ActionsStack;
  private pingCounter: number;

  private expectations: Expectations;
  private subscribed: ISubscribeEvent[];
  private ws: WebSocket;
  private WebSocket: typeof WebSocket;

  constructor(params: IBfxApiParameters = defaultBfxApiParameters) {
    params = { ...defaultBfxApiParameters, ...params };
    this.apiKey = params.apiKey;
    this.apiSecret = params.apiSecret;
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
    // this.subscribed = [];

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

  public auth() {
    if (this.paused) {
      this.resumeStack.add(this.auth);
      return;
    }
    this.log('auth not implemented');
  }

  public subscribeTicker(pair: string, callback: SnapshotCallback) {
    return this.subscribe('ticker', pair, { symbol: 't' + pair }, callback);
  }

  public subscribeFTicker(pair: string, callback: SnapshotCallback) {
    return this.subscribe('fticker', pair, { symbol: 'f' + pair }, callback);
  }

  public subscribeTrades(pair: string, callback: SnapshotCallback) {
    return this.subscribe('trades', pair, { symbol: 't' + pair }, callback);
  }

  public subscribeFTrades(pair: string, callback: SnapshotCallback) {
    return this.subscribe('trades', pair, { symbol: 'f' + pair }, callback);
  }

  public subscribeBooks(pair: string, callback: SnapshotCallback) {
    return this.subscribe('book', pair, { symbol: 't' + pair }, callback);
  }

  public subscribeRawBooks(pair: string, callback: SnapshotCallback) {
    return this.subscribe('book', pair, { symbol: 't' + pair, prec: 'R0' }, callback);
  }

  public subscribeCandles(pair: string, callback: SnapshotCallback, timeFrame = '1m') {
    return this.subscribe('candles', pair, { symbol: '', key: `trade:${timeFrame}:t${pair}` }, callback);
  }

  public ping() {
    if (this.paused) {
      this.resumeStack.add(this.ping);
      return;
    }
    const cid = ++this.pingCounter;
    this.expectations.once((msg) => msg.event === 'pong' && msg.cid === cid, ({ ts }) => {
      this.log('proper ping/pong, ts is', ts);
    });
    this.send(JSON.stringify({ cid, event: 'ping' }));
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

    switch (msg.event) {
      case 'info':
        this.processMsgInfo(msg);
        break;

      case 'subscribed':
        // this.onSubscribe(msg);
        break;

      case 'unsubscribed':
        // this.onUnsubscribe(msg);
        break;

      default:
        // TODO: keep unprocessed messages for future process
        this.debug('unprocessed message', msg);
    }
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
    channel: string, pair: string, params: ISubscribeParams, callback: SnapshotCallback,
  ): Promise<ISubscribeEvent> {
    mustBeFunction(callback);
    const event = 'subscribe';
    const debug = this.debug;
    this.send({ event, channel, ...params });
    return new Promise((resolve) => {
      this.expectations.once(
        (msg) => msg.event === 'subscribed' && msg.pair && msg.pair === pair,
        (msg) => resolve(msg),
      );
    })
    .then((e: ISubscribeEvent) => {
      debug('subscribed', e.chanId);
      this.expectations.whenever(MatchSnapshot(e.chanId), (msg) => callback(msg));
      this.expectations.whenever(MatchHeartbeat(e.chanId), ([chanId]) => debug('Heartbeating', {chanId}));
      return e;
    });
  }

  // private onSubscribe(data: ISubscribeEvent) {
  //   this.subscribed.push(data);
  //   this.debug('subscribed', this.subscribed);
  // }

  // private onUnsubscribe(data: IUnsubscribeEvent) {
  //   this.subscribed = this.subscribed.filter((subs) => subs.chanId !== data.chanId);
  //   this.debug('unsubscribed');
  //   this.debug('subscribed', this.subscribed);
  // }
}

export default BfxApi;

import * as WebSocket from 'ws';
import * as config from '../config.json';
import ActionsStack from './ActionsStack';
import Expectations from './Expectations';

const allowedVersions = config.BitfinexAPIVersions;
const bfxAPI = config.BitfinexDefaultAPIUrl;

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

interface ISubscribeEvent {
  chanId: number;
  channel: string;
  event: string;
  pair?: string;
  symbol?: string;
}

interface IUnsubscribeEvent {
  chanId: number;
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
    this.subscribed = [];

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
    // this.resume();
  }

  public close() {
    this.log('closing socket');
    this.ws.close();
  }

  // set onopen(openFunc: wsOnOpen) {
  //   this.ws.onopen = openFunc;
  // }

  public auth() {
    if (this.paused) {
      this.resumeStack.add(this.auth);
      return;
    }
    this.log('auth not implemented');
  }

  public subscribeTicker(pair: string, callback: (msg: any) => void) {
    const debug = this.debug;
    if (typeof callback !== 'function') {
      throw new TypeError('BfxApi.subscribeTicker error: callback must be a function');
    }

    this.subscribe('ticker', pair, { symbol: 't' + pair })
    .then((e: ISubscribeEvent) => {
      debug('subscribed', e.chanId);
      this.expectations.whenever(
        (msg) => msg[0] === e.chanId && Array.isArray(msg[1]),
        (msg) => callback(msg[1]));
      this.expectations.whenever(
        (msg) => msg[0] === e.chanId && msg[1] === 'hb',
        (msg) => debug('Heartbeating', msg[0]));
      return e;
    });
  }

  public subscribeFTicker(pair: string) {
    this.subscribe('fticker', pair, { symbol: 'f' + pair });
  }

  public subscribeTrades(pair: string) {
    this.subscribe('trades', pair, { symbol: 't' + pair });
  }

  public subscribeFTrades(pair: string) {
    this.subscribe('trades', pair, { symbol: 'f' + pair });
  }

  public subscribeBooks(pair: string) {
    this.subscribe('book', pair, { symbol: 't' + pair });
  }

  public subscribeRawBooks(pair: string) {
    this.subscribe('book', pair, { symbol: 't' + pair, prec: 'R0' });
  }

  public subscribeCandles(pair: string, timeFrame = '1m') {
    this.subscribe('candles', pair, { symbol: '', key: `trade:${timeFrame}:t${pair}` });
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
        this.onSubscribe(msg);
        break;

      case 'unsubscribed':
        this.onUnsubscribe(msg);
        break;

      default:
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

  private subscribe(channel: string, pair: string, params: ISubscribeParams): Promise<ISubscribeEvent> {
    const event = 'subscribe';
    this.send({ event, channel, ...params });
    return new Promise((resolve) => {
      this.expectations.once(
        (msg) => msg.event === 'subscribed' && msg.pair && msg.pair === pair,
        (msg) => resolve(msg),
      );
    });
  }

  private onSubscribe(data: ISubscribeEvent) {
    this.subscribed.push(data);
    this.debug('subscribed', this.subscribed);
  }

  private unsubscribe(chanId: number) {
    const event = 'unsubscribe';
    this.send({ event, chanId });
  }

  private onUnsubscribe(data: IUnsubscribeEvent) {
    this.subscribed = this.subscribed.filter((subs) => subs.chanId !== data.chanId);
    this.debug('unsubscribed');
    this.debug('subscribed', this.subscribed);
  }
}

export default BfxApi;

import * as config from "../config.json";
import ActionsStack from "./ActionsStack";
import Expectations from "./Expectations";

const allowedVersions = config.BitfinexAPIVersions;
const bfxAPI = config.BitfinexDefaultAPIUrl;

export type wsOnOpen = (this: WebSocket, ev: Event) => any;
export interface IBfxApiParameters {
  apiKey?: string;
  apiSecret?: string;
  logger: Console;
  url: string;
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
  pair: string;
  symbol: string;
}

interface IUnsubscribeEvent {
  chanId: number;
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

  constructor(params: IBfxApiParameters = defaultBfxApiParameters) {
    params = { ...defaultBfxApiParameters, ...params };
    this.apiKey = params.apiKey;
    this.apiSecret = params.apiSecret;
    this.url = params.url;

    this.logger = params.logger;
    this.log = this.logger.log;
    this.debug = this.logger.debug || this.log;
    this.error = this.logger.error || this.log;

    this.paused = false;
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
    this.debug("connect");
    this.expectations.add((msg) => msg.event === "info" && msg.version).process((msg) => {
      this.debug("msg.version", msg.version);
      if (allowedVersions.indexOf(msg.version) === -1) {
        this.error("unexpected version", msg.version);
        this.error("closing socket");
        this.ws.close();
      }
    });

    this.ws = new WebSocket(this.url);
    this.ws.onmessage = this.handleMessage.bind(this);
  }

  public close() {
    this.log("closing socket");
    this.ws.close();
  }

  set onopen(openFunc: wsOnOpen) {
    this.ws.onopen = openFunc;
  }

  public auth() {
    if (this.paused) {
      this.resumeStack.add(this.auth);
      return;
    }
    this.log("auth not implemented");
  }

  public subscribeTicker(pair: string) {
    this.subscribe("ticker", { symbol: "t" + pair });
  }

  public subscribeFTicker(pair: string) {
    this.subscribe("fticker", { symbol: "f" + pair });
  }

  public subscribeTrades(pair: string) {
    this.subscribe("trades", { symbol: "t" + pair });
  }

  public subscribeFTrades(pair: string) {
    this.subscribe("trades", { symbol: "f" + pair });
  }

  public subscribeBooks(pair: string) {
    this.subscribe("book", { symbol: "t" + pair });
  }

  public subscribeRawBooks(pair: string) {
    this.subscribe("book", { symbol: "t" + pair, prec: "R0" });
  }

  public subscribeCandles(pair: string, timeFrame = "1m") {
    this.subscribe("candles", { key: `trade:${timeFrame}:t${pair}` });
  }

  public ping() {
    if (this.paused) {
      this.resumeStack.add(this.ping);
      return;
    }
    const cid = ++this.pingCounter;
    this.expectations.add((msg) => msg.event === "pong" && msg.cid === cid).process(({ ts }) => {
      this.log("proper ping/pong, ts is", ts);
    });
    this.send(JSON.stringify({ cid, event: "ping" }));
  }

  private handleMessage(rawMsg: MessageEvent) {
    const msg = JSON.parse(rawMsg.data);

    if (this.expectations.exec(msg)) {
      return;
    }

    switch (msg.event) {
      case "info":
        this.processMsgInfo(msg);
        break;

      case "subscribed":
        this.onSubscribe(msg);
        break;

      case "unsubscribed":
        this.onUnsubscribe(msg);
        break;

      default:
        this.debug("unprocessed message", msg);
    }
  }

  private processMsgInfo(msg: IMsgInfo) {
    this.debug("info message", msg);

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
        this.log("unknown info message code", msg.code);
    }
  }

  private pause() {
    this.debug("pause");
    this.paused = true;
  }

  private resume() {
    this.debug("resume");
    this.paused = false;
    this.resumeStack.fire();
  }

  private restart() {
    this.debug("restart");
    this.close();
    this.connect();
  }

  private send(data: object | string) {
    if (this.paused) {
      this.resumeStack.add(this.send.bind(this, data));
      return;
    }
    if (this.ws.readyState !== WebSocket.OPEN) {
      this.error("ws is not ready");
      return;
    }
    if (typeof data !== "string") {
      data = JSON.stringify(data);
    }
    this.ws.send(data);
  }

  private subscribe(channel: string, params: object) {
    const event = "subscribe";
    this.send({ event, channel, ...params });
  }

  private onSubscribe(data: ISubscribeEvent) {
    this.subscribed.push(data);
    this.debug("subscribed", this.subscribed);
  }

  private ubsubscribe(chanId: number) {
    const event = "unsubscribe";
    this.send({ event, chanId });
  }

  private onUnsubscribe(data: IUnsubscribeEvent) {
    this.subscribed = this.subscribed.filter((subs) => subs.chanId !== data.chanId);
    this.debug("unsubscribed");
    this.debug("subscribed", this.subscribed);
  }
}

export default BfxApi;

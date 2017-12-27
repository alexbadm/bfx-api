/// <reference types="ws" />
import * as WebSocket from 'ws';
export declare type wsOnOpen = (this: WebSocket, ev: {
    target: WebSocket;
} | Event) => any;
export interface IBfxApiParameters {
    apiKey?: string;
    apiSecret?: string;
    logger?: Console;
    url?: string;
    WebSocket?: typeof WebSocket;
}
declare class BfxApi {
    private apiKey;
    private apiSecret;
    private url;
    private log;
    private debug;
    private error;
    private logger;
    private paused;
    private resumeStack;
    private pingCounter;
    private expectations;
    private subscribed;
    private ws;
    private WebSocket;
    constructor(params?: IBfxApiParameters);
    connect(): void;
    close(): void;
    auth(): void;
    subscribeTicker(pair: string, callback: (msg: any) => void): void;
    subscribeFTicker(pair: string): void;
    subscribeTrades(pair: string): void;
    subscribeFTrades(pair: string): void;
    subscribeBooks(pair: string): void;
    subscribeRawBooks(pair: string): void;
    subscribeCandles(pair: string, timeFrame?: string): void;
    ping(): void;
    private handleMessage(rawMsg);
    private processMsgInfo(msg);
    private pause();
    private resume();
    private restart();
    private send(data);
    private subscribe(channel, pair, params);
    private onSubscribe(data);
    private unsubscribe(chanId);
    private onUnsubscribe(data);
}
export default BfxApi;

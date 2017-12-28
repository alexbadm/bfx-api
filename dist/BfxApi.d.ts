/// <reference types="ws" />
import * as WebSocket from 'ws';
export declare type SnapshotCallback = (msg: Array<number | string>) => void;
export declare type wsOnOpen = (this: WebSocket, ev: {
    target: WebSocket;
} | Event) => any;
export interface IBfxApiParameters {
    logger?: Console;
    url?: string;
    WebSocket?: typeof WebSocket;
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
export interface IAuthEvent {
    event: 'auth';
    status: 'OK' | 'FAIL';
    chanId: 0;
    userId: number;
    caps: string;
    code: number;
}
declare class BfxApi {
    private url;
    private log;
    private debug;
    private error;
    private logger;
    private paused;
    private resumeStack;
    private pingCounter;
    private expectations;
    private ws;
    private WebSocket;
    constructor(params?: IBfxApiParameters);
    connect(): void;
    close(): void;
    auth(apiKey: string, apiSecret: string, callback: SnapshotCallback): Promise<{}>;
    subscribeTicker(pair: string, callback: SnapshotCallback): Promise<ISubscribeEvent>;
    subscribeFTicker(pair: string, callback: SnapshotCallback): Promise<ISubscribeEvent>;
    subscribeTrades(pair: string, callback: SnapshotCallback): Promise<ISubscribeEvent>;
    subscribeFTrades(pair: string, callback: SnapshotCallback): Promise<ISubscribeEvent>;
    subscribeBooks(pair: string, callback: SnapshotCallback): Promise<ISubscribeEvent>;
    subscribeRawBooks(pair: string, callback: SnapshotCallback): Promise<ISubscribeEvent>;
    subscribeCandles(pair: string, callback: SnapshotCallback, timeFrame?: string): Promise<ISubscribeEvent>;
    ping(): void;
    unsubscribe(chanId: number): Promise<IUnsubscribeEvent>;
    private handleMessage(rawMsg);
    private processMsgInfo(msg);
    private pause();
    private resume();
    private restart();
    private send(data);
    private subscribe(channel, params, callback);
}
export default BfxApi;

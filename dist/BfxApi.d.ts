export declare type SnapshotCallback = (msg: Array<number | string>) => void;
export interface BfxApiParameters {
    logger?: Console;
    url?: string;
}
export interface SubscribeEvent {
    chanId: number;
    channel: string;
    event: string;
    pair?: string;
    symbol?: string;
}
export interface UnsubscribeEvent {
    chanId: number;
    event: string;
}
export interface AuthEvent {
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
    constructor(params?: BfxApiParameters);
    connect(): void;
    close(): void;
    auth(apiKey: string, apiSecret: string, callback: SnapshotCallback): Promise<{}>;
    subscribeTicker(pair: string, callback: SnapshotCallback): Promise<SubscribeEvent>;
    subscribeFTicker(pair: string, callback: SnapshotCallback): Promise<SubscribeEvent>;
    subscribeTrades(pair: string, callback: SnapshotCallback): Promise<SubscribeEvent>;
    subscribeFTrades(pair: string, callback: SnapshotCallback): Promise<SubscribeEvent>;
    subscribeBooks(pair: string, callback: SnapshotCallback): Promise<SubscribeEvent>;
    subscribeRawBooks(pair: string, callback: SnapshotCallback): Promise<SubscribeEvent>;
    subscribeCandles(pair: string, callback: SnapshotCallback, timeFrame?: string): Promise<SubscribeEvent>;
    ping(): void;
    unsubscribe(chanId: number): Promise<UnsubscribeEvent>;
    private handleMessage(rawMsg);
    private processMsgInfo(msg);
    private pause();
    private resume();
    private restart();
    private send(data);
    private subscribe(channel, params, callback);
}
export default BfxApi;

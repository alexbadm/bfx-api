export declare type wsOnOpen = (this: WebSocket, ev: Event) => any;
export interface IBfxApiParameters {
    apiKey?: string;
    apiSecret?: string;
    logger: Console;
    url: string;
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
    constructor(params?: IBfxApiParameters);
    connect(): void;
    close(): void;
    onopen: wsOnOpen;
    auth(): void;
    subscribeTicker(pair: string): void;
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
    private subscribe(channel, params);
    private onSubscribe(data);
    private ubsubscribe(chanId);
    private onUnsubscribe(data);
}
export default BfxApi;

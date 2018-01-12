import { NotificationBody, OrderRequest, SubscribeEvent, UnsubscribeEvent } from './bitfinexTypes';
export declare type SnapshotCallback = (msg: Array<number | string>) => void;
export interface BfxApiParameters {
    logger?: Console;
    url?: string;
}
declare class BfxApi {
    private url;
    private log;
    private debug;
    private error;
    private logger;
    private authorized;
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
    newOrder(order: OrderRequest): Promise<NotificationBody>;
    newOrders(orders: OrderRequest[]): Promise<NotificationBody[]>;
    trades(orders: OrderRequest[]): Promise<any[]>;
    private handleMessage(rawMsg);
    private processMsgInfo(msg);
    private pause();
    private resume();
    private restart();
    private send(data);
    private subscribe(channel, params, callback);
}
export default BfxApi;

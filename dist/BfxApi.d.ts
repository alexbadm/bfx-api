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
export interface OrderRequest {
    gid?: number;
    cid?: number;
    type: string;
    symbol: string;
    amount: string;
    price?: string;
    price_trailing?: number;
    price_aux_limit?: number;
    hidden?: number;
    postonly?: number;
}
export declare type NotifyOnReq = [number, number | null, number, string, number | null, number | null, number, number, string, string | null, null, null, null, null, null, null, number, number | null, number | null, number | null, null, null, null, number | null, number | null, number | null];
export declare type NotificationBody = [number, string, number | null, null, NotifyOnReq, number | null, string, string];
export declare type Notification = [number, 'n', NotificationBody];
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
    private handleMessage(rawMsg);
    private processMsgInfo(msg);
    private pause();
    private resume();
    private restart();
    private send(data);
    private subscribe(channel, params, callback);
}
export default BfxApi;

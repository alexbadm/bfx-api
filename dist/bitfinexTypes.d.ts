export interface AuthEvent {
    event: 'auth';
    status: 'OK' | 'FAIL';
    chanId: 0;
    userId: number;
    caps: string;
    code: number;
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
    event: 'unsubscribed';
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

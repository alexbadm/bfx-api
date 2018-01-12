
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
  gid?: number; // int32	(optional) Group id for the order
  cid?: number; // int45	Must be unique in the day (UTC)
  type: string; // MARKET, EXCHANGE MARKET, LIMIT, EXCHANGE LIMIT, STOP, EXCHANGE STOP,
  // TRAILING STOP, EXCHANGE TRAILING STOP, FOK, EXCHANGE FOK, STOP LIMIT, EXCHANGE STOP LIMIT
  symbol: string; // symbol (tBTCUSD, tETHUSD, ...)
  amount: string; // decimal string	Positive for buy, Negative for sell
  price?: string; // decimal string	Price (Not required for market orders)
  price_trailing?: number; // decimal	The trailing price
  price_aux_limit?: number; // decimal	Auxiliary Limit price (for STOP LIMIT)
  hidden?: number; // int2	Whether the order is hidden (1) or not (0)
  postonly?: number; // int2	(optional) Whether the order is postonly (1) or not (0)
}

export type NotifyOnReq = [
  number, // ID,
  number | null, // GID,
  number, // CID,
  string, // SYMBOL,
  number | null, // MTS_CREATE,
  number | null, // MTS_UPDATE,
  number, // AMOUNT,
  number, // AMOUNT_ORIG,
  string, // TYPE,
  string | null, // TYPE_PREV,
  null, // _PLACEHOLDER,
  null, // _PLACEHOLDER,
  null, // FLAGS,
  null, // STATUS,
  null, // _PLACEHOLDER,
  null, // _PLACEHOLDER,
  number, // PRICE,
  number | null, // PRICE_AVG,
  number | null, // PRICE_TRAILING,
  number | null, // PRICE_AUX_LIMIT,
  null, // _PLACEHOLDER,
  null, // _PLACEHOLDER,
  null, // _PLACEHOLDER,
  number | null, // NOTIFY,
  number | null, // HIDDEN,
  number | null // PLACED_ID,
];

export type NotificationBody = [
  number, // MTS,
  string, // TYPE,
  number | null, // MESSAGE_ID,
  null,
  NotifyOnReq, // NOTIFY_INFO, // TODO: here may be another types
  number | null, // CODE,
  string, // STATUS,
  string // TEXT,
];

export type Notification = [
  number, // CHAN_ID
  'n',
  NotificationBody
];

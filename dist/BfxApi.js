"use strict";
var __assign = (this && this.__assign) || Object.assign || function(t) {
    for (var s, i = 1, n = arguments.length; i < n; i++) {
        s = arguments[i];
        for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
            t[p] = s[p];
    }
    return t;
};
Object.defineProperty(exports, "__esModule", { value: true });
var WebSocket = require("ws");
var config = require("../config.json");
var ActionsStack_1 = require("./ActionsStack");
var Expectations_1 = require("./Expectations");
var allowedVersions = config.BitfinexAPIVersions;
var bfxAPI = config.BitfinexDefaultAPIUrl;
function MatchHeartbeat(chanId) {
    return function (msg) { return msg[0] === chanId && msg[1] === 'hb'; };
}
function MatchSnapshot(chanId) {
    return function (msg) { return msg[0] === chanId && msg[1] !== 'hb'; };
}
var defaultBfxApiParameters = {
    logger: console,
    url: bfxAPI,
};
var BfxApi = /** @class */ (function () {
    function BfxApi(params) {
        if (params === void 0) { params = defaultBfxApiParameters; }
        params = __assign({}, defaultBfxApiParameters, params);
        this.apiKey = params.apiKey;
        this.apiSecret = params.apiSecret;
        this.url = params.url;
        this.WebSocket = params.WebSocket || WebSocket;
        this.logger = params.logger;
        this.log = this.logger.log;
        this.debug = this.logger.debug || this.log;
        this.error = this.logger.error || this.log;
        this.paused = true;
        this.resumeStack = new ActionsStack_1.default();
        this.pingCounter = 0;
        this.expectations = new Expectations_1.default();
        this.auth = this.auth.bind(this);
        this.close = this.close.bind(this);
        this.connect = this.connect.bind(this);
        this.ping = this.ping.bind(this);
        this.restart = this.restart.bind(this);
    }
    BfxApi.prototype.connect = function () {
        var _this = this;
        this.debug('connect');
        this.expectations.once(function (msg) { return msg.event === 'info' && msg.version; }, function (msg) {
            _this.debug('msg.version', msg.version);
            if (allowedVersions.indexOf(msg.version) === -1) {
                _this.error('unexpected version', msg.version);
                _this.error('closing socket');
                _this.ws.close();
            }
        });
        this.ws = new this.WebSocket(this.url);
        this.ws.onmessage = this.handleMessage.bind(this);
        this.ws.onopen = this.resume.bind(this);
    };
    BfxApi.prototype.close = function () {
        this.log('closing socket');
        this.ws.close();
    };
    BfxApi.prototype.auth = function () {
        this.log('auth not implemented');
    };
    BfxApi.prototype.subscribeTicker = function (pair, callback) {
        return this.subscribe('ticker', pair, { symbol: 't' + pair }, callback);
    };
    BfxApi.prototype.subscribeFTicker = function (pair, callback) {
        return this.subscribe('fticker', pair, { symbol: 'f' + pair }, callback);
    };
    BfxApi.prototype.subscribeTrades = function (pair, callback) {
        return this.subscribe('trades', pair, { symbol: 't' + pair }, callback);
    };
    BfxApi.prototype.subscribeFTrades = function (pair, callback) {
        return this.subscribe('trades', pair, { symbol: 'f' + pair }, callback);
    };
    BfxApi.prototype.subscribeBooks = function (pair, callback) {
        return this.subscribe('book', pair, { symbol: 't' + pair }, callback);
    };
    BfxApi.prototype.subscribeRawBooks = function (pair, callback) {
        return this.subscribe('book', pair, { symbol: 't' + pair, prec: 'R0' }, callback);
    };
    BfxApi.prototype.subscribeCandles = function (pair, callback, timeFrame) {
        if (timeFrame === void 0) { timeFrame = '1m'; }
        return this.subscribe('candles', pair, { symbol: '', key: "trade:" + timeFrame + ":t" + pair }, callback);
    };
    BfxApi.prototype.ping = function () {
        var _this = this;
        var cid = ++this.pingCounter;
        this.expectations.once(function (msg) { return msg.event === 'pong' && msg.cid === cid; }, function (_a) {
            var ts = _a.ts;
            _this.log('proper ping/pong, ts is', ts);
        });
        this.send({ cid: cid, event: 'ping' });
    };
    BfxApi.prototype.unsubscribe = function (chanId) {
        var _this = this;
        var event = 'unsubscribe';
        this.send({ event: event, chanId: chanId });
        return new Promise(function (resolve) {
            _this.expectations.once(function (msg) { return msg.event === 'unsubscribed' && msg.chanId === chanId; }, function (msg) { return resolve(msg); });
        });
    };
    BfxApi.prototype.handleMessage = function (rawMsg) {
        var msg = JSON.parse(rawMsg.data);
        if (this.expectations.exec(msg)) {
            return;
        }
        if (msg.event === 'info') {
            this.processMsgInfo(msg);
            return;
        }
        this.debug('unprocessed message', msg);
    };
    BfxApi.prototype.processMsgInfo = function (msg) {
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
    };
    BfxApi.prototype.pause = function () {
        this.debug('pause');
        this.paused = true;
    };
    BfxApi.prototype.resume = function () {
        this.debug('resume');
        this.paused = false;
        this.resumeStack.fire();
    };
    BfxApi.prototype.restart = function () {
        this.debug('restart');
        this.close();
        this.connect();
    };
    BfxApi.prototype.send = function (data) {
        if (this.paused || !this.ws || this.ws.readyState !== WebSocket.OPEN) {
            this.resumeStack.add(this.send.bind(this, data));
            return;
        }
        if (typeof data !== 'string') {
            data = JSON.stringify(data);
        }
        this.ws.send(data);
    };
    BfxApi.prototype.subscribe = function (channel, pair, params, callback) {
        var _this = this;
        return new Promise(function (resolve, reject) {
            if (typeof callback !== 'function') {
                reject(new TypeError('BfxApi.subscribe error: callback must be a function'));
                return;
            }
            var heartbeating = function (_a) {
                var chanId = _a[0];
                return _this.debug('Heartbeating', { chanId: chanId });
            };
            _this.expectations.once(function (msg) { return msg.event === 'subscribed' && msg.pair && msg.pair === pair; }, function (e) {
                _this.expectations.whenever(MatchSnapshot(e.chanId), function (msg) { return callback(msg); });
                _this.expectations.whenever(MatchHeartbeat(e.chanId), heartbeating);
                resolve(e);
            });
            _this.send(__assign({ event: 'subscribe', channel: channel }, params));
        });
    };
    return BfxApi;
}());
exports.default = BfxApi;
//# sourceMappingURL=BfxApi.js.map
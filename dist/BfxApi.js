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
var config = require("../config.json");
var ActionsStack_1 = require("./ActionsStack");
var Expectations_1 = require("./Expectations");
var allowedVersions = config.BitfinexAPIVersions;
var bfxAPI = config.BitfinexDefaultAPIUrl;
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
        this.logger = params.logger;
        this.log = this.logger.log;
        this.debug = this.logger.debug || this.log;
        this.error = this.logger.error || this.log;
        this.paused = false;
        this.resumeStack = new ActionsStack_1.default();
        this.pingCounter = 0;
        this.expectations = new Expectations_1.default();
        this.subscribed = [];
        this.auth = this.auth.bind(this);
        this.close = this.close.bind(this);
        this.connect = this.connect.bind(this);
        this.ping = this.ping.bind(this);
        this.restart = this.restart.bind(this);
    }
    BfxApi.prototype.connect = function () {
        var _this = this;
        this.debug("connect");
        this.expectations.add(function (msg) { return msg.event === "info" && msg.version; }).process(function (msg) {
            _this.debug("msg.version", msg.version);
            if (allowedVersions.indexOf(msg.version) === -1) {
                _this.error("unexpected version", msg.version);
                _this.error("closing socket");
                _this.ws.close();
            }
        });
        this.ws = new WebSocket(this.url);
        this.ws.onmessage = this.handleMessage.bind(this);
    };
    BfxApi.prototype.close = function () {
        this.log("closing socket");
        this.ws.close();
    };
    Object.defineProperty(BfxApi.prototype, "onopen", {
        set: function (openFunc) {
            this.ws.onopen = openFunc;
        },
        enumerable: true,
        configurable: true
    });
    BfxApi.prototype.auth = function () {
        if (this.paused) {
            this.resumeStack.add(this.auth);
            return;
        }
        this.log("auth not implemented");
    };
    BfxApi.prototype.subscribeTicker = function (pair) {
        this.subscribe("ticker", { symbol: "t" + pair });
    };
    BfxApi.prototype.subscribeFTicker = function (pair) {
        this.subscribe("fticker", { symbol: "f" + pair });
    };
    BfxApi.prototype.subscribeTrades = function (pair) {
        this.subscribe("trades", { symbol: "t" + pair });
    };
    BfxApi.prototype.subscribeFTrades = function (pair) {
        this.subscribe("trades", { symbol: "f" + pair });
    };
    BfxApi.prototype.subscribeBooks = function (pair) {
        this.subscribe("book", { symbol: "t" + pair });
    };
    BfxApi.prototype.subscribeRawBooks = function (pair) {
        this.subscribe("book", { symbol: "t" + pair, prec: "R0" });
    };
    BfxApi.prototype.subscribeCandles = function (pair, timeFrame) {
        if (timeFrame === void 0) { timeFrame = "1m"; }
        this.subscribe("candles", { key: "trade:" + timeFrame + ":t" + pair });
    };
    BfxApi.prototype.ping = function () {
        var _this = this;
        if (this.paused) {
            this.resumeStack.add(this.ping);
            return;
        }
        var cid = ++this.pingCounter;
        this.expectations.add(function (msg) { return msg.event === "pong" && msg.cid === cid; }).process(function (_a) {
            var ts = _a.ts;
            _this.log("proper ping/pong, ts is", ts);
        });
        this.send(JSON.stringify({ cid: cid, event: "ping" }));
    };
    BfxApi.prototype.handleMessage = function (rawMsg) {
        var msg = JSON.parse(rawMsg.data);
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
    };
    BfxApi.prototype.processMsgInfo = function (msg) {
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
    };
    BfxApi.prototype.pause = function () {
        this.debug("pause");
        this.paused = true;
    };
    BfxApi.prototype.resume = function () {
        this.debug("resume");
        this.paused = false;
        this.resumeStack.fire();
    };
    BfxApi.prototype.restart = function () {
        this.debug("restart");
        this.close();
        this.connect();
    };
    BfxApi.prototype.send = function (data) {
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
    };
    BfxApi.prototype.subscribe = function (channel, params) {
        var event = "subscribe";
        this.send(__assign({ event: event, channel: channel }, params));
    };
    BfxApi.prototype.onSubscribe = function (data) {
        this.subscribed.push(data);
        this.debug("subscribed", this.subscribed);
    };
    BfxApi.prototype.ubsubscribe = function (chanId) {
        var event = "unsubscribe";
        this.send({ event: event, chanId: chanId });
    };
    BfxApi.prototype.onUnsubscribe = function (data) {
        this.subscribed = this.subscribed.filter(function (subs) { return subs.chanId !== data.chanId; });
        this.debug("unsubscribed");
        this.debug("subscribed", this.subscribed);
    };
    return BfxApi;
}());
exports.default = BfxApi;
//# sourceMappingURL=BfxApi.js.map
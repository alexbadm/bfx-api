"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var ef = function () { };
var Expectation = /** @class */ (function () {
    function Expectation(match, process) {
        this.match = match;
        this.process = typeof process === 'function' ? process : ef;
    }
    return Expectation;
}());
var Processor = /** @class */ (function () {
    function Processor(p) {
        this.process = p;
    }
    return Processor;
}());
var Expectations = /** @class */ (function () {
    function Expectations() {
        this.expectations = [];
    }
    Expectations.prototype.add = function (match) {
        var _this = this;
        return new Processor(function (p) { return _this.expectations.push(new Expectation(match, p)); });
    };
    Expectations.prototype.exec = function (msg) {
        var expectation = this.expectations.find(function (exp) { return exp.match(msg); });
        if (!expectation) {
            return false;
        }
        expectation.process(msg);
        this.expectations = this.expectations.filter(function (exp) { return exp !== expectation; });
        return true;
    };
    return Expectations;
}());
exports.default = Expectations;
//# sourceMappingURL=Expectations.js.map
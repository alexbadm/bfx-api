"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var Expectation = /** @class */ (function () {
    function Expectation(match, process) {
        this.match = match;
        this.process = process;
    }
    return Expectation;
}());
// tslint:disable-next-line:max-classes-per-file
var Expectations = /** @class */ (function () {
    function Expectations() {
        this.expectationsObserve = [];
        this.expectationsOnce = [];
        this.expectationsWhenever = [];
    }
    Expectations.prototype.observe = function (match, process) {
        this.expectationsObserve.push(new Expectation(match, process));
    };
    Expectations.prototype.once = function (match, process) {
        this.expectationsOnce.push(new Expectation(match, process));
    };
    Expectations.prototype.whenever = function (match, process) {
        this.expectationsWhenever.push(new Expectation(match, process));
    };
    Expectations.prototype.exec = function (msg) {
        return this.execOnce(msg) || this.execWhenever(msg) || this.execObserve(msg);
    };
    Expectations.prototype.execObserve = function (msg) {
        var expIdx = this.expectationsObserve.findIndex(function (exp) { return exp.match(msg); });
        if (~expIdx) {
            this.expectationsObserve[expIdx].process(msg);
        }
        return false;
    };
    Expectations.prototype.execOnce = function (msg) {
        var expectation = this.expectationsOnce.find(function (exp) { return exp.match(msg); });
        if (!expectation) {
            return false;
        }
        this.expectationsOnce = this.expectationsOnce.filter(function (exp) { return exp !== expectation; });
        expectation.process(msg);
        return true;
    };
    Expectations.prototype.execWhenever = function (msg) {
        var expIdx = this.expectationsWhenever.findIndex(function (exp) { return exp.match(msg); });
        if (!~expIdx) {
            return false;
        }
        this.expectationsWhenever[expIdx].process(msg);
        return true;
    };
    return Expectations;
}());
exports.default = Expectations;
//# sourceMappingURL=Expectations.js.map
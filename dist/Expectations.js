var Expectation = /** @class */ (function () {
    function Expectation(match, process) {
        this.match = match;
        this.process = process;
    }
    return Expectation;
}());
function Processor(p) {
    return { process: p };
}
// tslint:disable-next-line:max-classes-per-file
var Expectations = /** @class */ (function () {
    function Expectations() {
        this.expectations = [];
    }
    Expectations.prototype.add = function (match) {
        var _this = this;
        return {
            process: function (p) { return _this.expectations.push(new Expectation(match, p)); },
        };
    };
    Expectations.prototype.exec = function (msg) {
        var expectation = this.expectations.find(function (exp) { return exp.match(msg); });
        if (!expectation) {
            return false;
        }
        this.expectations = this.expectations.filter(function (exp) { return exp !== expectation; });
        expectation.process(msg);
        return true;
    };
    return Expectations;
}());
export default Expectations;
//# sourceMappingURL=Expectations.js.map
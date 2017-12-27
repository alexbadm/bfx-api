"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var ActionsStack = /** @class */ (function () {
    function ActionsStack() {
        this.reject();
    }
    ActionsStack.prototype.add = function (action) {
        return this.stack.push(action);
    };
    ActionsStack.prototype.fire = function () {
        var stack = this.stack;
        this.reject();
        stack.forEach(function (action) { return action(); });
    };
    ActionsStack.prototype.reject = function () {
        this.stack = [];
    };
    return ActionsStack;
}());
exports.default = ActionsStack;
//# sourceMappingURL=ActionsStack.js.map
var ActionsStack = /** @class */ (function () {
    function ActionsStack() {
        this.reject();
    }
    ActionsStack.prototype.add = function (action) {
        return this.stack.push(action);
    };
    ActionsStack.prototype.fire = function () {
        this.stack.forEach(function (action) { return action(); });
        this.reject();
    };
    ActionsStack.prototype.reject = function () {
        this.stack = [];
    };
    return ActionsStack;
}());
export default ActionsStack;
//# sourceMappingURL=ActionsStack.js.map
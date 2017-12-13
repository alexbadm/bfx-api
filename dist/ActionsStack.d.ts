export declare type IAction = () => void;
export default class ActionsStack {
    private stack;
    constructor();
    add(action: IAction): number;
    fire(): void;
    reject(): void;
}

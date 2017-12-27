export type IAction = () => void;

export default class ActionsStack {
  private stack: IAction[];

  constructor() {
    this.reject();
  }

  public add(action: IAction) {
    return this.stack.push(action);
  }

  public fire() {
    const stack = this.stack;
    this.reject();
    stack.forEach((action) => action());
  }

  public reject() {
    this.stack = [];
  }
}

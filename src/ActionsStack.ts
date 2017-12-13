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
    this.stack.forEach((action) => action());
    this.reject();
  }

  public reject() {
    this.stack = [];
  }
}

interface IAction {
  (): void
}

export default class ActionsStack {
  stack: Array<IAction>

  constructor () {
    this.reject()
  }

  add (action: IAction) {
    return this.stack.push(action)
  }

  fire () {
    this.stack.forEach(action => action())
    this.reject()
  }

  reject () {
    this.stack = []
  }
}

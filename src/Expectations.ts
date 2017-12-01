const ef = () => {}

interface matchFunc {
  (msg: Object): boolean
}

interface processFunc {
  (msg: Object): void
}

class Expectation {
  match: matchFunc
  process: processFunc

  constructor (match: matchFunc, process: processFunc) {
    this.match = match
    this.process = typeof process === 'function' ? process : ef
  }
}

class Processor {
  process: processFunc
  constructor (p: (p: processFunc) => void) {
    this.process = p
  }
}

class Expectations {
  expectations: Array<Expectation>

  constructor () {
    this.expectations = []
  }

  add (match: matchFunc) {
    return new Processor((p: processFunc) => this.expectations.push(new Expectation(match, p)))
  }

  exec (msg: Object) {
    const expectation = this.expectations.find((exp: Expectation) => exp.match(msg))
    if (!expectation) {
      return false
    }

    expectation.process(msg)
    this.expectations = this.expectations.filter(exp => exp !== expectation)
    return true
  }
}

export default Expectations

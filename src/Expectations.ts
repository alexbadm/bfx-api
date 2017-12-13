export type matchFunc = (msg: any) => boolean;
export type processFunc = (msg: any) => void;

class Expectation {
  constructor(public match: matchFunc, public process: processFunc) {}
}

function Processor(p: processFunc) {
  return { process: p };
}

// tslint:disable-next-line:max-classes-per-file
class Expectations {
  private expectations: Expectation[];

  constructor() {
    this.expectations = [];
  }

  public add(match: matchFunc) {
    return {
      process: (p: processFunc) => this.expectations.push(new Expectation(match, p)),
    };
  }

  public exec(msg: any) {
    const expectation = this.expectations.find((exp) => exp.match(msg));
    if (!expectation) {
      return false;
    }

    this.expectations = this.expectations.filter((exp) => exp !== expectation);
    expectation.process(msg);
    return true;
  }
}

export default Expectations;

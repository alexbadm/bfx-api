export type MatchFunc = (msg: any) => boolean;
export type ProcessFunc = (msg: any) => void;

class Expectation {
  constructor(public match: MatchFunc, public process: ProcessFunc) {}
}

// tslint:disable-next-line:max-classes-per-file
class Expectations {
  private expectationsObserve: Expectation[];
  private expectationsOnce: Expectation[];
  private expectationsWhenever: Expectation[];

  constructor() {
    this.expectationsObserve = [];
    this.expectationsOnce = [];
    this.expectationsWhenever = [];
  }

  public observe(match: MatchFunc, process: ProcessFunc) {
    this.expectationsObserve.push(new Expectation(match, process));
  }

  public once(match: MatchFunc, process: ProcessFunc) {
    this.expectationsOnce.push(new Expectation(match, process));
  }

  public whenever(match: MatchFunc, process: ProcessFunc) {
    this.expectationsWhenever.push(new Expectation(match, process));
  }

  public exec(msg: any) {
    return this.execOnce(msg) || this.execWhenever(msg) || this.execObserve(msg);
  }

  private execObserve(msg: any) {
    const expIdx = this.expectationsObserve.findIndex((exp) => exp.match(msg));
    if (~expIdx) {
      this.expectationsObserve[expIdx].process(msg);
    }
    return false;
  }

  private execOnce(msg: any) {
    const expectation = this.expectationsOnce.find((exp) => exp.match(msg));
    if (!expectation) {
      return false;
    }

    this.expectationsOnce = this.expectationsOnce.filter((exp) => exp !== expectation);
    expectation.process(msg);
    return true;
  }

  private execWhenever(msg: any) {
    const expIdx = this.expectationsWhenever.findIndex((exp) => exp.match(msg));
    if (!~expIdx) {
      return false;
    }

    this.expectationsWhenever[expIdx].process(msg);
    return true;
  }
}

export default Expectations;

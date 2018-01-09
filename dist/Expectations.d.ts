export declare type MatchFunc = (msg: any) => boolean;
export declare type ProcessFunc = (msg: any) => void;
declare class Expectations {
    private expectationsObserve;
    private expectationsOnce;
    private expectationsWhenever;
    constructor();
    observe(match: MatchFunc, process: ProcessFunc): void;
    once(match: MatchFunc, process: ProcessFunc): void;
    whenever(match: MatchFunc, process: ProcessFunc): void;
    exec(msg: any): boolean;
    private execObserve(msg);
    private execOnce(msg);
    private execWhenever(msg);
}
export default Expectations;

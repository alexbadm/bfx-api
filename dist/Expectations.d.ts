export declare type MatchFunc = (msg: any) => boolean;
export declare type ProcessFunc = (msg: any) => void;
declare class Expectations {
    private expectationsOnce;
    private expectationsWhenever;
    constructor();
    once(match: MatchFunc, process: ProcessFunc): void;
    whenever(match: MatchFunc, process: ProcessFunc): void;
    exec(msg: any): boolean;
    execOne(msg: any): boolean;
    execWhenever(msg: any): boolean;
}
export default Expectations;

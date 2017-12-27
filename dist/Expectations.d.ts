export declare type matchFunc = (msg: any) => boolean;
export declare type processFunc = (msg: any) => void;
declare class Expectations {
    private expectationsOnce;
    private expectationsWhenever;
    constructor();
    once(match: matchFunc, process: processFunc): void;
    whenever(match: matchFunc, process: processFunc): void;
    exec(msg: any): boolean;
    execOne(msg: any): boolean;
    execWhenever(msg: any): boolean;
}
export default Expectations;

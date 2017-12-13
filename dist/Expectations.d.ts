export declare type matchFunc = (msg: any) => boolean;
export declare type processFunc = (msg: any) => void;
declare class Expectations {
    private expectations;
    constructor();
    add(match: matchFunc): {
        process: (p: processFunc) => number;
    };
    exec(msg: any): boolean;
}
export default Expectations;

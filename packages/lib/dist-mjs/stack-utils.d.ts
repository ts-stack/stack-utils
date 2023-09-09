/// <reference types="node" resolution-mode="require"/>
import type { StackUtilsOptions, StackData, StackLineData } from './mix.js';
export declare class StackUtils {
    protected opts: StackUtilsOptions;
    protected cwd: string;
    protected internals: RegExp[];
    protected wrapCallSite?: (callSite: NodeJS.CallSite) => NodeJS.CallSite;
    constructor(opts?: StackUtilsOptions);
    /**
     * Returns an array of regular expressions that be used to cull lines from the stack trace that
     * reference common Node.js internal files.
     */
    static nodeInternals(): RegExp[];
    /**
     * Cleans up a stack trace by deleting any lines that match the `internals` passed to the constructor,
     * and shortening file names relative to `cwd`.
     *
     * Returns a `string` with the cleaned up stack (always terminated with a `\n` newline character).
     * Spaces at the start of each line are trimmed, indentation can be added by setting `indent` to the
     * desired number of spaces.
     *
     * @todo Refactor this!
     */
    clean(stack: string | string[], indent?: number): string;
    /**
     * Captures the current stack trace, cleans it using `stackUtils.clean(stack)`, and returns a string with
     * the cleaned stack trace. It takes the same arguments as `stackUtils.capture`.
     */
    captureString(limit: number, fn?: (limit: number, fn?: any) => string): string;
    /**
     * Captures the current stack trace, returning an array of `CallSite`s. There are good overviews
     * of the available CallSite methods [here](https://github.com/v8/v8/wiki/Stack%20Trace%20API#customizing-stack-traces),
     * and [here](https://github.com/sindresorhus/callsites#api).
     *
     * @param limit Limits the number of lines returned by dropping all lines in excess of the limit.
     * This removes lines from the stack trace.
     * @param startStackFunction The function where the stack trace should start. The first line of the stack trace
     * will be the function that called `startStackFunction`. This removes lines from the end of the stack trace.
     */
    capture(limit?: number, startStackFunction?: (limit?: number, startStackFunction?: any) => any): any;
    /**
     * Captures the first line of the stack trace (or the first line after `startStackFunction` if supplied),
     * and returns a `CallSite` like object that is serialization friendly (properties are actual values
     * instead of getter functions).
     *
     * The available properties are:
     *
     * - `line`: `number`
     * - `column`: `number`
     * - `file`: `string`
     * - `constructor`: `boolean`
     * - `evalOrigin`: `string`
     * - `native`: `boolean`
     * - `type`: `string`
     * - `function`: `string`
     * - `method`: `string`
     */
    at(startStackFunction?: (...args: any[]) => any): {};
    /**
     * Parses a `string` (which should be a single line from a stack trace), and generates an object with
     * the following properties:
     *
     * - `line`: `number`
     * - `column`: `number`
     * - `file`: `string`
     * - `constructor`: `boolean`
     * - `evalOrigin`: `string`
     * - `evalLine`: `number`
     * - `evalColumn`: `number`
     * - `evalFile`: `string`
     * - `native`: `boolean`
     * - `function`: `string`
     * - `method`: `string`
     */
    parseLine(line: string): StackLineData | null;
    protected setFile(result: StackData, filename: string, cwd: string): void;
    protected ignoredPackagesRegExp(ignoredPackages: string[]): RegExp | any[];
    protected escapeStringRegexp(str: string): string;
}
//# sourceMappingURL=stack-utils.d.ts.map
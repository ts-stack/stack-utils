export interface StackUtilsOptions {
  /**
   * Is it necessary to delete the first line of the error that starts with `error.message`?
   *
   * Defult - `false`.
   */
  removeFirstLine?: boolean;
  /**
   * A set of regular expressions that match internal stack trace lines which should be culled
   * from the stack trace. The default is `StackUtils.nodeInternals()`, this can be disabled by setting `[]`
   * or appended using `StackUtils.nodeInternals().concat(additionalRegExp)`.  See also `ignoredPackages`.
   */
  internals?: RegExp[];
  /**
   * An array of npm modules to be culled from the stack trace. This list will mapped to regular
   * expressions and merged with the `internals`.
   *
   * Default `''`
   */
  ignoredPackages?: string[];
  /**
   * The path to the current working directory. File names in the stack trace will be shown
   * relative to this directory.
   */
  cwd?: string;
  /**
   * A mapping function for manipulating `CallSites` before processing. The first argument is a `CallSite` instance,
   * and the function should return a modified `CallSite`. This is useful for providing source map support.
   */
  wrapCallSite?(callSite: NodeJS.CallSite): NodeJS.CallSite;
}

export interface StackData {
  line?: number;
  column?: number;
  file?: string;
  constructor?: boolean;
  evalOrigin?: string;
  native?: boolean;
  function?: string;
  method?: string;
}

export interface CallSiteLike extends StackData {
  type?: string | undefined;
}

export interface StackLineData extends StackData {
  evalLine?: number;
  evalColumn?: number;
  evalFile?: string;
}

export interface StackUtilsOptions {
  internals?: RegExp[];
  ignoredPackages?: string[];
  cwd?: string;
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

import { builtinModules } from 'module';

import { StackUtilsOptions, StackData, StackLineData, CallSiteLike } from './mix';

const natives = []
  .concat(builtinModules, 'bootstrap_node', 'node')
  .map((n) => new RegExp(`(?:\\((?:node:)?${n}(?:\\.js)?:\\d+:\\d+\\)$|^\\s*at (?:node:)?${n}(?:\\.js)?:\\d+:\\d+$)`));

natives.push(
  /\((?:node:)?internal\/[^:]+:\d+:\d+\)$/,
  /\s*at (?:node:)?internal\/[^:]+:\d+:\d+$/,
  /\/\.node-spawn-wrap-\w+-\w+\/node:\d+:\d+\)?$/,
);

export class StackUtils {
  private _cwd: string;
  private _internals: RegExp[];
  private _wrapCallSite: (callSite: NodeJS.CallSite) => NodeJS.CallSite;

  constructor(opts: StackUtilsOptions) {
    opts = {
      ignoredPackages: [],
      ...opts,
    };

    if (!opts.internals) {
      opts.internals = StackUtils.nodeInternals();
    }

    if ('cwd' in opts === false) {
      opts.cwd = typeof process == 'object' && process && typeof process.cwd == 'function' ? process.cwd() : '.';
    }

    this._cwd = opts.cwd.replace(/\\/g, '/');
    this._internals = [].concat(opts.internals, ignoredPackagesRegExp(opts.ignoredPackages));

    this._wrapCallSite = opts.wrapCallSite;
  }

  /**
   * Returns an array of regular expressions that be used to cull lines from the stack trace that
   * reference common Node.js internal files.
   */
  static nodeInternals() {
    return [...natives];
  }

  /**
   * Cleans up a stack trace by deleting any lines that match the `internals` passed to the constructor,
   * and shortening file names relative to `cwd`.
   *
   * Returns a `string` with the cleaned up stack (always terminated with a `\n` newline character).
   * Spaces at the start of each line are trimmed, indentation can be added by setting `indent` to the
   * desired number of spaces.
   */
  clean(stack: string | string[], indent = 0) {
    if (!Array.isArray(stack)) {
      stack = stack.split('\n');
    }

    if (!/^\s*at /.test(stack[0]) && /^\s*at /.test(stack[1])) {
      stack = stack.slice(1);
    }

    let outdent = false;
    let lastNonAtLine: string = null;
    const result: string[] = [];

    stack.forEach((st) => {
      st = st.replace(/\\/g, '/');

      if (this._internals.some((internal) => internal.test(st))) {
        return;
      }

      const isAtLine = /^\s*at /.test(st);

      if (outdent) {
        st = st.trimEnd().replace(/^(\s+)at /, '$1');
      } else {
        st = st.trim();
        if (isAtLine) {
          st = st.slice(3);
        }
      }

      st = st.replace(`${this._cwd}/`, '');

      if (st) {
        if (isAtLine) {
          if (lastNonAtLine) {
            result.push(lastNonAtLine);
            lastNonAtLine = null;
          }

          result.push(st);
        } else {
          outdent = true;
          lastNonAtLine = st;
        }
      }
    });

    const indentStr = ' '.repeat(indent);
    return result.map((line) => `${indentStr}${line}\n`).join('');
  }

  /**
   * Captures the current stack trace, cleans it using `stackUtils.clean(stack)`, and returns a string with
   * the cleaned stack trace. It takes the same arguments as `stackUtils.capture`.
   *
   * @param limit
   * @param fn
   * @returns
   */
  captureString(limit: number, fn = this.captureString) {
    if (typeof limit == 'function') {
      fn = limit;
      limit = Infinity;
    }

    const { stackTraceLimit } = Error;
    if (limit) {
      Error.stackTraceLimit = limit;
    }

    const obj: any = {};

    Error.captureStackTrace(obj, fn);
    const { stack } = obj;
    Error.stackTraceLimit = stackTraceLimit;

    return this.clean(stack);
  }

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
  capture(limit: number = Infinity, startStackFunction = this.capture) {
    if (typeof limit == 'function') {
      startStackFunction = limit;
      limit = Infinity;
    }

    const { prepareStackTrace, stackTraceLimit } = Error;
    Error.prepareStackTrace = (obj, site) => {
      if (this._wrapCallSite) {
        return site.map(this._wrapCallSite);
      }

      return site;
    };

    if (limit) {
      Error.stackTraceLimit = limit;
    }

    const obj: any = {};
    Error.captureStackTrace(obj, startStackFunction);
    const { stack } = obj;
    Object.assign(Error, { prepareStackTrace, stackTraceLimit });

    return stack;
  }

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
  at(startStackFunction: (...args: any[]) => any = this.at) {
    const [site] = this.capture(1, startStackFunction);

    if (!site) {
      return {};
    }

    const res = {
      line: site.getLineNumber(),
      column: site.getColumnNumber(),
    } as CallSiteLike;

    setFile(res, site.getFileName(), this._cwd);

    if (site.isConstructor()) {
      Object.defineProperty(res, 'constructor', {
        value: true,
        configurable: true,
      });
    }

    if (site.isEval()) {
      res.evalOrigin = site.getEvalOrigin();
    }

    // Node v10 stopped with the isNative() on callsites, apparently
    /* istanbul ignore next */
    if (site.isNative()) {
      res.native = true;
    }

    let typename;
    try {
      typename = site.getTypeName();
    } catch (_) {}

    if (typename && typename !== 'Object' && typename !== '[object Object]') {
      res.type = typename;
    }

    const fname = site.getFunctionName();
    if (fname) {
      res.function = fname;
    }

    const meth = site.getMethodName();
    if (meth && fname !== meth) {
      res.method = meth;
    }

    return res;
  }

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
  parseLine(line: string) {
    const match = line && line.match(re);
    if (!match) {
      return null;
    }

    const ctor = match[1] === 'new';
    let fname = match[2];
    const evalOrigin = match[3];
    const evalFile = match[4];
    const evalLine = Number(match[5]);
    const evalCol = Number(match[6]);
    let file = match[7];
    const lnum = match[8];
    const col = match[9];
    const native = match[10] === 'native';
    const closeParen = match[11] === ')';
    let method;

    const res = {} as StackLineData;

    if (lnum) {
      res.line = Number(lnum);
    }

    if (col) {
      res.column = Number(col);
    }

    if (closeParen && file) {
      // make sure parens are balanced
      // if we have a file like "asdf) [as foo] (xyz.js", then odds are
      // that the fname should be += " (asdf) [as foo]" and the file
      // should be just "xyz.js"
      // walk backwards from the end to find the last unbalanced (
      let closes = 0;
      for (let i = file.length - 1; i > 0; i--) {
        if (file.charAt(i) === ')') {
          closes++;
        } else if (file.charAt(i) === '(' && file.charAt(i - 1) === ' ') {
          closes--;
          if (closes === -1 && file.charAt(i - 1) === ' ') {
            const before = file.slice(0, i - 1);
            const after = file.slice(i + 1);
            file = after;
            fname += ` (${before}`;
            break;
          }
        }
      }
    }

    if (fname) {
      const methodMatch = fname.match(/^(.*?) \[as (.*?)\]$/);
      if (methodMatch) {
        fname = methodMatch[1];
        method = methodMatch[2];
      }
    }

    setFile(res, file, this._cwd);

    if (ctor) {
      Object.defineProperty(res, 'constructor', {
        value: true,
        configurable: true,
      });
    }

    if (evalOrigin) {
      res.evalOrigin = evalOrigin;
      res.evalLine = evalLine;
      res.evalColumn = evalCol;
      res.evalFile = evalFile && evalFile.replace(/\\/g, '/');
    }

    if (native) {
      res.native = true;
    }

    if (fname) {
      res.function = fname;
    }

    if (method && fname !== method) {
      res.method = method;
    }

    return res;
  }
}

function setFile(result: StackData, filename: string, cwd: string) {
  if (filename) {
    filename = filename.replace(/\\/g, '/');
    if (filename.startsWith(`${cwd}/`)) {
      filename = filename.slice(cwd.length + 1);
    }

    result.file = filename;
  }
}

function ignoredPackagesRegExp(ignoredPackages: string[]): RegExp | any[] {
  if (ignoredPackages.length === 0) {
    return [];
  }

  const packages = ignoredPackages.map((mod) => (escapeStringRegexp as any)(mod));

  return new RegExp(`[\/\\\\]node_modules[\/\\\\](?:${packages.join('|')})[\/\\\\][^:]+:\\d+:\\d+`);
}

const re = new RegExp(
  '^' +
    // Sometimes we strip out the '    at' because it's noisy
    '(?:\\s*at )?' +
    // $1 = ctor if 'new'
    '(?:(new) )?' +
    // $2 = function name (can be literally anything)
    // May contain method at the end as [as xyz]
    '(?:(.*?) \\()?' +
    // (eval at <anonymous> (file.js:1:1),
    // $3 = eval origin
    // $4:$5:$6 are eval file/line/col, but not normally reported
    '(?:eval at ([^ ]+) \\((.+?):(\\d+):(\\d+)\\), )?' +
    // file:line:col
    // $7:$8:$9
    // $10 = 'native' if native
    '(?:(.+?):(\\d+):(\\d+)|(native))' +
    // maybe close the paren, then end
    // if $11 is ), then we only allow balanced parens in the filename
    // any imbalance is placed on the fname.  This is a heuristic, and
    // bound to be incorrect in some edge cases.  The bet is that
    // having weird characters in method names is more common than
    // having weird characters in filenames, which seems reasonable.
    '(\\)?)$',
);

function escapeStringRegexp(str: string) {
  if (typeof str !== 'string') {
    throw new TypeError('Expected a string');
  }

  // Escape characters with special meaning either inside or outside character sets.
  // Use a simple backslash escape when it’s always valid, and a `\xnn` escape when the simpler form would be disallowed by Unicode patterns’ stricter grammar.
  return str.replace(/[|\\{}()[\]^$+*?.]/g, '\\$&').replace(/-/g, '\\x2d');
}
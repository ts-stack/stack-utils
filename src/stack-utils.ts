import { builtinModules } from 'module';

import { StackUtilsOptions, StackData, StackLineData, CallSiteLike } from './mix';

type CallSite = NodeJS.CallSite;
const cwd = typeof process == 'object' && process && typeof process.cwd == 'function' ? process.cwd() : '.';

const natives = []
  .concat(builtinModules, 'bootstrap_node', 'node')
  .map((n) => new RegExp(`(?:\\((?:node:)?${n}(?:\\.js)?:\\d+:\\d+\\)$|^\\s*at (?:node:)?${n}(?:\\.js)?:\\d+:\\d+$)`));

natives.push(
  /\((?:node:)?internal\/[^:]+:\d+:\d+\)$/,
  /\s*at (?:node:)?internal\/[^:]+:\d+:\d+$/,
  /\/\.node-spawn-wrap-\w+-\w+\/node:\d+:\d+\)?$/,
);

type wrapCallSiteFn = (callSite: CallSite, index: number, array: CallSite[]) => CallSite;

export class StackUtils {
  private _cwd: string;
  private _internals: RegExp[];
  private _wrapCallSite: wrapCallSiteFn;

  constructor(opts: StackUtilsOptions) {
    opts = {
      ignoredPackages: [],
      ...opts,
    };

    if (!opts.internals) {
      opts.internals = StackUtils.nodeInternals();
    }

    if ('cwd' in opts === false) {
      opts.cwd = cwd;
    }

    this._cwd = opts.cwd.replace(/\\/g, '/');
    this._internals = [].concat(opts.internals, ignoredPackagesRegExp(opts.ignoredPackages));

    this._wrapCallSite = opts.wrapCallSite;
  }

  static nodeInternals() {
    return [...natives];
  }

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

  capture(limit: number, fn = this.capture) {
    if (typeof limit == 'function') {
      fn = limit;
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
    Error.captureStackTrace(obj, fn);
    const { stack } = obj;
    Object.assign(Error, { prepareStackTrace, stackTraceLimit });

    return stack;
  }

  at(fn: (...args: any[]) => any = this.at) {
    const [site] = this.capture(1, fn);

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
      const methodMatch = fname.match(methodRe);
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

const methodRe = /^(.*?) \[as (.*?)\]$/;

function escapeStringRegexp(str: string) {
	if (typeof str !== 'string') {
		throw new TypeError('Expected a string');
	}

	// Escape characters with special meaning either inside or outside character sets.
	// Use a simple backslash escape when it’s always valid, and a `\xnn` escape when the simpler form would be disallowed by Unicode patterns’ stricter grammar.
	return str
		.replace(/[|\\{}()[\]^$+*?.]/g, '\\$&')
		.replace(/-/g, '\\x2d');
}

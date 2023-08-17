# @ts-stack/stack-utils 

> Captures and cleans stack traces.

This is a fork of the [tapjs/stack-utils v2.0.5 project](https://github.com/tapjs/stack-utils/tree/v2.0.5)

## Install

```
$ npm install --save @ts-stack/stack-utils
```

## Usage

```ts
import { StackUtils } from '@ts-stack/stack-utils';

const stack = new StackUtils({ cwd: process.cwd(), internals: StackUtils.nodeInternals() });

console.log(stack.clean(new Error().stack));
// outputs a beautified stack trace
```

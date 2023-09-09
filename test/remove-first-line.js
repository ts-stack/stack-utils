'use strict';

const t = require('tap');
const { StackUtils } = require('@ts-stack/stack-utils');


t.test('removes only first line in the trace', t => {
  const stackUtils = new StackUtils();
  const stack = `DiError: No provider for OtherService! (HelloWorldController.prototype.helloWorld -> MyService -> OtherService)
    at noProviderError (/srv/git/ts-stack/stack-utils/packages/core/src/di/error-handling.ts:42:17)
    at Function.findInRegistryCurrentProvider (/srv/git/ts-stack/stack-utils/packages/core/src/di/deps-checker.ts:86:28)
    at Function.findInRegistryCurrentProvider (/srv/git/ts-stack/stack-utils/packages/core/src/di/deps-checker.ts:76:21)
    at Function.findInRegistryCurrentProvider (/srv/git/ts-stack/stack-utils/packages/core/src/di/deps-checker.ts:76:21)
    at Function.findInRegistryCurrentProvider (/srv/git/ts-stack/stack-utils/packages/core/src/di/deps-checker.ts:76:21)
    at Function.selectInjectorAndCheckDeps (/srv/git/ts-stack/stack-utils/packages/core/src/di/deps-checker.ts:42:17)
    at /srv/git/ts-stack/stack-utils/packages/core/src/di/deps-checker.ts:117:19
    at Array.forEach (<anonymous>)
    at Function.findInRegistryDeps (/srv/git/ts-stack/stack-utils/packages/core/src/di/deps-checker.ts:116:18)
    at Function.checkMultiOrRegularProvider (/srv/git/ts-stack/stack-utils/packages/core/src/di/deps-checker.ts:110:19)`;
  const cleanedStack = stackUtils.clean(stack);
  t.equal(cleanedStack, `${stack}\n`);
  t.end();
});

t.test('removes only first line in the trace', t => {
  const stackUtils = new StackUtils({ removeFirstLine: true });
  const stack = `DiError: No provider for OtherService! (HelloWorldController.prototype.helloWorld -> MyService -> OtherService)
    at noProviderError (/srv/git/ts-stack/stack-utils/packages/core/src/di/error-handling.ts:42:17)
    at Function.findInRegistryCurrentProvider (/srv/git/ts-stack/stack-utils/packages/core/src/di/deps-checker.ts:86:28)
    at Function.findInRegistryCurrentProvider (/srv/git/ts-stack/stack-utils/packages/core/src/di/deps-checker.ts:76:21)
    at Function.findInRegistryCurrentProvider (/srv/git/ts-stack/stack-utils/packages/core/src/di/deps-checker.ts:76:21)
    at Function.findInRegistryCurrentProvider (/srv/git/ts-stack/stack-utils/packages/core/src/di/deps-checker.ts:76:21)
    at Function.selectInjectorAndCheckDeps (/srv/git/ts-stack/stack-utils/packages/core/src/di/deps-checker.ts:42:17)
    at /srv/git/ts-stack/stack-utils/packages/core/src/di/deps-checker.ts:117:19
    at Array.forEach (<anonymous>)
    at Function.findInRegistryDeps (/srv/git/ts-stack/stack-utils/packages/core/src/di/deps-checker.ts:116:18)
    at Function.checkMultiOrRegularProvider (/srv/git/ts-stack/stack-utils/packages/core/src/di/deps-checker.ts:110:19)`;

  const expected = `noProviderError (/srv/git/ts-stack/stack-utils/packages/core/src/di/error-handling.ts:42:17)
Function.findInRegistryCurrentProvider (/srv/git/ts-stack/stack-utils/packages/core/src/di/deps-checker.ts:86:28)
Function.findInRegistryCurrentProvider (/srv/git/ts-stack/stack-utils/packages/core/src/di/deps-checker.ts:76:21)
Function.findInRegistryCurrentProvider (/srv/git/ts-stack/stack-utils/packages/core/src/di/deps-checker.ts:76:21)
Function.findInRegistryCurrentProvider (/srv/git/ts-stack/stack-utils/packages/core/src/di/deps-checker.ts:76:21)
Function.selectInjectorAndCheckDeps (/srv/git/ts-stack/stack-utils/packages/core/src/di/deps-checker.ts:42:17)
/srv/git/ts-stack/stack-utils/packages/core/src/di/deps-checker.ts:117:19
Array.forEach (<anonymous>)
Function.findInRegistryDeps (/srv/git/ts-stack/stack-utils/packages/core/src/di/deps-checker.ts:116:18)
Function.checkMultiOrRegularProvider (/srv/git/ts-stack/stack-utils/packages/core/src/di/deps-checker.ts:110:19)
`;
  const cleanedStack = stackUtils.clean(stack);
  t.equal(cleanedStack, expected);
  t.end();
});

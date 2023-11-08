import webpackDevMiddleware from '@rsbuild/shared/webpack-dev-middleware';
import type { DevMiddleware } from '../../server/types';
import { setupServerHooks, isClientCompiler } from '@rsbuild/shared';

import type { Compiler, MultiCompiler } from '@rspack/core';

function applyHMREntry(compiler: Compiler, clientPath: string) {
  if (!isClientCompiler(compiler)) {
    return;
  }

  for (const key in compiler.options.entry) {
    compiler.options.entry[key].import = [
      clientPath,
      ...(compiler.options.entry[key].import || []),
    ];
  }
}

export const getDevMiddleware =
  (multiCompiler: Compiler | MultiCompiler): NonNullable<DevMiddleware> =>
  (options) => {
    const { hmrClientPath, callbacks, ...restOptions } = options;

    const setupCompiler = (compiler: Compiler) => {
      if (hmrClientPath) {
        applyHMREntry(compiler, hmrClientPath);
      }
      // register hooks for each compilation, update socket stats if recompiled
      setupServerHooks(compiler, callbacks);
    };

    if ((multiCompiler as MultiCompiler).compilers) {
      (multiCompiler as MultiCompiler).compilers.forEach(setupCompiler);
    } else {
      setupCompiler(multiCompiler as Compiler);
    }

    // @ts-expect-error compiler type mismatch
    return webpackDevMiddleware(multiCompiler, restOptions);
  };

import {
  type CssModules,
  isCssModules,
  isInNodeModules,
} from '@rsbuild/shared';
import type { CssModuleLocalsConvention } from '@rsbuild/shared';
import cssModulesTypescriptLoader from '@rsbuild/shared/css-modules-typescript-loader';
import type { LoaderContext } from '@rspack/core';
import type { PostcssParsePluginOptions } from './postcssIcssExtractPlugin';

async function processCss(
  inputSource: string,
  {
    exportLocalsConvention,
  }: {
    exportLocalsConvention: CssModuleLocalsConvention;
  },
) {
  const { default: postcss } = await import('postcss');

  const { default: localByDefault } = await import(
    '@rsbuild/shared/postcss-modules-local-by-default'
  );

  const { default: modulesScope } = await import(
    '@rsbuild/shared/postcss-modules-scope'
  );

  const { default: postcssICSSExtractPlugin } = await import(
    './postcssIcssExtractPlugin'
  );

  const { default: extractImports } = await import(
    '@rsbuild/shared/postcss-modules-extract-imports'
  );

  const { default: modulesValues } = await import(
    '@rsbuild/shared/postcss-modules-values'
  );

  const parserOptions = {
    exportLocalsConvention,
  } as PostcssParsePluginOptions;

  // https://github.com/webpack-contrib/css-loader/blob/4673caa4aa68d5fb1127c172b4afd081bd56eb73/src/utils.js#L776
  const pipeline = postcss([
    localByDefault({
      mode: 'local',
    }),
    extractImports(),
    modulesValues,
    modulesScope({
      // scopedName is not important in this scenario
      generateScopedName: (exportName: string) => exportName,
      exportGlobals: false,
    }),
    postcssICSSExtractPlugin(parserOptions),
  ]);

  await pipeline.process(inputSource, {
    from: '/fake-css-modules-loader',
    to: undefined,
  });

  return {
    cssModuleKeys: parserOptions.cssModuleKeys,
  };
}

export default async function (
  this: LoaderContext<{
    modules: Required<CssModules>;
    mode: string;
  }>,
  content: string,
  ...input: any[]
) {
  if (this.cacheable) {
    this.cacheable();
  }

  const filename = this.resourcePath;
  const { modules } = this.getOptions() || {};
  const callback = this.async();

  // filter files
  if (!isCssModules(filename, modules) || isInNodeModules(filename)) {
    return callback(null, content, ...input);
  }

  // handle css modules like css-loader, but only get cssModuleKeys not modify the source.
  const { cssModuleKeys } = await processCss(content, {
    exportLocalsConvention: modules.exportLocalsConvention,
  });

  // @ts-expect-error
  this.cssModuleKeys = cssModuleKeys;

  return cssModulesTypescriptLoader.call(this, content, ...input);
}

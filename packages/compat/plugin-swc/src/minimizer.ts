import { type NormalizedConfig, __internalHelper, logger } from '@rsbuild/core';
import { color, deepmerge } from '@rsbuild/shared';
import type { webpack } from '@rsbuild/webpack';
import { minify, minifyCss } from './binding';
import { JS_REGEX } from './constants';
import type { CssMinifyOptions, JsMinifyOptions, Output } from './types';

export interface NormalizedSwcMinifyOption {
  jsMinify?: JsMinifyOptions;
  cssMinify?: CssMinifyOptions;
}

const normalize = <T>(
  v: T | boolean | undefined,
  defaultValue: T,
): T | undefined => {
  if (v === true || v === undefined) {
    return defaultValue;
  }
  if (v === false) {
    return undefined;
  }
  return v;
};

const CSS_REGEX = /\.css$/;

export class SwcMinimizerPlugin {
  private readonly minifyOptions: NormalizedSwcMinifyOption;

  private name = 'swc-minimizer-plugin';

  constructor(options: {
    jsMinify?: boolean | JsMinifyOptions;
    cssMinify?: boolean | CssMinifyOptions;
    rsbuildConfig: NormalizedConfig;
  }) {
    this.minifyOptions = {
      jsMinify: options.jsMinify
        ? deepmerge(
            this.getDefaultJsMinifyOptions(options.rsbuildConfig),
            normalize(options.jsMinify, {}),
          )
        : undefined,
      cssMinify: options.cssMinify
        ? normalize(options.cssMinify, {})
        : undefined,
    };
  }

  getDefaultJsMinifyOptions(rsbuildConfig: NormalizedConfig): JsMinifyOptions {
    const options = {
      ...__internalHelper.getSwcMinimizerOptions(rsbuildConfig),
      mangle: true,
    };

    // extractComments not supported yet
    delete options.extractComments;

    return options;
  }

  apply(compiler: webpack.Compiler): void {
    const meta = JSON.stringify({
      name: 'swc-minify',
      options: this.minifyOptions,
    });

    compiler.hooks.compilation.tap(this.name, async (compilation) => {
      const { Compilation } = compiler.webpack;
      const { devtool } = compilation.options;
      const { jsMinify, cssMinify } = this.minifyOptions;

      const enableMinify =
        typeof devtool === 'string'
          ? devtool.includes('source-map')
          : Boolean(devtool);
      const inlineSourceContent =
        typeof devtool === 'string' && devtool.includes('inline');

      if (jsMinify) {
        jsMinify.sourceMap = enableMinify;
        jsMinify.inlineSourcesContent = inlineSourceContent;
      }

      if (cssMinify) {
        cssMinify.sourceMap = enableMinify;
        cssMinify.inlineSourceContent = inlineSourceContent;
      }

      compilation.hooks.chunkHash.tap(this.name, (_, hash) =>
        hash.update(meta),
      );

      compilation.hooks.processAssets.tapPromise(
        {
          name: this.name,
          stage: Compilation.PROCESS_ASSETS_STAGE_OPTIMIZE_SIZE,
        },
        async () => {
          try {
            await this.updateAssets(compilation);
          } catch (e) {
            compilation.errors.push(
              new compiler.webpack.WebpackError(`[SWC Minify]: ${e}`),
            );
          }
        },
      );
    });
  }

  async updateAssets(compilation: webpack.Compilation): Promise<void[]> {
    const cache = compilation.getCache(this.name);

    const { SourceMapSource, RawSource } = compilation.compiler.webpack.sources;
    const assets = compilation
      .getAssets()
      .filter(
        (asset) =>
          !asset.info.minimized &&
          (JS_REGEX.test(asset.name) || CSS_REGEX.test(asset.name)),
      );

    const assetsWithCache = await Promise.all(
      assets.map(async ({ name, info, source }) => {
        const eTag = cache.getLazyHashedEtag(source);
        const cacheItem = cache.getItemCache(name, eTag);
        return {
          name,
          info,
          source,
          cacheItem,
        };
      }),
    );

    const { cssMinify, jsMinify } = this.minifyOptions;
    return Promise.all(
      assetsWithCache.map(async (asset) => {
        const cache = await asset.cacheItem.getPromise<{
          minifiedSource: InstanceType<
            typeof SourceMapSource | typeof RawSource
          >;
        }>();

        let minifiedSource = cache ? cache.minifiedSource : null;

        if (!minifiedSource) {
          const { source, map } = asset.source.sourceAndMap();
          let minifyResult: Output | undefined;
          let needSourceMap = false;
          const filename = asset.name;

          if (jsMinify && filename.endsWith('.js')) {
            needSourceMap = jsMinify.sourceMap!;
            minifyResult = await minifyWithTimeout(filename, () => {
              return minify(filename, source.toString(), jsMinify);
            });
          } else if (cssMinify && filename.endsWith('.css')) {
            needSourceMap = cssMinify.sourceMap!;
            minifyResult = await minifyWithTimeout(filename, () => {
              return minifyCss(filename, source.toString(), cssMinify);
            });
          }

          if (minifyResult) {
            minifiedSource =
              needSourceMap && minifyResult.map
                ? new SourceMapSource(
                    minifyResult.code,
                    asset.name,
                    minifyResult.map,
                    source.toString(),
                    map,
                    true,
                  )
                : new RawSource(minifyResult.code || '');
          }
        }

        if (minifiedSource) {
          await asset.cacheItem.storePromise({
            minifiedSource,
          });

          compilation.updateAsset(asset.name, minifiedSource, {
            ...asset.info,
            minimized: true,
          });
        }
      }),
    );
  }
}

/**
 * Currently SWC minify is not stable as we expected, there is a
 * change that it can never ends, so add a warning if it hangs too long.
 */
function minifyWithTimeout(
  filename: string,
  minify: () => Promise<Output>,
): Promise<Output> {
  const timer = setTimeout(() => {
    logger.warn(
      `SWC minimize has running for over 180 seconds for a single file: ${filename}\n
It is likely that you've encountered a ${color.red(
        'SWC internal bug',
      )}, please contact us at https://github.com/web-infra-dev/modern.js/issues`,
    );
  }, 180_000);

  const outputPromise = minify();

  outputPromise.finally(() => {
    clearTimeout(timer);
  });

  return outputPromise;
}

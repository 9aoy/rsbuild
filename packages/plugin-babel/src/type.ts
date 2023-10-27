import type {
  ChainedConfig,
  BabelTransformOptions,
  BabelConfigUtils,
} from '@rsbuild/shared';

/**
 * Modify the options of [babel-loader](https://github.com/babel/babel-loader)
 *
 * When `babelOptions`'s type is Function，the default babel config will be passed in as the first parameter, the config object can be modified directly, or a value can be returned as the final result.
 *
 * When `babelOptions`'s type is `Object`, the config will be shallow merged with default config by `Object.assign`.
 *
 * Note that `Object.assign` is a shallow copy and will completely overwrite the built-in `presets` or `plugins` array, please use it with caution.
 */
export type PluginBabelOptions = ChainedConfig<
  BabelTransformOptions,
  BabelConfigUtils
>;

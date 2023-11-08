import { RsbuildPlugin } from '../types';
import { awaitableGetter, Plugins } from '@rsbuild/shared';

export const applyDefaultPlugins = (plugins: Plugins) =>
  awaitableGetter<RsbuildPlugin>([
    import('../plugins/transition').then((m) => m.pluginTransition()),
    import('../plugins/basic').then((m) => m.pluginBasic()),
    plugins.entry(),
    // plugins.cache(),
    plugins.target(),
    import('../plugins/output').then((m) => m.pluginOutput()),
    plugins.devtool(),
    import('../plugins/resolve').then((m) => m.pluginResolve()),
    plugins.fileSize(),
    // cleanOutput plugin should before the html plugin
    plugins.cleanOutput(),
    plugins.font(),
    plugins.image(),
    plugins.media(),
    plugins.svg(),
    plugins.html(),
    plugins.wasm(),
    plugins.moment(),
    plugins.nodeAddons(),
    plugins.define(),
    import('../plugins/css').then((m) => m.pluginCss()),
    import('../plugins/less').then((m) => m.pluginLess()),
    import('../plugins/sass').then((m) => m.pluginSass()),
    import('../plugins/minimize').then((m) => m.pluginMinimize()),
    plugins.rem(),
    import('../plugins/hmr').then((m) => m.pluginHMR()),
    import('../plugins/progress').then((m) => m.pluginProgress()),
    import('../plugins/swc').then((m) => m.pluginSwc()),
    plugins.externals(),
    plugins.toml(),
    plugins.yaml(),
    plugins.splitChunks(),
    plugins.startUrl(),
    plugins.inlineChunk(),
    plugins.bundleAnalyzer(),
    plugins.assetsRetry(),
    plugins.networkPerformance(),
    plugins.preloadOrPrefetch(),
    plugins.performance(),
    import('../plugins/rspack-profile').then((m) => m.pluginRspackProfile()),
    import('../plugins/fallback').then((m) => m.pluginFallback()), // fallback should be the last plugin
  ]);

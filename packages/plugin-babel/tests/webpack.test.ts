import { expect, describe, it } from 'vitest';
import { pluginEntry } from '@rsbuild/core/plugins/entry';
import { pluginBabel } from '../src';
import { createStubRsbuild } from '@rsbuild/test-helper';
import { webpackProvider } from '@rsbuild/webpack';

describe('plugin-babel webpack mode', () => {
  it('should set babel-loader', async () => {
    const rsbuild = await createStubRsbuild({
      plugins: [pluginBabel()],
      rsbuildConfig: {
        output: {
          polyfill: 'entry' as const,
        },
      },
      provider: webpackProvider,
    });
    const config = await rsbuild.unwrapConfig();

    expect(config).toMatchSnapshot();
  });

  it('should set include/exclude', async () => {
    const rsbuild = await createStubRsbuild({
      plugins: [
        pluginBabel((options, { addIncludes, addExcludes }) => {
          addIncludes(['src/**/*.ts']);
          addExcludes(['src/**/*.js']);
          return options;
        }),
      ],
      provider: webpackProvider,
      rsbuildConfig: {},
    });
    const config = await rsbuild.unwrapConfig();

    expect(config).toMatchSnapshot();
  });

  it('should apply exclude condition when using source.exclude', async () => {
    const rsbuild = await createStubRsbuild({
      plugins: [pluginBabel()],
      rsbuildConfig: {
        source: {
          exclude: ['src/foo/**/*.js'],
        },
      },
      provider: webpackProvider,
    });
    const config = await rsbuild.unwrapConfig();

    expect(config).toMatchSnapshot();
  });

  it('should add core-js-entry when output.polyfill is entry', async () => {
    const rsbuild = await createStubRsbuild({
      plugins: [pluginEntry(), pluginBabel()],
      rsbuildConfig: {
        output: {
          polyfill: 'entry' as const,
        },
      },
      provider: webpackProvider,
      entry: {
        main: './index.js',
      },
    });
    const config = await rsbuild.unwrapConfig();
    expect(config.entry).toMatchSnapshot();
  });

  it('should not add core-js-entry when output.polyfill is usage', async () => {
    const rsbuild = await createStubRsbuild({
      plugins: [pluginEntry(), pluginBabel()],
      rsbuildConfig: {
        output: {
          // TODO ???
          polyfill: 'usage' as const,
        },
      },
      provider: webpackProvider,
      entry: {
        main: './index.js',
      },
    });
    const config = await rsbuild.unwrapConfig();
    expect(config.entry).toMatchSnapshot();
  });

  it('should override targets of babel-preset-env when using output.overrideBrowserslist config', async () => {
    const rsbuild = await createStubRsbuild({
      plugins: [pluginBabel()],
      rsbuildConfig: {
        output: {
          overrideBrowserslist: ['Chrome 80'],
        },
      },
      provider: webpackProvider,
    });
    const config = await rsbuild.unwrapConfig();

    expect(config).toMatchSnapshot();
  });

  it('should add rule to compile Data URI when enable source.compileJsDataURI', async () => {
    const rsbuild = await createStubRsbuild({
      plugins: [pluginBabel()],
      rsbuildConfig: {
        source: {
          compileJsDataURI: true,
        },
      },
      provider: webpackProvider,
    });
    const config = await rsbuild.unwrapConfig();

    expect(config).toMatchSnapshot();
  });

  it('should adjust jsescOption config when charset is utf8', async () => {
    const rsbuild = await createStubRsbuild({
      plugins: [pluginBabel()],
      rsbuildConfig: {
        output: {
          charset: 'utf8' as const,
        },
      },
      provider: webpackProvider,
    });
    const config = await rsbuild.unwrapConfig();

    expect(JSON.stringify(config)).toContain(
      '"generatorOpts":{"jsescOption":{"minimal":true}}',
    );
  });

  it('should adjust browserslist when target is node', async () => {
    const rsbuild = await createStubRsbuild({
      plugins: [pluginBabel()],
      target: 'node',
      rsbuildConfig: {},
      provider: webpackProvider,
    });
    const config = await rsbuild.unwrapConfig();

    expect(config).toMatchSnapshot();
  });

  it('should set proper pluginImport option in Babel', async () => {
    // camelToDashComponentName
    const rsbuild = await createStubRsbuild({
      plugins: [pluginBabel()],
      rsbuildConfig: {
        source: {
          transformImport: [
            {
              libraryName: 'foo',
              camelToDashComponentName: true,
            },
          ],
        },
      },
      provider: webpackProvider,
    });
    const config = await rsbuild.unwrapConfig();

    const babelRules = config.module!.rules?.filter((item) => {
      return item?.use?.[0].loader.includes('babel-loader');
    });

    expect(babelRules).toMatchSnapshot();
  });

  it('should not set default pluginImport for Babel', async () => {
    // camelToDashComponentName
    const rsbuild = await createStubRsbuild({
      plugins: [pluginBabel()],
      provider: webpackProvider,
    });
    const config = await rsbuild.unwrapConfig();

    const babelRules = config.module!.rules?.filter((item) => {
      return item?.use?.[0].loader.includes('babel-loader');
    });

    expect(babelRules).toMatchSnapshot();
  });

  it('should not have any pluginImport in Babel', async () => {
    // camelToDashComponentName
    const rsbuild = await createStubRsbuild({
      plugins: [pluginBabel()],
      rsbuildConfig: {
        source: {
          transformImport: false,
        },
      },
      provider: webpackProvider,
    });
    const config = await rsbuild.unwrapConfig();

    const babelRules = config.module!.rules?.filter((item) => {
      return item?.use?.[0].loader.includes('babel-loader');
    });

    expect(babelRules).toMatchSnapshot();
  });
});

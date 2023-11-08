import type { IncomingMessage, ServerResponse } from 'http';
import type { Server } from 'http';
import type {
  DevServerOptions,
  NextFunction,
  RequestHandler,
  ExposeServerApis,
} from '@rsbuild/shared';

type Middleware = (
  req: IncomingMessage,
  res: ServerResponse,
  next: NextFunction,
) => Promise<void>;

export { DevServerOptions, RequestHandler, ExposeServerApis };

export type DevMiddlewareAPI = Middleware & {
  close: (callback: (err: Error | null | undefined) => void) => any;
};

export type MiddlewareCallbacks = {
  onInvalid: () => void;
  onDone: (stats: any) => void;
};

export type DevMiddlewareOptions = {
  /** To ensure HMR works, the devMiddleware need inject the hmr client path into page when HMR enable. */
  hmrClientPath?: string;

  /** The options need by compiler middleware (like webpackMiddleware) */
  headers?: Record<string, string | string[]>;
  writeToDisk?: boolean | ((filename: string) => boolean);
  stats?: boolean;

  /** should trigger when compiler hook called */
  callbacks: MiddlewareCallbacks;

  /** whether use Server Side Render */
  serverSideRender?: boolean;
};

/**
 * The rsbuild/server do nothing about compiler, the devMiddleware need do such things to ensure dev works well:
 * - Call compiler.watch （normally did by webpack-dev-middleware）.
 * - Inject the hmr client path into page （the hmr client rsbuild/server already provide）.
 * - Notify server when compiler hooks are triggered.
 */
export type DevMiddleware = (options: DevMiddlewareOptions) => DevMiddlewareAPI;

export type DevServerHttpsOptions = boolean | { key: string; cert: string };

export type RsbuildDevServerOptions = {
  pwd: string;
  dev: boolean | Partial<DevServerOptions>;
  devMiddleware?: DevMiddleware;
};

export type CreateDevServerOptions = {
  server?: {
    customApp?: Server;
  };
} & RsbuildDevServerOptions;

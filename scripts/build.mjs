import * as esbuild from 'esbuild';

const nativeNodeModulesPlugin = {
  name: 'native-node-modules',
  setup(build) {
    build.onResolve({ filter: /\.node$/, namespace: 'file' }, args => ({
      path: args.path,
      external: true,
    }))
  },
}

esbuild.build({
  entryPoints: ['src/index.ts'],
  bundle: true,
  platform: 'node',
  target: 'node20',
  outfile: 'dist/index.js',
  external: ['better-sqlite3', 'fsevents', 'path', 'fs', 'child_process', 'events'],
  sourcemap: false,
  plugins: [nativeNodeModulesPlugin],
  minify: process.env.NODE_ENV === 'production',
  format: 'cjs',
}).catch(() => process.exit(1));

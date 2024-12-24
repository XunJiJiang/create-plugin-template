import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'rollup'
import typescript from '@rollup/plugin-typescript'
import nodeResolve from '@rollup/plugin-node-resolve'
import terser from '@rollup/plugin-terser'
import babel from '@rollup/plugin-babel'
import alias from '@rollup/plugin-alias'

const __dirname = dirname(fileURLToPath(import.meta.url))

const joinTo = (...paths) => resolve(__dirname, ...paths)

export default defineConfig(() => {
  return {
    plugins: [
      typescript({
        tsconfig: joinTo('tsconfig.json'),
        allowSyntheticDefaultImports: true,
        moduleResolution: 'NodeNext',
        module: 'NodeNext',
        target: 'esnext'
      }),
      nodeResolve({ extensions: ['.ts'] }),
      terser(),
      babel({
        babelHelpers: 'bundled',
        extensions: ['.ts'],
        presets: ['@babel/preset-typescript']
      }),
      alias({
        entries: [
          {
            find: '@',
            replacement: joinTo('src')
          }
        ]
      })
    ],
    input: joinTo('src/index.ts'),
    output: {
      dir: joinTo('dist'),
      format: 'es',
      entryFileNames: '[name].mjs'
    }
  }
})

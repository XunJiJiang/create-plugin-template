import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import process from 'node:process'
import { defineConfig } from 'rollup'
import typescript from '@rollup/plugin-typescript'
import nodeResolve from '@rollup/plugin-node-resolve'
import terser from '@rollup/plugin-terser'
import babel from '@rollup/plugin-babel'
import alias from '@rollup/plugin-alias'
import commonjs from '@rollup/plugin-commonjs'
import json from '@rollup/plugin-json'
import esbuild from 'rollup-plugin-esbuild'

const __dirname = dirname(fileURLToPath(import.meta.url))

const joinTo = (...paths) => resolve(__dirname, ...paths)

export default defineConfig(() => {
  return {
    plugins: [
      esbuild({
        // All options are optional
        include: /\.[jt]sx?$/,
        exclude: /node_modules/,
        sourceMap: false,
        minify: process.env.NODE_ENV === 'production',
        target: 'esnext',
        define: {
          __VERSION__: '"x.y.z"'
        },
        tsconfig: 'tsconfig.json',
        loaders: {
          '.json': 'json'
        }
      }),
      commonjs({
        include: 'node_modules/**'
      }),
      json(),
      typescript({
        tsconfig: joinTo('tsconfig.json'),
        allowSyntheticDefaultImports: true,
        moduleResolution: 'NodeNext',
        module: 'NodeNext',
        target: 'esnext'
      }),
      nodeResolve({
        extensions: ['.ts', '.js', '.json'],
        preferBuiltins: true
      }),
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

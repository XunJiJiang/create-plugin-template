/* eslint-disable @typescript-eslint/no-explicit-any */
import { exec } from 'node:child_process'

type Version = `^${number}.${number}.${number}`

// [let:devDependencies] =>     "@babel/preset-typescript": "^7.26.0",
//                              "@eslint/js": "^9.17.0",
//                              "@rollup/plugin-alias": "^5.1.1",
//                              "@rollup/plugin-babel": "^6.0.4",
//                              "@rollup/plugin-node-resolve": "^16.0.0",
//                              "@rollup/plugin-terser": "^0.4.4",
//                              "@rollup/plugin-typescript": "^12.1.2",
//                              "@tsconfig/node20": "^20.1.4",
//                              "@types/eslint__js": "^8.42.3",
//                              "@types/node": "^20.17.10",
//                              "eslint": "^9.17.0",
//                              "eslint-config-prettier": "^9.1.0",
//                              "eslint-import-resolver-alias": "^1.1.2",
//                              "eslint-plugin-import": "^2.31.0",
//                              "eslint-plugin-prettier": "^5.2.1",
//                              "globals": "^15.14.0",
//                              "prettier": "^3.4.2",
//                              "rollup": "^4.29.1",
//                              "rollup-plugin-dts": "^6.1.1",
//                              "typescript": "^5.7.2",
//                              "typescript-eslint": "^8.18.2",

const baseDepList = [
  '@rollup/plugin-alias',
  '@rollup/plugin-babel',
  '@rollup/plugin-node-resolve',
  '@rollup/plugin-terser',
  '@tsconfig/node20',
  '@types/node',
  'globals',
  'rollup',
  'rollup-plugin-dts'
] as const

// const nodeDepList = ['@types/node'] as const

const viteDepList = ['vite'] as const

const tsDepList = [
  '@babel/preset-typescript',
  '@rollup/plugin-typescript',
  'tslib',
  'typescript'
] as const

const eslintDepList = [
  '@eslint/js',
  '@types/eslint__js',
  'eslint',
  'eslint-import-resolver-alias',
  'eslint-plugin-import'
] as const

const tsAndEslintDepList = ['typescript-eslint'] as const

const prettierDepList = ['prettier'] as const

const prettierAndEslintDepList = [
  'eslint-config-prettier',
  'eslint-plugin-prettier'
] as const

type BaseDep = {
  [key in (typeof baseDepList)[number]]: Version
}

type TsDep = {
  [key in (typeof tsDepList)[number]]: Version
}

type EslintDep = {
  [key in (typeof eslintDepList)[number]]: Version
}

type TsAndEslintDep = {
  [key in (typeof tsAndEslintDepList)[number]]: Version
}

type PrettierDep = {
  [key in (typeof prettierDepList)[number]]: Version
}

type PrettierAndEslintDep = {
  [key in (typeof prettierAndEslintDepList)[number]]: Version
}

type WhichDep<T> = T extends typeof tsDepList
  ? BaseDep
  : T extends typeof tsDepList
    ? TsDep
    : T extends typeof eslintDepList
      ? EslintDep
      : T extends typeof prettierDepList
        ? TsAndEslintDep
        : T extends typeof prettierDepList
          ? PrettierDep
          : T extends typeof prettierAndEslintDepList
            ? PrettierAndEslintDep
            : never

const createDep = async <
  T extends
    | typeof baseDepList
    | typeof tsDepList
    | typeof eslintDepList
    | typeof tsAndEslintDepList
    | typeof prettierDepList
    | typeof prettierAndEslintDepList
>(
  depList: T
): Promise<WhichDep<T>> => {
  const result = {} as any
  for (const dep of depList) {
    result[dep] = `^${await getLatestVersion(dep)}` as Version
  }
  return result
}

export const getBaseDep = async () =>
  Object.entries(await createDep(baseDepList)).map(([k, v]) => {
    return `"${k}": "${v}"`
  })
// export const getNodeDep = async () =>
//   nodeDepList.map((v) => {
//     const version = process.versions.node.split('.')
//     version[2] = '0'
//     return `"${v}": "^${version.join('.')}"`
//   })
export const getViteDep = async () =>
  viteDepList.map((v) => {
    return `"${v}": "^6.0.0"`
  })
export const getTsDep = async () =>
  Object.entries(await createDep(tsDepList)).map(([k, v]) => {
    return `"${k}": "${v}"`
  })
export const getEslintDep = async () =>
  Object.entries(await createDep(eslintDepList)).map(([k, v]) => {
    return `"${k}": "${v}"`
  })
export const getTsAndEslintDep = async () =>
  Object.entries(await createDep(tsAndEslintDepList)).map(([k, v]) => {
    return `"${k}": "${v}"`
  })
export const getPrettierDep = async () =>
  Object.entries(await createDep(prettierDepList)).map(([k, v]) => {
    return `"${k}": "${v}"`
  })
export const getPrettierAndEslintDep = async () =>
  Object.entries(await createDep(prettierAndEslintDepList)).map(([k, v]) => {
    return `"${k}": "${v}"`
  })

export function getLatestVersion(packageName: string): Promise<string> {
  const command = `npm show ${packageName} version`
  return new Promise((resolve, reject) => {
    exec(command, (error, stdout, stderr) => {
      if (error) {
        console.error(`exec error: ${error}`)
        return reject(error)
      }
      if (stderr) {
        console.error(`stderr: ${stderr}`)
        return reject(stderr)
      }
      return resolve(stdout.toString().trim())
    })
  })
}

/* eslint-disable @typescript-eslint/no-explicit-any */
import { input } from '@inquirer/prompts'
import ora from 'ora'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { cwd, platform } from 'node:process'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import {
  getBaseDep,
  getEslintDep,
  getNodeDep,
  getPrettierAndEslintDep,
  getPrettierDep,
  getTsAndEslintDep,
  getTsDep,
  getViteDep
} from './utils/dependencies.js'

const __filename = fileURLToPath(import.meta.url)
const __root = join(dirname(__filename), '..')
const __pkgParentDir = cwd()
const templateDir = join(__root, 'template')

// [let:name] => my-package
// [let:"name"] => "my-package"
// [let:description] => My package description
// [let:"description"] => "My package description"
// [let:author] => John Doe
// [let:"author"] => "John Doe"
// [let:script] =>     "build": "rollup --config ./rollup.config.js && rollup --config ./rollup.config.dts.js",
//                     "release": [let:releaseScript]
// [let:releaseScript] => "powershell ./publish.ps1" | "bash ./publish.sh"
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

type ReleaseScript = [`"powershell ./publish.ps1"` | `"bash ./publish.sh"`]

type Script =
  | [
      `"build": "rollup --config ./rollup.config.js${' && rollup --config ./rollup.config.dts.js' | ''}"`,
      `"release": ${ReleaseScript[0]}`
    ]
  | [
      `"build": "rollup --config ./rollup.config.js${' && rollup --config ./rollup.config.dts.js' | ''}"`
    ]

interface TempLets {
  name: [string]
  description: [string]
  author: [string]
  script: Script
  releaseScript: ReleaseScript | [null]
  devDependencies: string[]
}

const tempLets: TempLets = {
  name: [''],
  description: [''],
  author: [''],
  script: [
    `"build": "rollup --config ./rollup.config.js && rollup --config ./rollup.config.dts.js"`
  ],
  releaseScript: [null],
  devDependencies: ['']
}

interface InputInfo {
  name: string
  description: string
  author: string
  useAutoRelease: boolean
  releaseScript: ReleaseScript[0] | null
  useTs: boolean
  useEslint: boolean
  usePrettier: boolean
}

/**
 *
 * @param tempLet
 * @param indent 前置缩进(空格数)
 */
const generateTempLet = (tempLet: TempLets[keyof TempLets], indent: number) =>
  tempLet.map((v) => (v === null ? '' : ' '.repeat(indent) + v)).join(',\n')

const checkLetPattern = (str: string): string[] | false => {
  const match = str.match(/\[let:(.+?)\]/g)
  return match ? match : false
}

const sortDevDependencies = () => {
  tempLets.devDependencies.sort((a, b) => a.localeCompare(b))
}

class FileNode {
  constructor(
    public name: string,
    public content: string
  ) {}

  toString(i: number): string {
    const indent = ' '.repeat(i)
    return `${indent}  { name: ${this.name}, content: ... }`
  }
}

class DirNode {
  constructor(
    public name: string,
    public children: (DirNode | FileNode)[] = []
  ) {}

  toString(i: number = 0): string {
    const indent = ' '.repeat(i)
    return (
      `${indent}{\n` +
      `${indent}  name: ${this.name},\n` +
      `${indent}  children: [\n` +
      this.children.map((child) => `${child.toString(i + 2)}`).join(',\n') +
      `\n` +
      `${indent}  ]\n` +
      `${indent}}`
    )
  }
}

const fileTemp: DirNode = new DirNode('')

async function main() {
  await asyncPipe(
    inputInfo,
    createTempLets,
    createPackageJson,
    createBaseFiles,
    createLetFiles,
    createFiles
  )()
  spinner.stop()

  console.log('Done.')

  // {
  //   name,
  //   description,
  //   author,
  //   useAutoRelease,
  //   releaseScript,
  //   useTs,
  //   useEslint,
  //   usePrettier
  // }
}

main()

const spinner = ora('Get dependency version...')

async function inputInfo(): Promise<InputInfo> {
  const name = await input({
    message: 'Package name',
    required: true,
    validate: (value) => {
      if (!/^@?[a-zA-Z0-9-_/]+$/.test(value))
        return 'Name can only contain URL-friendly characters.'
      return true
    }
  })

  const description = await input({
    message: 'description'
  })

  const author = await input({
    message: 'author'
  })

  const useAutoRelease = /^(y)$/i.test(
    await input({
      message: 'Add release script? (Y/n)',
      default: 'Y',
      validate: (value) => {
        if (!/^(y|n)$/i.test(value)) return 'Please enter Y or n.'
        return true
      }
    })
  )

  const releaseScriptType = platform.includes('win') ? 'powershell' : 'bash'

  const releaseScript = useAutoRelease
    ? releaseScriptType === 'powershell'
      ? '"powershell ./publish.ps1"'
      : '"bash ./publish.sh"'
    : null

  const useTs = /^(y)$/i.test(
    await input({
      message: 'Use typescript? (Y/n)',
      default: 'Y',
      validate: (value) => {
        if (!/^(y|n)$/i.test(value)) return 'Please enter Y or n.'
        return true
      }
    })
  )

  const useEslint = /^(y)$/i.test(
    await input({
      message: 'Use eslint? (Y/n)',
      default: 'Y',
      validate: (value) => {
        if (!/^(y|n)$/i.test(value)) return 'Please enter Y or n.'
        return true
      }
    })
  )

  const usePrettier = /^(y)$/i.test(
    await input({
      message: 'Use prettier? (Y/n)',
      default: 'Y',
      validate: (value) => {
        if (!/^(y|n)$/i.test(value)) return 'Please enter Y or n.'
        return true
      }
    })
  )

  return {
    name,
    description,
    author,
    useAutoRelease,
    releaseScript,
    useTs,
    useEslint,
    usePrettier
  }
}

async function createTempLets({
  name,
  description,
  author,
  useAutoRelease,
  releaseScript,
  useTs,
  useEslint,
  usePrettier
}: InputInfo): Promise<InputInfo> {
  spinner.start()

  fileTemp.name = name

  tempLets.name[0] = name
  tempLets.description[0] = description
  tempLets.author[0] = author
  tempLets.releaseScript[0] = releaseScript ?? tempLets.releaseScript[0]

  if (!useTs)
    tempLets.script[0] = `"build": "rollup --config ./rollup.config.js"`

  if (useAutoRelease && tempLets.releaseScript[0]) {
    tempLets.script[1] = `"release": ${tempLets.releaseScript[0]}`
  }

  tempLets.devDependencies = [
    ...(await getBaseDep()),
    ...(await getNodeDep()),
    ...(await getViteDep())
  ]
  if (useTs) tempLets.devDependencies.push(...(await getTsDep()))
  if (useEslint) tempLets.devDependencies.push(...(await getEslintDep()))
  if (usePrettier) tempLets.devDependencies.push(...(await getPrettierDep()))
  if (useEslint && usePrettier)
    tempLets.devDependencies.push(...(await getPrettierAndEslintDep()))
  if (useTs && useEslint)
    tempLets.devDependencies.push(...(await getTsAndEslintDep()))
  sortDevDependencies()

  return {
    name,
    description,
    author,
    useAutoRelease,
    releaseScript,
    useTs,
    useEslint,
    usePrettier
  }
}

async function createPackageJson(inputInfo: InputInfo): Promise<InputInfo> {
  const packageJsonTemplate = readFileSync(
    join(templateDir, 'package.json.template.txt')
  ).toString()

  const packageJson = await parseLet(packageJsonTemplate)

  fileTemp.children.push(new FileNode('package.json', packageJson))

  return inputInfo
}

/**
 * 没有let的文件
 */
async function createBaseFiles({
  usePrettier,
  useEslint,
  useTs,
  ...props
}: InputInfo): Promise<InputInfo> {
  const baseFiles = ['.npmrc', 'rollup.config.js']

  if (useTs)
    baseFiles.push(
      'tsconfig.json',
      'tsconfig.node.json',
      'rollup.config.dts.js'
    )
  if (useEslint) baseFiles.push('eslint.config.mjs') // 当读取文件时，处理prettier相关的配置文件
  if (usePrettier) baseFiles.push('.prettierignore', '.prettierrc')

  for (const file of baseFiles) {
    const fileContent = readFileSync(
      join(templateDir, file + '.template.txt')
    ).toString()
    if (file === 'eslint.config.mjs') {
      let lines = fileContent.split('\n')
      if (!useTs) {
        lines = lines.filter(
          (line, i) =>
            !line.toLowerCase().includes('typescript') &&
            !line.toLowerCase().includes('dts') &&
            (i < 37 || i > 39)
        )
      }
      if (!usePrettier) {
        lines = lines.filter((line) => !line.toLowerCase().includes('prettier'))
      }
      fileTemp.children.push(new FileNode(file, lines.join('\n')))
      continue
    } else if (file === 'rollup.config.js') {
      let lines = fileContent.split('\n')
      if (!useTs) {
        lines = lines
          .filter(
            (line, i) =>
              !line.toLowerCase().includes('typescript') && (i < 16 || i > 22)
          )
          .map((v) => v.replace(/\.ts/, '.js'))
      }
      fileTemp.children.push(new FileNode(file, lines.join('\n')))
      continue
    }
    fileTemp.children.push(new FileNode(file, fileContent))
  }

  return {
    usePrettier,
    useEslint,
    useTs,
    ...props
  }
}

/**
 * 有let的文件
 */
async function createLetFiles({
  useTs,
  useAutoRelease,
  ...props
}: InputInfo): Promise<InputInfo> {
  const tsFiles = ((useTs) => {
    if (useTs) return ['index.ts']
    return ['index.js']
  })(useTs)

  for (const file of tsFiles) {
    const fileContent = readFileSync(
      join(templateDir, 'src', file + '.template.txt')
    ).toString()
    fileTemp.children.push(
      new DirNode('src', [new FileNode(file, await parseLet(fileContent))])
    )
  }

  if (useAutoRelease) {
    const fileName = platform.includes('win') ? 'publish.ps1' : 'publish.sh'
    const fileContent = readFileSync(
      join(templateDir, fileName + '.template.txt')
    ).toString()
    fileTemp.children.push(new FileNode(fileName, await parseLet(fileContent)))
  }

  const files = ['README.md', 'LICENSE']
  for (const file of files) {
    const fileContent = readFileSync(
      join(templateDir, file + '.template.txt')
    ).toString()
    fileTemp.children.push(new FileNode(file, await parseLet(fileContent)))
  }

  return {
    useTs,
    useAutoRelease,
    ...props
  }
}

/**
 * 创建文件
 */
async function createFiles() {
  function createFile(node: DirNode | FileNode, parentPath: string) {
    const path = join(parentPath, node.name)
    if (node instanceof FileNode) {
      writeFileSync(path, node.content)
    } else {
      mkdirSync(path)
      for (const child of node.children) {
        createFile(child, path)
      }
    }
  }

  createFile(fileTemp, __pkgParentDir)
}

/**
 * 解析let
 */
async function parseLet(content: string): Promise<string> {
  const lines = content.split('\n')
  let result = ''

  for (const line of lines) {
    const letPatterns = checkLetPattern(line)
    let _line = line
    if (letPatterns) {
      letPatterns.forEach((letPattern) => {
        letPattern = letPattern.match(/\[let:(.+?)\]/)![1]

        switch (letPattern) {
          case 'name':
            _line = _line.replace(/\[let:name\]/, tempLets.name[0])
            break
          case '"name"':
            _line = _line.replace(/\[let:"name"\]/, `"${tempLets.name[0]}"`)
            break
          case 'description':
            _line = _line.replace(
              /\[let:description\]/,
              tempLets.description[0]
            )
            break
          case '"description"':
            _line = _line.replace(
              /\[let:"description"\]/,
              `"${tempLets.description[0]}"`
            )
            break
          case 'author':
            _line = _line.replace(/\[let:author\]/, tempLets.author[0])
            break
          case '"author"':
            _line = _line.replace(/\[let:"author"\]/, `"${tempLets.author[0]}"`)
            break
          case 'script':
            _line = _line.replace(
              /\[let:script\]/,
              generateTempLet(tempLets.script, 4)
            )
            break
          case 'releaseScript':
            _line = _line.replace(
              /\[let:releaseScript\]/,
              tempLets.releaseScript[0] ?? ''
            )
            break
          case 'devDependencies':
            _line = _line.replace(
              /\[let:devDependencies\]/,
              generateTempLet(tempLets.devDependencies, 4)
            )
            break
          default:
            break
        }
      })
    }
    result += _line + '\n'
  }

  return result
}

type F = (...args: any[]) => Promise<any>
type InferReturnType<T> = T extends (...args: any[]) => Promise<infer R>
  ? R
  : any
type Pipe<T extends F[]> = T extends [infer A]
  ? A
  : T extends [(...args: infer A) => Promise<infer R>, ...infer Res]
    ? Res extends [infer B]
      ? B extends (...args: R[]) => Promise<any>
        ? (...args: A) => ReturnType<B>
        : never
      : Res extends [infer B, ...infer Res2]
        ? B extends (...args: R[]) => Promise<any>
          ? Pipe<
              [
                (...args: A) => Promise<InferReturnType<B>>,
                ...(Res2 extends F[] ? Res2 : any)
              ]
            >
          : never
        : never
    : never

function asyncPipe<T extends F[]>(...fns: T): Pipe<T> {
  return async function (arg: any) {
    let _arg = arg
    for (const fn of fns) {
      try {
        _arg = await fn(_arg)
      } catch {
        console.error('stop.')
        process.exit(1)
      }
    }
    return _arg
  } as Pipe<T>
}

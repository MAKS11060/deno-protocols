import {defineConfig} from 'tsdown'

export default defineConfig({
  entry: [
    './src/**',
    '!**.test.ts',
  ],

  unbundle: true,
  cjsDefault: false,
})

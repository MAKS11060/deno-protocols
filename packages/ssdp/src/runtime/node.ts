import {networkInterfaces as _networkInterfaces} from 'node:os'

export const networkInterfaces = () => {
  return Object.entries(_networkInterfaces())
    .flatMap(([name, ints]) => {
      return ints?.map((int) => ({name, ...int}))!
    })
}

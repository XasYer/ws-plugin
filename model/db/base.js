import { dirname, resolve } from 'path'
import { fileURLToPath } from 'url'
import TaskQueue from './TaskQueue.js'
import fs from 'fs'
import YAML from 'yaml'

let Sequelize; let DataTypes; let sequelize; let Op; let existSQL = true
try {
  const modules = await import('sequelize')
  Sequelize = modules.Sequelize
  DataTypes = modules.DataTypes
  Op = modules.Op

  const __filename = fileURLToPath(import.meta.url)
  const __dirname = dirname(__filename)

  sequelize = new Sequelize({
    dialect: 'sqlite',
    storage: resolve(__dirname, 'data.db'),
    logging: false
  })

  await sequelize.authenticate()
} catch (error) {
  logger.warn('[ws-plugin] Yunzai-Bot暂不支持sqlite3数据库,建议切换至Miao-Yunzai获得最佳体验')
  existSQL = false
  sequelize = new Proxy({}, {
    get: () => {
      return () => {
        return new Promise((resolve, reject) => {
          resolve()
        })
      }
    }
  })
  DataTypes = {}
}

// ReferenceError: Cannot access 'Config' before initialization 呜呜
function getConfig (key) {
  let defConfig, config
  try {
    defConfig = YAML.parse(
      fs.readFileSync('./plugins/ws-plugin/config/default_config/msg-config.yaml', 'utf8')
    )[key]
    config = YAML.parse(
      fs.readFileSync('./plugins/ws-plugin/config/config/msg-config.yaml', 'utf8')
    )[key]
    config = Number(config)
  } catch (error) { }
  return typeof config === 'number' ? config : defConfig
}
const taskQueueConfig = getConfig('taskQueue')
let shouldCancel = false
let executeSync

if (taskQueueConfig > 0) {
  const taskQueue = new TaskQueue(taskQueueConfig)
  executeSync = (callback) => {
    if (shouldCancel) {
      // eslint-disable-next-line prefer-promise-reject-errors
      return Promise.reject('Cancelled')
    }
    return taskQueue.runTask(callback)
  }
} else {
  executeSync = (callback) => {
    return callback()
  }
}

export {
  sequelize,
  DataTypes,
  Op,
  existSQL,
  executeSync
}

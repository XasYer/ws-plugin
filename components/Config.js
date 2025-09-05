import YAML from 'yaml'
import chokidar from 'chokidar'
import fs from 'node:fs'
import YamlReader from './YamlReader.js'
import cfg from '../../../lib/config/config.js'
import _ from 'lodash'
import { modifyWebSocket } from './WebSocket.js'
import { cfgSchema } from '../config/system/cfg_system.js'

const Path = process.cwd()
const Plugin_Name = 'ws-plugin'
const Plugin_Path = `${Path}/plugins/${Plugin_Name}`
class Config {
  constructor () {
    this.config = {}
    this.oldConfig = {}
    /** 监听文件 */
    this.watcher = { config: {}, defSet: {} }

    this.initCfg()
  }

  /** 初始化配置 */
  initCfg () {
    let path = `${Plugin_Path}/config/config/`
    if (!fs.existsSync(path)) fs.mkdirSync(path)
    let pathDef = `${Plugin_Path}/config/default_config/`
    const files = fs.readdirSync(pathDef).filter(file => file.endsWith('.yaml'))
    for (let file of files) {
      if (!fs.existsSync(`${path}${file}`)) {
        fs.copyFileSync(`${pathDef}${file}`, `${path}${file}`)
      } else {
        const config = YAML.parse(fs.readFileSync(`${path}${file}`, 'utf8'))
        const defConfig = YAML.parse(fs.readFileSync(`${pathDef}${file}`, 'utf8'))
        const { differences, result } = this.mergeObjectsWithPriority(config, defConfig)
        if (differences) {
          fs.copyFileSync(`${pathDef}${file}`, `${path}${file}`)
          for (const key in result) {
            this.modify(file.replace('.yaml', ''), key, result[key])
          }
        }
      }
      this.watch(`${path}${file}`, file.replace('.yaml', ''), 'config')
    }
  }

  /** 获得yunzai Bot.yaml配置 */
  get bot () {
    return cfg.bot
  }

  /** 主人QQ */
  get masterQQ () {
    return cfg.masterQQ
  }

  /** Bot账号:[主人帐号] */
  get master () {
    return cfg.master
  }

  /** 云崽黑名单群 */
  get blackGroup () {
    return cfg.getOther().blackGroup
  }

  /** 云崽白名单群 */
  get whiteGroup () {
    return cfg.getOther().whiteGroup
  }

  /** 云崽黑名单QQ */
  get blackQQ () {
    return cfg.getOther().blackQQ
  }

  /** 心跳 */
  get heartbeatInterval () {
    return this.getDefOrConfig('ws-config').heartbeatInterval
  }

  /** 数据上报类型 */
  get messagePostFormat () {
    return this.getDefOrConfig('ws-config').messagePostFormat
  }

  /** 端口 */
  get wsPort () {
    return this.getDefOrConfig('ws-config').wsPort
  }

  /** 是否忽略云崽配置文件的仅艾特和前缀,即不需要艾特或前缀即可上报消息 */
  get ignoreOnlyReplyAt () {
    return this.getDefOrConfig('ws-config').ignoreOnlyReplyAt
  }

  get onlyReplyAt () {
    return this.getDefOrConfig('ws-config').onlyReplyAt
  }

  /** 连接列表 */
  get servers () {
    return this.getDefOrConfig('ws-config').servers
  }

  get noMsgStart () {
    return this.getDefOrConfig('msg-config').noMsgStart
  }

  get noMsgInclude () {
    return this.getDefOrConfig('msg-config').noMsgInclude
  }

  get howToMaster () {
    return this.getDefOrConfig('msg-config').howToMaster
  }

  /** 掉线时否通知主人 */
  get disconnectToMaster () {
    return this.getDefOrConfig('msg-config').disconnectToMaster
  }

  /** 重连成功时是否通知主人 */
  get reconnectToMaster () {
    return this.getDefOrConfig('msg-config').reconnectToMaster
  }

  /** 首次连接成功时是否通知主人 */
  get firstconnectToMaster () {
    return this.getDefOrConfig('msg-config').firstconnectToMaster
  }

  /** 消息存储时间 */
  get msgStoreTime () {
    return this.getDefOrConfig('msg-config').msgStoreTime
  }

  /** 禁用群聊列表 */
  get noGroup () {
    return this.getDefOrConfig('msg-config').noGroup
  }

  /** 白名单群聊 */
  get yesGroup () {
    return this.getDefOrConfig('msg-config').yesGroup
  }

  /** 禁言拦截 */
  get muteStop () {
    return this.getDefOrConfig('msg-config').muteStop
  }

  /** red 发送伪造转发消息方式 */
  get redSendForwardMsgType () {
    return this.getDefOrConfig('msg-config').redSendForwardMsgType
  }

  /** 文字转图片是否展示ID */
  get toImgID () {
    return this.getDefOrConfig('msg-config').toImgID
  }

  /** 转图片是否不包含标题 */
  get toImgNoTitle () {
    return this.getDefOrConfig('msg-config').toImgNoTitle
  }

  /** 渲染精度 */
  get renderScale () {
    return this.getDefOrConfig('msg-config').renderScale
  }

  /** 数据库同步锁 */
  get taskQueue () {
    return this.getDefOrConfig('msg-config').taskQueue
  }

  /** 群管理员变动是否上报 */
  get groupAdmin () {
    return this.getDefOrConfig('notice-config').groupAdmin
  }

  /** 群成员减少是否上报 */
  get groupDecrease () {
    return this.getDefOrConfig('notice-config').groupDecrease
  }

  /** 群成员增加是否上报 */
  get groupIncrease () {
    return this.getDefOrConfig('notice-config').groupIncrease
  }

  /** 群禁言是否上报 */
  get groupBan () {
    return this.getDefOrConfig('notice-config').groupBan
  }

  /** 好友添加是否上报 */
  get friendIncrease () {
    return this.getDefOrConfig('notice-config').friendIncrease
  }

  /** 群消息撤回是否上报 */
  get groupRecall () {
    return this.getDefOrConfig('notice-config').groupRecall
  }

  /** 好友消息撤回是否上报 */
  get friendRecall () {
    return this.getDefOrConfig('notice-config').friendRecall
  }

  /** 群内戳一戳是否上报 */
  get groupPoke () {
    return this.getDefOrConfig('notice-config').groupPoke
  }

  /** 好友申请是否上报 */
  get friendAdd () {
    return this.getDefOrConfig('request-config').friendAdd
  }

  /** 群聊邀请是否上报 (邀请机器人入群) */
  get groupInvite () {
    return this.getDefOrConfig('request-config').groupInvite
  }

  /** 群聊申请是否上报 (申请加入群聊) */
  get groupAdd () {
    return this.getDefOrConfig('request-config').groupAdd
  }

  /** 临时会话是否上报 */
  get tempMsgReport () {
    return this.getDefOrConfig('msg-config').tempMsgReport
  }

  /** 默认配置和用户配置 */
  getDefOrConfig (name) {
    let def = this.getdefSet(name)
    let config = this.getConfig(name)
    return { ...def, ...config }
  }

  /** 默认配置 */
  getdefSet (name) {
    return this.getYaml('default_config', name)
  }

  /** 用户配置 */
  getConfig (name) {
    return this.getYaml('config', name)
  }

  /**
   * 获取配置yaml
   * @param type 默认跑配置-defSet，用户配置-config
   * @param name 名称
   */
  getYaml (type, name) {
    let file = `${Plugin_Path}/config/${type}/${name}.yaml`
    let key = `${type}.${name}`

    if (this.config[key]) return this.config[key]

    this.config[key] = YAML.parse(
      fs.readFileSync(file, 'utf8')
    )

    this.watch(file, name, type)

    return this.config[key]
  }

  /** 监听配置文件 */
  watch (file, name, type = 'default_config') {
    let key = `${type}.${name}`
    if (!this.oldConfig[key]) this.oldConfig[key] = _.cloneDeep(this.config[key])
    if (this.watcher[key]) return

    const watcher = chokidar.watch(file)
    watcher.on('change', async path => {
      delete this.config[key]
      if (typeof Bot == 'undefined') return
      logger.mark(`[ws-plugin][修改配置文件][${type}][${name}]`)

      if (name == 'ws-config') {
        const oldConfig = this.oldConfig[key]
        delete this.oldConfig[key]
        const newConfig = this.getYaml(type, name)
        const object = this.findDifference(oldConfig, newConfig)
        // console.log(object);
        for (const key in object) {
          if (Object.hasOwnProperty.call(object, key)) {
            const value = object[key]
            const arr = key.split('.')
            if (arr[0] !== 'servers') continue
            let data = newConfig.servers[arr[1]]
            if (typeof data === 'undefined') data = oldConfig.servers[arr[1]]
            const target = {
              type: null,
              data
            }
            if (typeof value.newValue === 'object' && typeof value.oldValue === 'undefined') {
              target.type = 'add'
            } else if (typeof value.newValue === 'undefined' && typeof value.oldValue === 'object') {
              target.type = 'del'
            } else if (value.newValue === true && (value.oldValue === false || typeof value.oldValue === 'undefined')) {
              target.type = 'close'
            } else if (value.newValue === false && (value.oldValue === true || typeof value.oldValue === 'undefined')) {
              target.type = 'open'
            }
            await modifyWebSocket(target)
          }
        }
      }
    })

    this.watcher[key] = watcher
  }

  getCfgSchemaMap () {
    let ret = {}
    _.forEach(cfgSchema, (cfgGroup) => {
      _.forEach(cfgGroup.cfg, (cfgItem, cfgKey) => {
        ret[cfgItem.key] = cfgItem
        cfgItem.cfgKey = cfgKey
      })
    })
    return ret
  }

  getCfgSchema () {
    return cfgSchema
  }

  getCfg () {
    let wsconfig = this.getDefOrConfig('ws-config')
    let msgconfig = this.getDefOrConfig('msg-config')
    let noticeconfig = this.getDefOrConfig('notice-config')
    let requestconfig = this.getDefOrConfig('request-config')
    return {
      ...wsconfig,
      ...msgconfig,
      ...noticeconfig,
      ...requestconfig
    }
  }

  /**
   * @description: 修改设置
   * @param {String} name 文件名
   * @param {String} key 修改的key值
   * @param {String|Number} value 修改的value值
   * @param {'config'|'default_config'} type 配置文件或默认
   */
  modify (name, key, value, type = 'config') {
    let path = `${Plugin_Path}/config/${type}/${name}.yaml`
    new YamlReader(path).set(key, value)
    this.oldConfig[key] = _.cloneDeep(this.config[key])
    delete this.config[`${type}.${name}`]
  }

  /**
   * @description: 修改配置数组
   * @param {String} name 文件名
   * @param {String|Number} key key值
   * @param {String|Number} value value
   * @param {'add'|'del'} category 类别 add or del
   * @param {'config'|'default_config'} type 配置文件或默认
   */
  modifyarr (name, key, value, category = 'add', type = 'config') {
    let path = `${Plugin_Path}/config/${type}/${name}.yaml`
    let yaml = new YamlReader(path)
    if (category == 'add') {
      yaml.addIn(key, value)
    } else {
      let index = yaml.jsonData[key].indexOf(value)
      yaml.delete(`${key}.${index}`)
    }
  }

  setArr (name, key, item, value, type = 'config') {
    let path = `${Plugin_Path}/config/${type}/${name}.yaml`
    let yaml = new YamlReader(path)
    let arr = yaml.get(key).slice()
    arr[item] = value
    yaml.set(key, arr)
  }

  delServersArr (value, name = 'ws-config', type = 'config') {
    let path = `${Plugin_Path}/config/${type}/${name}.yaml`
    let yaml = new YamlReader(path)
    let key = 'servers'
    // let index = yaml.jsonData[key].indexOf(value)
    let index = yaml.jsonData[key].findIndex(item => item.name === value)
    yaml.delete(`${key}.${index}`)
  }

  /**
   * @description 对比两个对象不同的值
   * @param {*} oldObj
   * @param {*} newObj
   * @param {*} parentKey
   * @returns
   */
  findDifference (obj1, obj2, parentKey = '') {
    const result = {}
    for (const key in obj1) {
      const fullKey = parentKey ? `${parentKey}.${key}` : key
      if (_.isObject(obj1[key]) && _.isObject(obj2[key])) {
        const diff = this.findDifference(obj1[key], obj2[key], fullKey)
        if (!_.isEmpty(diff)) {
          Object.assign(result, diff)
        }
      } else if (!_.isEqual(obj1[key], obj2[key])) {
        result[fullKey] = { oldValue: obj1[key], newValue: obj2[key] }
      }
    }
    for (const key in obj2) {
      if (!Object.prototype.hasOwnProperty.call(obj1, key)) {
        const fullKey = parentKey ? `${parentKey}.${key}` : key
        result[fullKey] = { oldValue: undefined, newValue: obj2[key] }
      }
    }
    return result
  }

  mergeObjectsWithPriority (objA, objB) {
    let differences = false

    function customizer (objValue, srcValue, key, object, source, stack) {
      if (_.isArray(objValue) && _.isArray(srcValue)) {
        return objValue
      } else if (_.isPlainObject(objValue) && _.isPlainObject(srcValue)) {
        if (!_.isEqual(objValue, srcValue)) {
          return _.mergeWith(_.cloneDeep(objValue), srcValue, customizer)
        }
      } else if (!_.isEqual(objValue, srcValue)) {
        differences = true
        return objValue !== undefined ? objValue : srcValue
      }
      return objValue !== undefined ? objValue : srcValue
    }

    let result = _.mergeWith(_.cloneDeep(objA), objB, customizer)

    return {
      differences,
      result
    }
  }
}
export default new Config()

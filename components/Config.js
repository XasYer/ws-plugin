
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
  constructor() {
    this.config = {}

    /** 监听文件 */
    this.watcher = { config: {}, defSet: {} }

    this.initCfg()
  }

  /** 初始化配置 */
  initCfg() {
    let path = `${Plugin_Path}/config/config/`
    let pathDef = `${Plugin_Path}/config/default_config/`
    const files = fs.readdirSync(pathDef).filter(file => file.endsWith('.yaml'))
    for (let file of files) {
      if (!fs.existsSync(`${path}${file}`)) {
        fs.copyFileSync(`${pathDef}${file}`, `${path}${file}`)
      }
      this.watch(`${path}${file}`, file.replace('.yaml', ''), 'config')
    }
  }

  /** 主人QQ */
  get masterQQ() {
    return cfg.masterQQ
  }

  /** 心跳 */
  get heartbeatInterval() {
    return this.getDefOrConfig('ws-config').heartbeatInterval
  }

  /** 数据上报类型 */
  get messagePostFormat() {
    return this.getDefOrConfig('ws-config').messagePostFormat
  }

  /** 连接列表 */
  get servers() {
    return this.getDefOrConfig('ws-config').servers
  }

  get noMsgStart() {
    return this.getDefOrConfig('msg-config').noMsgStart
  }

  get noMsgInclude() {
    return this.getDefOrConfig('msg-config').noMsgInclude
  }

  /**掉线时否通知主人 */
  get disconnectToMaster() {
    return this.getDefOrConfig('msg-config').disconnectToMaster
  }

  /**重连成功时是否通知主人 */
  get reconnectToMaster() {
    return this.getDefOrConfig('msg-config').reconnectToMaster
  }

  /**首次连接成功时是否通知主人 */
  get firstconnectToMaster() {
    return this.getDefOrConfig('msg-config').firstconnectToMaster
  }

  /**消息存储时间 */
  get msgStoreTime() {
    return this.getDefOrConfig('msg-config').msgStoreTime
  }

  /**禁用群聊列表 */
  get noGroup() {
    return this.getDefOrConfig('msg-config').noGroup
  }

  /**群管理员变动是否上报 */
  get groupAdmin() {
    return this.getDefOrConfig('notice-config').groupAdmin
  }

  /**群成员减少是否上报 */
  get groupDecrease() {
    return this.getDefOrConfig('notice-config').groupDecrease
  }

  /**群成员增加是否上报 */
  get groupIncrease() {
    return this.getDefOrConfig('notice-config').groupIncrease
  }

  /**群禁言是否上报 */
  get groupBan() {
    return this.getDefOrConfig('notice-config').groupBan
  }

  /**好友添加是否上报 */
  get friendIncrease() {
    return this.getDefOrConfig('notice-config').friendIncrease
  }

  /**群消息撤回是否上报 */
  get groupRecall() {
    return this.getDefOrConfig('notice-config').groupRecall
  }

  /**好友消息撤回是否上报 */
  get friendRecall() {
    return this.getDefOrConfig('notice-config').friendRecall
  }

  /**群内戳一戳是否上报 */
  get groupPoke() {
    return this.getDefOrConfig('notice-config').groupPoke
  }
  
  /** 好友申请是否上报 */
  get friendAdd(){
    return this.getDefOrConfig('request-config').friendAdd
  }
  
  /** 群聊邀请是否上报 (邀请机器人入群) */
  get groupInvite(){
    return this.getDefOrConfig('request-config').groupInvite
  }
  
  /** 群聊申请是否上报 (申请加入群聊) */
  get groupAdd(){
    return this.getDefOrConfig('request-config').groupAdd
  }

  /** 默认配置和用户配置 */
  getDefOrConfig(name) {
    let def = this.getdefSet(name)
    let config = this.getConfig(name)
    return { ...def, ...config }
  }

  /** 默认配置 */
  getdefSet(name) {
    return this.getYaml('default_config', name)
  }

  /** 用户配置 */
  getConfig(name) {
    return this.getYaml('config', name)
  }

  /**
   * 获取配置yaml
   * @param type 默认跑配置-defSet，用户配置-config
   * @param name 名称
   */
  getYaml(type, name) {
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
  watch(file, name, type = 'default_config') {
    let key = `${type}.${name}`

    if (this.watcher[key]) return

    const watcher = chokidar.watch(file)
    watcher.on('change', path => {
      delete this.config[key]
      if (typeof Bot == 'undefined') return
      logger.mark(`[ws-Plugin][修改配置文件][${type}][${name}]`)
      if (this[`change_${name}`]) {
        this[`change_${name}`]()
      }
      if (name == 'ws-config') {
        setTimeout(() => {
          modifyWebSocket(this.servers)
        }, 500)
      }
    })

    this.watcher[key] = watcher
  }

  getCfgSchemaMap() {
    let ret = {}
    _.forEach(cfgSchema, (cfgGroup) => {
      _.forEach(cfgGroup.cfg, (cfgItem, cfgKey) => {
        ret[cfgItem.key] = cfgItem
        cfgItem.cfgKey = cfgKey
      })
    })
    return ret
  }

  getCfgSchema() {
    return cfgSchema
  }

  getCfg() {
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
  modify(name, key, value, type = 'config') {
    let path = `${Plugin_Path}/config/${type}/${name}.yaml`
    new YamlReader(path).set(key, value)
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
  modifyarr(name, key, value, category = 'add', type = 'config') {
    let path = `${Plugin_Path}/config/${type}/${name}.yaml`
    let yaml = new YamlReader(path)
    if (category == 'add') {
      yaml.addIn(key, value)
    } else {
      let index = yaml.jsonData[key].indexOf(value)
      yaml.delete(`${key}.${index}`)
    }
  }

  delServersArr(value, name = 'ws-config', type = 'config') {
    let path = `${Plugin_Path}/config/${type}/${name}.yaml`
    let yaml = new YamlReader(path)
    let key = 'servers'
    // let index = yaml.jsonData[key].indexOf(value)
    let index = yaml.jsonData[key].findIndex(item => item.name === value);
    yaml.delete(`${key}.${index}`)
  }
}
export default new Config()

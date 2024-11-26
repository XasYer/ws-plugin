import plugin from '../../../lib/plugins/plugin.js'
import { Config, Render, Version, allSocketList, sendSocketList, createWebSocket } from '../components/index.js'
import { toImg, TMP_DIR } from '../model/index.js'
import lodash from 'lodash'
import fs from 'fs'
import { join } from 'path'

let keys = lodash.map(Config.getCfgSchemaMap(), (i) => i.key)
let sysCfgReg = new RegExp(`^#ws设置\\s*(${keys.join('|')})?\\s*(.*)$`)
const groupReg = '^#ws(查看|删除|添加)?(禁用|启用)群([0-9]*)$'
const wsReg = '^#ws(添加|删除|打开|关闭|重新|查看)[连链]接(.*)$'

export class setting extends plugin {
  constructor () {
    super({
      name: '[ws-plugin] 设置',
      dsc: '[ws-plugin] 设置',
      event: 'message',
      priority: 1,
      rule: [
        {
          reg: wsReg,
          fnc: 'modifyWs',
          permission: 'master'
        },
        {
          reg: sysCfgReg,
          fnc: 'setting',
          permission: 'master'
        },
        {
          reg: groupReg,
          fnc: 'modifyGroup',
          permission: 'master'
        },
        {
          reg: '^#ws状态$',
          fnc: 'view'
          // permission: 'master'
        },
        {
          reg: '^#ws清除缓存$',
          fnc: 'clearCache',
          permission: 'master'
        }
      ]
    })
  }

  async modifyGroup () {
    let reg = new RegExp(groupReg)
    let regRet = reg.exec(this.e.msg)
    if (!regRet) {
      return true
    }
    const type = regRet[2]
    const target = type == '禁用' ? 'noGroup' : 'yesGroup'
    const cfg = {
      noGroup: Config.noGroup,
      yesGroup: Config.yesGroup
    }
    const group_id = regRet[3] || this.e.group_id
    let sendMsg = []
    if (regRet[1]) {
      switch (regRet[1]) {
        case '查看':
          if (Array.isArray(cfg[target]) && cfg[target].length > 0) {
            sendMsg.push(`以下为${type}群聊的群号\n`)
            sendMsg.push(cfg[target].join('\n'))
          } else {
            sendMsg.push(`暂无${type}群聊`)
          }
          break
        case '删除': {
          let index = -1
          if (Array.isArray(cfg[target]) && cfg[target].length > 0) {
            for (let i = 0; i < cfg[target].length; i++) {
              if (cfg[target][i] == group_id) {
                index = i
              }
            }
          }
          if (index == -1) {
            sendMsg.push(`操作失败~在${type}群中没有这个群聊,当前${type}群列表:\n`)
            sendMsg.push(cfg[target].join('\n'))
          } else {
            cfg[target].splice(index, 1)
            sendMsg.push(`操作成功~从${type}群中删除了[${group_id}]!\n当前${type}列表:\n`)
            sendMsg.push(cfg[target].join('\n'))
          }
          break
        }
        case '添加': {
          let isExist = false
          if (Array.isArray(cfg[target]) && cfg[target].length > 0) {
            for (const item of cfg[target]) {
              if (item == group_id) {
                isExist = true
                break
              }
            }
          } else {
            cfg[target] = []
          }
          if (isExist) {
            sendMsg.push(`操作失败~${type}群中已经添加了[${group_id}]\n当前${type}群列表:\n`)
            sendMsg.push(cfg[target].join('\n'))
          } else {
            cfg[target].push(group_id)
            sendMsg.push(`操作成功~向${type}群中添加了[${group_id}]!\n当前${type}群列表:\n`)
            sendMsg.push(cfg[target].join('\n'))
          }
        }
        default:
          break
      }
    } else {
      let isExist = false
      switch (type) {
        case '禁用':
          // 先看白名单有没有这个群
          if (Array.isArray(cfg.yesGroup) && cfg.yesGroup.length > 0) {
            for (const i of cfg.yesGroup) {
              if (i == group_id) {
                isExist = true
              }
            }
          }
          // 如果在白名单中则删除白名单
          if (isExist) {
            cfg.yesGroup = cfg.yesGroup.filter(i => i != group_id)
            sendMsg.push(`操作成功~从白名单中删除了[${group_id}]!\n当前白名单列表:\n`)
            sendMsg.push(cfg.yesGroup.join('\n'))
          } else {
            // 再看看黑名单有没有这个群
            if (Array.isArray(cfg.noGroup) && cfg.noGroup.length > 0) {
              for (const item of cfg.noGroup) {
                if (item == group_id) {
                  isExist = true
                  break
                }
              }
            } else {
              cfg.noGroup = []
            }
            if (isExist) {
              sendMsg.push(`操作失败~黑名单中已经添加了[${group_id}]\n当前黑名单列表:\n`)
              sendMsg.push(cfg.noGroup.join('\n'))
            } else {
              cfg.noGroup.push(group_id)
              sendMsg.push(`操作成功~向黑名单中添加了[${group_id}]!\n当前黑名单列表:\n`)
              sendMsg.push(cfg.noGroup.join('\n'))
            }
          }
          break
        case '启用':
          // 先看黑名单有没有这个群
          if (Array.isArray(cfg.noGroup) && cfg.noGroup.length > 0) {
            for (const item of cfg.noGroup) {
              if (item == group_id) {
                isExist = true
                break
              }
            }
          } else {
            cfg.noGroup = []
          }
          // 如果在黑名单中则删除黑名单
          if (isExist) {
            cfg.noGroup = cfg.noGroup.filter(i => i != group_id)
            sendMsg.push(`操作成功~从黑名单中删除了[${group_id}]!\n当前黑名单列表:\n`)
            sendMsg.push(cfg.noGroup.join('\n'))
          } else {
            // 再看看白名单有没有这个群
            if (Array.isArray(cfg.yesGroup) && cfg.yesGroup.length > 0) {
              for (const item of cfg.yesGroup) {
                if (item == group_id) {
                  isExist = true
                  break
                }
              }
            } else {
              cfg.yesGroup = []
            }
            if (isExist) {
              sendMsg.push(`操作失败~白名单中已经添加了[${group_id}]\n当前白名单列表:\n`)
              sendMsg.push(cfg.yesGroup.join('\n'))
            } else {
              cfg.yesGroup.push(group_id)
              sendMsg.push(`操作成功~向白名单中添加了[${group_id}]!\n当前白名单列表:\n`)
              sendMsg.push(cfg.yesGroup.join('\n'))
            }
          }
          break
        default:
          break
      }
    }
    try {
      for (const key in cfg) {
        Config.modify('msg-config', key, cfg[key])
      }
    } catch (error) {
      sendMsg = ['操作失败...']
      logger.error(error)
    }
    if (sendMsg.length > 0) this.reply(sendMsg)
    return true
  }

  async modifyWs () {
    let reg = new RegExp(wsReg)
    let regRet = reg.exec(this.e.msg)
    if (!regRet) {
      return true
    }
    switch (regRet[1]) {
      case '添加':
        // if (regRet[2]) {
        //     let msg = regRet[2].split(/,|，/g)
        //     await this.addWs(msg)
        // } else {
        this.setContext('checkAddWs')
        await this.reply([
          '请输入以下参数,用逗号分割\n',
          '---------------------------------\n',
          '连接名字,连接类型\n',
          '---------------------------------\n',
          '连接名字: 用来区分每个连接\n',
          '连接类型: 1:反向ws连接 2:正向ws连接 3:gscore连接 4:red连接 5:正向http 6:反向http'
        ])
        // await this.reply([
        //     '请一次性发送以下参数:\n',
        //     '-----------------------\n',
        //     '连接名字,连接地址,连接类型,重连间隔,最大重连次数,access-token(没有可不加)\n',
        //     '-----------------------\n',
        //     '用逗号分割,例如:\nNoneBot2,ws://127.0.0.1:8080/onebot/v11/ws,1,5,0\n',
        //     '如果对参数不懂意思,可以发送#ws连接说明'
        // ])
        // }
        break
      case '删除':
        if (regRet[2]) {
          await this.delWs(regRet[2])
        } else {
          this.setContext('checkDelWs')
          await this.reply('请继续发送需要删除的ws连接名字')
        }
        break
      case '打开':
        if (regRet[2]) {
          await this.openWs(regRet[2])
        } else {
          this.setContext('checkOpenWs')
          this.reply('请继续发送需要打开的ws连接名字')
        }
        break
      case '关闭':
        if (regRet[2]) {
          await this.closeWs(regRet[2])
        } else {
          this.setContext('checkCloseWs')
          this.reply('请继续发送需要关闭的ws连接名字')
        }
        break
      case '重新':
        if (regRet[2]) {
          await this.resetWs(regRet[2])
        } else {
          this.setContext('checkResetWs')
          this.reply('请继续发送需要重新连接的ws连接名字')
        }
        break
      case '查看':
        await this.view()
        break
      default:
        break
    }
  }

  async checkAddWs () {
    if (!this.e.msg || !this.e.isMaster) {
      return false
    }
    const msg = this.e.msg.split(/,|，/g)
    let cache = await redis.get('ws-plugin:addWs:' + this.e.user_id)
    let addWsMsg
    if (cache) {
      await redis.del('ws-plugin:addWs:' + this.e.user_id)
      addWsMsg = JSON.parse(cache)
      addWsMsg.push(...msg)
    } else {
      addWsMsg = [...msg]
    }
    if (addWsMsg.length < 2) {
      await this.reply('格式有误,请检查后重新发送#ws添加连接')
      this.finish('checkAddWs')
      return false
    }
    if (addWsMsg.length == 2) {
      for (const i of Config.servers) {
        if (i.name == addWsMsg[0]) {
          if (Array.isArray(i.uin)) {
            if (i.uin.some(m => m == this.e.self_id)) {
              this.reply(`已经有连接名为${addWsMsg[0]}的连接并且已添加uin`)
              this.finish('checkAddWs')
              return
            } else {
              i.uin.push(Number(this.e.self_id) || this.e.self_id)
            }
          } else if (i.uin == this.e.self_id) {
            this.reply(`已经有连接名为${addWsMsg[0]}的连接并且已添加uin`)
            this.finish('checkAddWs')
            return
          } else {
            i.uin = [i.uin, Number(this.e.self_id) || this.e.self_id]
          }
          try {
            Config.delServersArr(i.name)
            Config.modifyarr('ws-config', 'servers', i)
            this.reply('操作成功~请留意控制台输出~')
          } catch (error) {
            logger.error(error)
            this.reply('操作失败~')
          } finally {
            this.finish('checkAddWs')
          }
          return
        }
      }
      switch (addWsMsg[1]) {
        case '1':
          await this.reply([
            '请继续发送以下参数,用逗号分割\n',
            '---------------------------------\n',
            '连接地址,重连间隔(默认5),最大重连次数(默认0),access-token(默认空)\n',
            '---------------------------------\n',
            '连接地址: 需要连接的ws地址,比如ws://127.0.0.1:8080/onebot/v11/ws\n',
            '重连间隔: 断开连接时每隔多少秒进行重新连接\n',
            '最大重连次数: 达到这个数之后不进行重连,为0时会不断重连\n',
            'access-token: 访问秘钥'
          ])
          break
        case '2':
          await this.reply([
            '请继续发送以下参数,用逗号分割\n',
            '---------------------------------\n',
            '连接地址,access-token(默认空)\n',
            '---------------------------------\n',
            '连接地址: 需要启动的ws地址,比如127.0.0.1:8080\n',
            'access-token: 访问秘钥'
          ])
          break
        case '3':
          await this.reply([
            '请继续发送以下参数,用逗号分割\n',
            '---------------------------------\n',
            '连接地址,重连间隔(默认5),最大重连次数(默认0),access-token(默认空)\n',
            '---------------------------------\n',
            '连接地址: 需要连接的ws地址,比如ws://127.0.0.1:8765/ws/yunzai\n',
            '重连间隔: 断开连接时每隔多少秒进行重新连接\n',
            '最大重连次数: 达到这个数之后不进行重连,为0时会不断重连\n',
            'access-token: 访问秘钥'
          ])
          break
        case '4':
          await this.reply([
            '请继续发送以下参数,用逗号分割\n',
            '---------------------------------\n',
            '连接地址,Token(为空尝试自动获取),重连间隔(默认5),最大重连次数(默认0)\n',
            '---------------------------------\n',
            '连接地址: Host:Port,比如127.0.0.1:16530\n',
            'Token: Chronocat 连接 Token\n',
            '重连间隔: 断开连接时每隔多少秒进行重新连接\n',
            '最大重连次数: 达到这个数之后不进行重连,为0时会不断重连'
          ])
          break
        case '5':
          await this.reply([
            '请继续发送以下参数,用逗号分割\n',
            '---------------------------------\n',
            '连接地址,access-token(默认空)\n',
            '---------------------------------\n',
            '连接地址: Host:Port,比如127.0.0.1:3000\n',
            'access-token: 访问秘钥'
          ])
          break
        case '6':
          await this.reply([
            '请继续发送以下参数,用逗号分割\n',
            '---------------------------------\n',
            '连接地址\n',
            '---------------------------------\n',
            '连接地址: http://Host:Port,比如http://127.0.0.1:3001\n'
            // 'secret: 秘钥',
          ])
          break
        default:
          await this.reply('格式有误,请检查后重新发送#ws添加连接')
          this.finish('checkAddWs')
          await redis.del('ws-plugin:addWs:' + this.e.user_id)
          return false
      }
      this.setContext('checkAddWs')
      await redis.setEx('ws-plugin:addWs:' + this.e.user_id, 120, JSON.stringify(addWsMsg))
    } else {
      const config = {
        name: addWsMsg[0],
        address: addWsMsg[2],
        type: Number(addWsMsg[1])
      }
      switch (addWsMsg[1]) {
        case '1':
        case '3':
          config.reconnectInterval = Number(addWsMsg[3]) || 5
          config.maxReconnectAttempts = Number(addWsMsg[4]) || 0
          config.accessToken = addWsMsg[5]
          break
        case '4':
          config.accessToken = addWsMsg[3]
          config.reconnectInterval = Number(addWsMsg[4]) || 5
          config.maxReconnectAttempts = Number(addWsMsg[5]) || 0
          break
        case '2':
        case '5':
          config.accessToken = addWsMsg[3]
          break
        default:
          break
      }
      // config.uin = Number(this.e.bot.uin || this.e.self_id) || String(this.e.bot.uin || this.e.self_id)
      if (this.e.group) {
        const seld_id = this.e.group?.bot?.uin || this.e.self_id
        config.uin = Number(seld_id) || String(seld_id)
      } else if (this.e.friend) {
        const seld_id = this.e.friend?.bot?.uin || this.e.self_id
        config.uin = Number(seld_id) || String(seld_id)
      }
      await this.addWs(config)
      this.finish('checkAddWs')
      await redis.del('ws-plugin:addWs:' + this.e.user_id)
    }
    return false
  }

  async setting (e) {
    let cfgReg = sysCfgReg
    let regRet = cfgReg.exec(e.msg)
    let cfgSchemaMap = Config.getCfgSchemaMap()
    if (!regRet) {
      return true
    }

    if (regRet[1]) {
      // 设置模式
      let val = regRet[2] || ''

      if (regRet[1] == '全部') {
        val = !/关闭/.test(val)
        for (const i of keys) {
          if (typeof cfgSchemaMap[i].def == 'boolean') {
            if (cfgSchemaMap[i].key == '全部') {
              await redis.set('Yz:ws-plugin:setAll', val ? 1 : 0)
            } else {
              Config.modify(cfgSchemaMap[i].fileName, cfgSchemaMap[i].cfgKey, val)
            }
          }
        }
      } else {
        let cfgSchema = cfgSchemaMap[regRet[1]]
        if (cfgSchema.input) {
          val = cfgSchema.input(val)
        } else {
          val = cfgSchema.type === 'num' ? (val * 1 || cfgSchema.def) : !/关闭/.test(val)
        }
        Config.modify(cfgSchema.fileName, cfgSchema.cfgKey, val)
      }
    }

    let schema = Config.getCfgSchema()
    let cfg = Config.getCfg()
    cfg.setAll = (await redis.get('Yz:ws-plugin:setAll')) == 1

    // 渲染图像
    return await Render.render('admin/index', {
      schema,
      cfg,
      isMiao: Version.isMiao
    }, { e, scale: 1.4 })
  }

  async addWs (msg) {
    if (Array.isArray(msg) && msg.length != 5 && msg.length != 6 && msg.length != 7) {
      await this.reply('格式有误,请检查后重新发送#ws添加连接')
      return false
    } else {
      let value
      if (Array.isArray(msg)) {
        value = {
          name: msg[0],
          address: msg[1],
          type: msg[2],
          reconnectInterval: msg[3],
          maxReconnectAttempts: msg[4]
        }
        if (msg[5]) {
          value.accessToken = msg[5]
        }
      } else {
        value = msg
      }
      let old = Config.servers
      if (Array.isArray(old) && old.length > 0) {
        for (const item of old) {
          if (item.name == value.name) {
            this.reply(`已经有连接名为${value.name}的连接了\n连接地址为${item.address}\n请删除旧的连接或更改连接名字`)
            return false
          }
          // else if (item.address == value.address) {
          //     this.reply(`已经有连接地址为${value.address}的连接了\n连接名字为${item.name}\n请删除旧的连接或更改连接地址`)
          //     return false
          // }
        }
      }
      try {
        Config.modifyarr('ws-config', 'servers', value)
        this.reply('操作成功~请留意控制台输出~')
      } catch (error) {
        logger.error(error)
        this.reply('操作失败~')
      }
      return true
    }
  }

  async openWs (msg) {
    let servers = Config.servers
    for (let i = 0; i < servers.length; i++) {
      if (servers[i].name == msg) {
        delete servers[i].close
        servers[i].closed = false
        try {
          Config.setArr('ws-config', 'servers', i, servers[i])
          this.reply('操作成功~请留意控制台输出~')
          return true
        } catch (error) {
          logger.error(error)
          this.reply('操作失败...')
          return true
        }
      }
    }
    this.reply(`没有连接名字为${msg}的连接`)
    return true
  }

  async closeWs (msg) {
    let servers = Config.servers
    for (let i = 0; i < servers.length; i++) {
      if (servers[i].name == msg) {
        delete servers[i].close
        servers[i].closed = true
        try {
          Config.setArr('ws-config', 'servers', i, servers[i])
          this.reply('操作成功~请留意控制台输出~')
          return true
        } catch (error) {
          logger.error(error)
          this.reply('操作失败...')
          return true
        }
      }
    }
    this.reply(`没有连接名字为${msg}的连接`)
    return true
  }

  async checkOpenWs () {
    if (!this.e.msg || !this.e.isMaster) {
      return false
    }
    let msg = this.e.msg
    await this.openWs(msg)
    this.finish('checkOpenWs')
  }

  async checkCloseWs () {
    if (!this.e.msg || !this.e.isMaster) {
      return false
    }
    let msg = this.e.msg
    await this.closeWs(msg)
    this.finish('checkCloseWs')
  }

  async delWs (msg) {
    let servers = Config.servers
    for (let i = 0; i < servers.length; i++) {
      if (servers[i].name == msg) {
        try {
          Config.delServersArr(servers[i].name)
          this.reply('操作成功~请留意控制台输出~')
          return true
        } catch (error) {
          logger.error(error)
          this.reply('操作失败~')
          return true
        }
      }
    }
    this.reply(`没有连接名字为${msg}的连接`)
    return true
  }

  async checkDelWs () {
    if (!this.e.msg || !this.e.isMaster) {
      return false
    }
    let msg = this.e.msg
    await this.delWs(msg)
    this.finish('checkDelWs')
  }

  async checkResetWs () {
    if (!this.e.msg || !this.e.isMaster) {
      return false
    }
    let msg = this.e.msg
    await this.resetWs(msg)
    this.finish('checkResetWs')
  }

  async resetWs (msg) {
    for (const i of sendSocketList) {
      if (i.name == msg) {
        i.close()
        setTimeout(async () => {
          await createWebSocket({
            name: i.name,
            address: i.address,
            type: i.type,
            reconnectInterval: i.reconnectInterval,
            maxReconnectAttempts: i.maxReconnectAttempts,
            uin: i.uin,
            accessToken: i.accessToken
          })
        }, 500)
        this.reply('操作成功~请留意控制台输出~')
        return true
      }
    }
    this.reply(`没有连接名字为${msg}的连接或已关闭连接`)
    return true
  }

  async view () {
    const msg = []
    for (const s of allSocketList) {
      let status = '已关闭'
      switch (s.status) {
        case 0:
          status = '已关闭'
          break
        case 1:
          status = '正常'
          break
        case 3:
          status = '断线重连中'
          break
        default:
          break
      }
      let str = `连接名字: ${s.name}\n连接类型: ${s.type}\n当前状态: ${status}`
      if (!this.e.isGroup && this.e.isMaster) {
        str += `\n连接地址: ${s.address}\nBot账号: ${s.uin}`
        if (msg.length != 0) str = '\n---------------\n' + str
        msg.push(str)
      } else {
        let uin = s.uin
        if (Array.isArray(uin)) {
          uin = this.e.user_id
        }
        msg.push({
          user_id: uin,
          avatar: Bot[uin]?.avatar || `https://q1.qlogo.cn/g?b=qq&s=0&nk=${uin}`,
          nickname: Bot[uin]?.nickname || '未知',
          message: str
        })
      }
    }
    if (msg.length > 0) {
      if (!this.e.isGroup) {
        await this.reply(msg)
      } else {
        await toImg(msg, this.e)
      }
    } else {
      await this.reply('暂无连接')
    }
    return true
  }

  async clearCache (e) {
    // 清除Temp目录下所有文件
    try {
      const files = fs.readdirSync(TMP_DIR)
      for (const file of files) {
        fs.unlink(join(TMP_DIR, file), () => { })
      }
    } catch (error) { }
    e.reply('操作成功~')
    return true
  }
}

import WebSocket, { WebSocketServer } from 'ws'
import { getApiData, makeGSUidSendMsg, getLatestMsg, lifecycle, heartbeat, setMsg } from '../model/index.js'
import { Version, Config } from './index.js'
import express from 'express'
import http from 'http'
import fetch from 'node-fetch'
import url from 'url'

export default class Client {
  constructor ({ name, address, type, reconnectInterval, maxReconnectAttempts, accessToken, accessKey, uin = Bot.uin, closed = false, ...other }) {
    this.name = name
    this.address = address
    this.type = type
    this.reconnectInterval = reconnectInterval
    this.maxReconnectAttempts = maxReconnectAttempts
    this.accessToken = accessToken
    this.accessKey = accessKey?.trim?.() || 'Token'
    this.uin = Number(uin) || uin
    this.self_id = uin
    this.ws = null
    this.status = 0
    this.closed = closed
    this.other = other
  }

  reconnectCount = 1

  timer = null

  stopReconnect = false

  createWs () {
    try {
      const headers = {
        'X-Self-ID': this.self_id,
        'X-Client-Role': 'Universal',
        'User-Agent': `ws-plugin/${Version.version}`
      }
      if (this.accessToken) headers.Authorization = this.accessKey + ' ' + this.accessToken
      this.ws = new WebSocket(this.address, { headers })
    } catch (error) {
      logger.error(`[ws-plugin] 出错了,可能是ws地址填错了~\nws名字: ${this.name}\n地址: ${this.address}\n类型: 1`)
      logger.error(error)
      return
    }
    this.ws.on('open', async () => {
      logger.mark(`[ws-plugin] ${this.name} 已连接`)
      if (this.status == 3 && this.reconnectCount > 1 && Config.reconnectToMaster) {
        await this.sendMasterMsg(`${this.name} 重连成功~`)
      } else if (this.status == 0 && Config.firstconnectToMaster) {
        await this.sendMasterMsg(`${this.name} 连接成功~`)
      }
      this.ws.send(lifecycle(this.self_id))
      this.status = 1
      this.reconnectCount = 1
      if (Config.heartbeatInterval > 0) {
        this.timer = setInterval(async () => {
          this.ws.send(heartbeat(this.self_id))
        }, Config.heartbeatInterval * 1000)
      }
    })
    this.ws.on('message', async (event) => {
      let data
      if (Buffer.isBuffer(event)) {
        data = JSON.parse(event.toString())
      } else {
        data = JSON.parse(event.data)
      }
      let result = await this.getData(data.action, data.params, data.echo)
      this.ws.send(JSON.stringify(result))
    })
    this.ws.on('close', async code => {
      logger.warn(`[ws-plugin] ${this.name} 连接已关闭`)
      clearInterval(this.timer)
      if (Config.disconnectToMaster && this.reconnectCount == 1 && this.status == 1) {
        await this.sendMasterMsg(`${this.name} 已断开连接...`)
      } else if (Config.firstconnectToMaster && this.reconnectCount == 1 && this.status == 0) {
        await this.sendMasterMsg(`${this.name} 连接失败...`)
      }
      this.status = 3
      if (!this.stopReconnect && ((this.reconnectCount < this.maxReconnectAttempts) || this.maxReconnectAttempts <= 0)) {
        if (code === 1005) {
          logger.warn(`[ws-plugin] ${this.name} 连接异常,停止重连`)
          this.status = 0
        } else {
          logger.warn(`[ws-plugin] ${this.name} 开始尝试重新连接第${this.reconnectCount}次`)
          this.reconnectCount++
          setTimeout(() => {
            this.createWs()
          }, this.reconnectInterval * 1000)
        }
      } else {
        this.stopReconnect = false
        this.status = 0
        logger.warn(`[ws-plugin] ${this.name} 达到最大重连次数或关闭连接,停止重连`)
      }
    })
    this.ws.on('error', (event) => {
      logger.error(`[ws-plugin] ${this.name} 连接失败\n${event}`)
    })
  }

  createServer () {
    let index = this.address.lastIndexOf(':')
    this.host = this.address.substring(0, index)
    this.port = this.address.substring(index + 1)
    this.arr = []
    this.express = express()
    this.server = http.createServer(this.express)
    this.server.on('upgrade', (req, socket, head) => {
      if (this.accessToken) {
        // eslint-disable-next-line n/no-deprecated-api
        const Url = url.parse(req.url, true)
        const token = req.headers.authorization?.replace(this.accessKey, '').trim() || Url.query?.access_token
        if (!token) {
          socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n')
          socket.destroy()
          return
        }
        if (this.accessToken != token) {
          socket.write('HTTP/1.1 403 Forbidden\r\n\r\n')
          socket.destroy()
          return
        }
      }
      this.wss.handleUpgrade(req, socket, head, conn => {
        // eslint-disable-next-line n/no-deprecated-api
        const Url = url.parse(req.url, true)
        if (Url.pathname === '/') {
          conn.id = req.headers['sec-websocket-key']
          let time = null
          conn.send(lifecycle(this.self_id))
          if (Config.heartbeatInterval > 0) {
            time = setInterval(async () => {
              conn.send(heartbeat(this.self_id))
            }, Config.heartbeatInterval * 1000)
          }
          logger.mark(`[ws-plugin] ${this.name} 接受 WebSocket 连接: ${req.connection.remoteAddress}`)
          conn.on('error', (event) => {
            logger.error(`[ws-plugin] ${this.name} 接受 WebSocket 连接时出现错误: ${event}`)
          })
          conn.on('close', () => {
            if (this.stopReconnect == false) {
              logger.warn(`[ws-plugin] ${this.name} 关闭 WebSocket 连接`)
            }
            this.arr = this.arr.filter(i => i.id != req.headers['sec-websocket-key'])
            clearInterval(time)
          })
          conn.on('message', async event => {
            const data = JSON.parse(event)
            const result = await this.getData(data.action, data.params, data.echo)
            conn.send(JSON.stringify(result))
          })
          this.arr.push(conn)
        } else if (Url.pathname === '/api' || Url.pathname === '/api/') {
          logger.mark(`[ws-plugin] ${this.name} 接受 WebSocket api 连接: ${req.connection.remoteAddress}`)
          conn.on('error', (event) => {
            logger.error(`[ws-plugin] ${this.name} 接受 WebSocket api 连接时出现错误: ${event}`)
          })
          conn.on('close', () => {
            if (this.stopReconnect == false) {
              logger.warn(`[ws-plugin] ${this.name} 关闭 WebSocket api 连接`)
            }
          })
          conn.on('message', async event => {
            const data = JSON.parse(event)
            const result = await this.getData(data.action, data.params, data.echo)
            conn.send(JSON.stringify(result))
          })
        } else if (Url.pathname === '/event' || Url.pathname === '/event/') {
          conn.id = req.headers['sec-websocket-key']
          let time = null
          conn.send(lifecycle(this.self_id))
          if (Config.heartbeatInterval > 0) {
            time = setInterval(async () => {
              conn.send(heartbeat(this.self_id))
            }, Config.heartbeatInterval * 1000)
          }
          logger.mark(`[ws-plugin] ${this.name} 接受 WebSocket event 连接: ${req.connection.remoteAddress}`)
          conn.on('error', (event) => {
            logger.error(`[ws-plugin] ${this.name} 接受 WebSocket event 连接时出现错误: ${event}`)
          })
          conn.on('close', () => {
            if (this.stopReconnect == false) {
              logger.warn(`[ws-plugin] ${this.name} 关闭 WebSocket event 连接`)
            }
            this.arr = this.arr.filter(i => i.id != req.headers['sec-websocket-key'])
            clearInterval(time)
          })
          this.arr.push(conn)
        } else {
          socket.write('HTTP/1.1 404 NotFound\r\n\r\n')
          socket.destroy()
        }
      })
    })
    this.ws = {
      send: (msg) => {
        for (const i of this.arr) {
          i.send(msg)
        }
      },
      close: () => {
        this.server.close()
        logger.warn(`[ws-plugin] CQ WebSocket 服务器已关闭: ${this.host}:${this.port}`)
        for (const i of this.arr) {
          i.close()
        }
      }
    }
    this.server.on('error', error => {
      logger.error(`[ws-plugin] ${this.name} CQ WebSocket 服务器启动失败: ${this.host}:${this.port}`)
      logger.error(error)
    })
    this.wss = new WebSocketServer({ noServer: true })
    this.server.listen(this.port, this.host, () => {
      this.status = 1
      logger.mark(`[ws-plugin] CQ WebSocket 服务器已启动: ${this.host}:${this.port}`)
    })
  }

  createGSUidWs () {
    try {
      this.ws = new WebSocket(this.address)
    } catch (error) {
      logger.error(`[ws-plugin] 出错了,可能是ws地址填错了~\nws名字: ${this.name}\n地址: ${this.address}\n类型: 3`)
      return
    }
    this.ws.on('open', async () => {
      logger.mark(`[ws-plugin] ${this.name} 已连接`)
      if (this.status == 3 && this.reconnectCount > 1 && Config.reconnectToMaster) {
        await this.sendMasterMsg(`${this.name} 重连成功~`)
      } else if (this.status == 0 && Config.firstconnectToMaster) {
        await this.sendMasterMsg(`${this.name} 连接成功~`)
      }
      this.status = 1
      this.reconnectCount = 1
    })

    this.ws.on('message', async event => {
      const data = JSON.parse(event.toString())
      const { sendMsg, quote } = await makeGSUidSendMsg(data)
      if (sendMsg.length > 0) {
        let sendRet, group_id, user_id
        // const bot = Version.isTrss ? Bot[data.bot_self_id] : Bot
        const bot = Bot[data.bot_self_id] || Bot
        switch (data.target_type) {
          case 'group':
          case 'channel':
            group_id = data.target_id
            if (['qqgroup', 'qqguild'].includes(data.bot_id)) {
              const msg = getLatestMsg(group_id)
              if (msg) {
                msg.reply(sendMsg)
              }
            } else {
              sendRet = await bot.pickGroup(group_id).sendMsg(sendMsg)
            }
            break
          case 'direct':
            user_id = data.target_id
            if (['qqgroup', 'qqguild'].includes(data.bot_id)) {
              const msg = getLatestMsg(user_id)
              if (msg) {
                msg.reply(sendMsg)
              }
            } else {
              sendRet = await bot.pickFriend(user_id).sendMsg(sendMsg)
            }
            break
          default:
            break
        }
        if (sendRet?.message_id) {
          setMsg({
            message_id: sendRet.message_id,
            time: sendRet.time,
            seq: sendRet.seq,
            rand: sendRet.rand,
            user_id,
            group_id,
            onebot_id: Math.floor(Math.random() * Math.pow(2, 32)) | 0
          })
        }
        logger.info(`[ws-plugin] 连接名字:${this.name} 处理完成`)
      }
    })

    this.ws.on('close', async code => {
      logger.warn(`[ws-plugin] ${this.name} 连接已关闭`)
      if (Config.disconnectToMaster && this.reconnectCount == 1 && this.status == 1) {
        await this.sendMasterMsg(`${this.name} 已断开连接...`)
      } else if (Config.firstconnectToMaster && this.reconnectCount == 1 && this.status == 0) {
        await this.sendMasterMsg(`${this.name} 连接失败...`)
      }
      this.status = 3
      if (!this.stopReconnect && ((this.reconnectCount < this.maxReconnectAttempts) || this.maxReconnectAttempts <= 0)) {
        if (code === 1005) {
          logger.warn(`[ws-plugin] ${this.name} 连接异常,停止重连`)
          this.status = 0
        } else {
          logger.warn(`[ws-plugin] ${this.name} 开始尝试重新连接第 ${this.reconnectCount} 次`)
          this.reconnectCount++
          setTimeout(() => {
            this.createGSUidWs()
          }, this.reconnectInterval * 1000)
        }
      } else {
        this.stopReconnect = false
        this.status = 0
        logger.warn(`[ws-plugin] ${this.name} 达到最大重连次数或关闭连接,停止重连`)
      }
    })

    this.ws.on('error', (event) => {
      logger.error(`[ws-plugin] ${this.name} 连接失败\n${event}`)
    })
  }

  createHttp () {
    let index = this.address.lastIndexOf(':')
    this.host = this.address.substring(0, index)
    this.port = this.address.substring(index + 1)
    this.express = express()
    this.server = http.createServer({ maxHeaderSize: Number(this.other.maxHeaderSize) || 8192 }, this.express)
    this.express.use(express.json({ limit: '50mb' }))
    this.express.use(express.urlencoded({ extended: true, limit: '50mb' }))
    this.express.use((req, res, next) => this.authorization(req, res, next))

    this.express.get('/:action', async (req, res) => {
      const { action } = req.params
      const { query: params } = req
      const data = await this.getData(action, params)
      res.status(200).json(data || {})
    })

    this.express.post('/:action', async (req, res) => {
      const { action } = req.params
      const params = {
        ...req.query,
        ...req.body
      }
      const data = await this.getData(action, params)
      res.status(200).json(data || {})
    })

    this.express.post('/', async (req, res) => {
      const { action } = req.body
      const params = {
        ...req.query,
        ...req.body
      }
      const data = await this.getData(action, params)
      res.status(200).json(data || {})
    })

    this.server.on('error', error => {
      logger.error(`[ws-plugin] ${this.name} 正向HTTP 服务器启动失败: ${this.host}:${this.port}`)
      logger.error(error)
    })
    this.server.listen(this.port, this.host, () => {
      this.status = 1
      logger.mark(`[ws-plugin] HTTP 服务器已启动: ${this.host}:${this.port}`)
    })
    this.ws = {
      close: () => {
        this.server.close()
        logger.warn(`[ws-plugin] 正向HTTP 服务器已关闭: ${this.host}:${this.port}`)
      }
    }
  }

  createHttpPost () {
    if (!this.address.startsWith('http')) {
      this.address = 'http://' + this.address
    }
    this.status = 1
    // 心跳咕一下
    this.ws = {
      send: body => {
        fetch(this.address, {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            'x-self-id': this.self_id,
            'user-agent': `ws-plugin/${Version.version}`
          },
          body
        })
      }
    }
  }

  close () {
    this.stopReconnect = true
    if (this.status == 1) {
      this.ws?.close?.()
      this.status = 0
    }
  }

  authorization (req, res, next) {
    let code = null
    const token = req.headers.authorization?.replace?.(this.accessKey, '').trim() || req.query.access_token
    if (this.accessToken) {
      if (!token) {
        code = 401
      } else if (this.accessToken != token) {
        code = 403
      }
    }
    if (code) {
      res.status(code).end()
      return
    }
    next()
  }

  async getData (action, params, echo) {
    const log = JSON.stringify(params, (key, value) => {
      if (/(^messages?$|token)/.test(key)) {
        return '[...]'
      }
      return value
    })
    logger.info(`[ws-plugin] name: ${this.name} 接收到api调用: ${action} 参数: ${log}`)
    let result
    try {
      logger.debug(`[ws-plugin] name: ${this.name} api: ${action} echo: ${echo} 参数: ${params}`)
      const data = await getApiData(action, params, this.name, this.uin, this.adapter, this.other)
      logger.debug(`[ws-plugin] name: ${this.name} api: ${action} echo: ${echo} 返回值:`, data)
      result = {
        status: 'ok',
        retcode: 0,
        data,
        echo
      }
    } catch (error) {
      if (!error.noLog) logger.error('ws-plugin出现错误', error)
      result = {
        status: 'failed',
        retcode: -1,
        msg: error.message,
        wording: 'ws-plugin获取信息失败',
        echo
      }
    }
    return result
  }

  async sendMasterMsg (msg) {
    // const bot = Version.isTrss ? Bot[this.uin] : Bot
    const bot = Bot[this.uin] || Bot
    let masterQQ = []
    const master = Version.isTrss ? Config.master[this.uin] : Config.masterQQ
    if (Config.howToMaster > 0) {
      masterQQ.push(master?.[Config.howToMaster - 1])
    } else if (Config.howToMaster == 0) {
      masterQQ.push(...master)
    }
    for (const i of masterQQ) {
      if (!i) continue
      let result
      try {
        result = await bot?.pickFriend?.(i)?.sendMsg?.(msg) || true
      } catch (error) {
        result = true
      }
      if (result) {
        logger.mark(`[ws-plugin] 连接名字:${this.name} 通知主人:${i} 处理完成`)
      } else {
        const timer = setInterval(async () => {
          try {
            result = await bot?.pickFriend?.(i)?.sendMsg?.(msg) || true
          } catch (error) {
            result = true
          }
          if (result) {
            clearInterval(timer)
            logger.mark(`[ws-plugin] 连接名字:${this.name} 通知主人:${i} 处理完成`)
          }
        }, 5000)
      }
    }
  }
}

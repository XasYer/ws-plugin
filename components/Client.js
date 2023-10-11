import WebSocket, { WebSocketServer } from 'ws'
import { getApiData, makeGSUidSendMsg, lifecycle, heartbeat, setMsgMap } from '../model/index.js'
import { Version, Config } from './index.js'
import express from "express"
import http from "http"
import fetch from 'node-fetch'

export default class Client {
    constructor({ name, address, type, reconnectInterval, maxReconnectAttempts, accessToken, uin = Bot.uin, closed = false }) {
        this.name = name;
        this.address = address;
        this.type = type;
        this.reconnectInterval = reconnectInterval;
        this.maxReconnectAttempts = maxReconnectAttempts;
        this.accessToken = accessToken;
        this.uin = Number(uin)
        this.ws = null
        this.status = 0
        this.closed = closed
    }

    reconnectCount = 1

    timer = null

    stopReconnect = false

    createWs() {
        try {
            const headers = {
                'X-Self-ID': this.uin,
                'X-Client-Role': 'Universal',
                'User-Agent': `ws-plugin/${Version.version}`
            }
            if (this.accessToken) headers["Authorization"] = 'Token ' + this.accessToken
            this.ws = new WebSocket(this.address, { headers })
        } catch (error) {
            logger.error(`[ws-plugin] 出错了,可能是ws地址填错了~\nws名字: ${this.name}\n地址: ${this.address}\n类型: 1`)
            return
        }
        this.ws.on('open', async () => {
            logger.mark(`[ws-plugin] ${this.name} 已连接`);
            if (this.status == 3 && this.reconnectCount > 1 && Config.reconnectToMaster) {
                await this.sendMasterMsg(`${this.name} 重连成功~`)
            } else if (this.status == 0 && Config.firstconnectToMaster) {
                await this.sendMasterMsg(`${this.name} 连接成功~`)
            }
            this.ws.send(lifecycle(this.uin))
            this.status = 1
            this.reconnectCount = 1
            if (Config.heartbeatInterval > 0) {
                this.timer = setInterval(async () => {
                    this.ws.send(heartbeat(this.uin))
                }, Config.heartbeatInterval * 1000)
            }
        })
        this.ws.on('message', async (event) => {
            let data
            if (Buffer.isBuffer(event)) {
                data = JSON.parse(event.toString())
            } else {
                data = JSON.parse(event.data);
            }
            let result = await this.getData(data.action, data.params, data.echo)
            this.ws.send(JSON.stringify(result));
        })
        this.ws.on('close', async code => {
            logger.warn(`[ws-plugin] ${this.name} 连接已关闭`);
            clearInterval(this.timer)
            if (Config.disconnectToMaster && this.reconnectCount == 1 && this.status == 1) {
                await this.sendMasterMsg(`${this.name} 已断开连接...`)
            } else if (Config.firstconnectToMaster && this.reconnectCount == 1 && this.status == 0) {
                await this.sendMasterMsg(`${this.name} 连接失败...`)
            }
            this.status = 3
            if (!this.stopReconnect && ((this.reconnectCount < this.maxReconnectAttempts) || this.maxReconnectAttempts <= 0)) {
                if (code === 1005) {
                    logger.warn(`[ws-plugin] ${this.name} 连接异常,停止重连`);
                    this.status = 0
                } else {
                    logger.warn(`[ws-plugin] ${this.name} 开始尝试重新连接第${this.reconnectCount}次`);
                    this.reconnectCount++
                    setTimeout(() => {
                        this.createWs()
                    }, this.reconnectInterval * 1000);
                }
            } else {
                this.stopReconnect = false
                this.status = 0
                logger.warn(`[ws-plugin] ${this.name} 达到最大重连次数或关闭连接,停止重连`);
            }
        })
        this.ws.on('error', (event) => {
            logger.error(`[ws-plugin] ${this.name} 连接失败\n${event}`);
        })
    }

    createServer() {
        const parts = this.address.split(':');
        this.host = parts[0];
        this.port = parts[1];
        this.arr = []
        this.express = express()
        this.server = http.createServer(this.express)
        this.server.on("upgrade", (req, socket, head) => {
            if (this.accessToken) {
                const token = req.headers['authorization']?.replace('Token ', '')
                if (!token) {
                    socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
                    socket.destroy();
                    return
                } else if (this.accessToken != token) {
                    socket.write('HTTP/1.1 403 Forbidden\r\n\r\n');
                    socket.destroy();
                    return;
                }
            }
            this.wss.handleUpgrade(req, socket, head, conn => {
                if (req.url === '/') {
                    conn.id = req.headers["sec-websocket-key"]
                    let time = null
                    conn.send(lifecycle(this.uin))
                    if (Config.heartbeatInterval > 0) {
                        time = setInterval(async () => {
                            conn.send(heartbeat(this.uin))
                        }, Config.heartbeatInterval * 1000)
                    }
                    logger.mark(`[ws-plugin] ${this.name} 接受 WebSocket 连接: ${req.connection.remoteAddress}`);
                    conn.on("error", (event) => {
                        logger.error(`[ws-plugin] ${this.name} 接受 WebSocket 连接时出现错误: ${event}`)
                    })
                    conn.on("close", () => {
                        if (this.stopReconnect = false) {
                            logger.warn(`[ws-plugin] ${this.name} 关闭 WebSocket 连接`);
                        }
                        this.arr = this.arr.filter(i => i.id != req.headers["sec-websocket-key"])
                        clearInterval(time)
                    })
                    conn.on("message", async event => {
                        const data = JSON.parse(event)
                        const result = await this.getData(data.action, data.params, data.echo)
                        conn.send(JSON.stringify(result));
                    })
                    this.arr.push(conn)
                } else if (req.url === '/api' || req.url === '/api/') {
                    logger.mark(`[ws-plugin] ${this.name} 接受 WebSocket api 连接: ${req.connection.remoteAddress}`);
                    conn.on("error", (event) => {
                        logger.error(`[ws-plugin] ${this.name} 接受 WebSocket api 连接时出现错误: ${event}`)
                    })
                    conn.on("close", () => {
                        if (this.stopReconnect = false) {
                            logger.warn(`[ws-plugin] ${this.name} 关闭 WebSocket api 连接`);
                        }
                    })
                    conn.on("message", async event => {
                        const data = JSON.parse(event)
                        const result = await this.getData(data.action, data.params, data.echo)
                        conn.send(JSON.stringify(result));
                    })
                } else if (req.url === '/event' || req.url === '/event/') {
                    conn.id = req.headers["sec-websocket-key"]
                    let time = null
                    conn.send(lifecycle(this.uin))
                    if (Config.heartbeatInterval > 0) {
                        time = setInterval(async () => {
                            conn.send(heartbeat(this.uin))
                        }, Config.heartbeatInterval * 1000)
                    }
                    logger.mark(`[ws-plugin] ${this.name} 接受 WebSocket event 连接: ${req.connection.remoteAddress}`);
                    conn.on("error", (event) => {
                        logger.error(`[ws-plugin] ${this.name} 接受 WebSocket event 连接时出现错误: ${event}`)
                    })
                    conn.on("close", () => {
                        if (this.stopReconnect = false) {
                            logger.warn(`[ws-plugin] ${this.name} 关闭 WebSocket event 连接`);
                        }
                        this.arr = this.arr.filter(i => i.id != req.headers["sec-websocket-key"])
                        clearInterval(time)
                    })
                    this.arr.push(conn)
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

    createGSUidWs() {
        try {
            this.ws = new WebSocket(this.address)
        } catch (error) {
            logger.error(`[ws-plugin] 出错了,可能是ws地址填错了~\nws名字: ${this.name}\n地址: ${this.address}\n类型: 3`)
            return
        }
        this.ws.on('open', async () => {
            logger.mark(`[ws-plugin] ${this.name} 已连接`);
            if (this.status == 3 && this.reconnectCount > 1 && Config.reconnectToMaster) {
                await this.sendMasterMsg(`${this.name} 重连成功~`)
            } else if (this.status == 0 && Config.firstconnectToMaster) {
                await this.sendMasterMsg(`${this.name} 连接成功~`)
            }
            this.status = 1
            this.reconnectCount = 1
        })

        this.ws.on('message', async event => {
            const data = JSON.parse(event.toString());
            const { sendMsg, quote } = await makeGSUidSendMsg(data)
            if (sendMsg.length > 0) {
                let sendRet, group_id, user_id
                const bot = Version.isTrss ? Bot[data.bot_self_id] : Bot
                switch (data.target_type) {
                    case 'group':
                    case 'channel':
                        group_id = data.target_id
                        sendRet = await bot.pickGroup(group_id).sendMsg(sendMsg, quote)
                        break;
                    case 'direct':
                        user_id = data.target_id
                        sendRet = await bot.pickFriend(user_id).sendMsg(sendMsg, quote)
                        break;
                    default:
                        break;
                }
                if (sendRet.rand) {
                    setMsgMap({
                        message_id: sendRet.message_id,
                        time: sendRet.time,
                        seq: sendRet.seq,
                        rand: sendRet.rand,
                        user_id: user_id,
                        group_id: group_id,
                        onebot_id: Math.floor(Math.random() * Math.pow(2, 32)) | 0,
                    })
                }
                logger.mark(`[ws-plugin] 连接名字:${this.name} 处理完成`)
            }
        })

        this.ws.on('close', async code => {
            logger.warn(`[ws-plugin] ${this.name} 连接已关闭`);
            if (Config.disconnectToMaster && this.reconnectCount == 1 && this.status == 1) {
                await this.sendMasterMsg(`${this.name} 已断开连接...`)
            } else if (Config.firstconnectToMaster && this.reconnectCount == 1 && this.status == 0) {
                await this.sendMasterMsg(`${this.name} 连接失败...`)
            }
            this.status = 3
            if (!this.stopReconnect && ((this.reconnectCount < this.maxReconnectAttempts) || this.maxReconnectAttempts <= 0)) {
                if (code === 1005) {
                    logger.warn(`[ws-plugin] ${this.name} 连接异常,停止重连`);
                    this.status = 0
                } else {
                    logger.warn(`[ws-plugin] ${this.name} 开始尝试重新连接第 ${this.reconnectCount} 次`);
                    this.reconnectCount++
                    setTimeout(() => {
                        this.createGSUidWs()
                    }, this.reconnectInterval * 1000);
                }
            } else {
                this.stopReconnect = false
                this.status = 0
                logger.warn(`[ws-plugin] ${this.name} 达到最大重连次数或关闭连接,停止重连`);
            }
        })

        this.ws.on('error', (event) => {
            logger.error(`[ws-plugin] ${this.name} 连接失败\n${event}`);
        })
    }

    // async createQQNT() {
    //     const token = this.address.split(':')
    //     if (!token[2]) {
    //         if (this.accessToken) {
    //             token[2] = this.accessToken
    //         } else {
    //             token[2] = getToken()
    //             if (!token[2]) return
    //         }
    //     }
    //     const bot = {
    //         host: token[0],
    //         port: token[1],
    //         token: token[2]
    //     }
    //     bot.sendApi = async (method, api, body) => {
    //         const controller = new AbortController()
    //         const signal = controller.signal
    //         const timeout = 30000
    //         setTimeout(() => {
    //             controller.abort()
    //         }, timeout);
    //         return await fetch(`http://${bot.host}:${bot.port}/api/${api}`, {
    //             signal,
    //             method,
    //             body,
    //             headers: {
    //                 Authorization: 'Bearer ' + bot.token
    //             }
    //         }).then(r => {
    //             if (!r.ok) throw r
    //             const contentType = r.headers.get('content-type');
    //             if (contentType.includes('application/json')) {
    //                 return r.json();
    //             } else if (contentType.includes('text/plain')) {
    //                 return r.text();
    //             } else {
    //                 return r
    //             }
    //         }).catch(error => {
    //             if (error.name === 'AbortError') {
    //                 return { error: `[ws-plugin] ${logger.red(`[${this.uin}] ${api} 请求超时, 请检查账号状态或重启QQ！`)}` }
    //             } else {
    //                 return { error }
    //             }
    //         })
    //     }
    //     this.ws = {
    //         close: () => {
    //             bot.ws?.close()
    //         }
    //     }
    //     const reconnect = () => {
    //         if (!this.stopReconnect && ((this.reconnectCount < this.maxReconnectAttempts) || this.maxReconnectAttempts <= 0)) {
    //             this.status = 3
    //             logger.warn(`[ws-plugin] ${this.name} 开始尝试重新连接第${this.reconnectCount}次`);
    //             this.reconnectCount++
    //             setTimeout(() => {
    //                 this.createQQNT()
    //             }, this.reconnectInterval * 1000);
    //         } else {
    //             this.stopReconnect = false
    //             this.status = 0
    //             logger.warn(`[ws-plugin] ${this.name} 达到最大重连次数或关闭连接,停止重连`);
    //         }
    //     }
    //     let info = await bot.sendApi('get', 'getSelfProfile')
    //     if (info.error) {
    //         if (info.error.code == 'ECONNREFUSED') {
    //             logger.error(`[ws-plugin] ${this.name} 请检查是否安装Chronocat并启动QQNT`)
    //             reconnect()
    //             return
    //         }
    //         logger.error(`[ws-plugin] ${this.name} Token错误`)
    //         logger.error(info.error)
    //         return
    //     }
    //     if (!info.uin) {
    //         logger.error(`[ws-plugin] ${this.name} 请点击登录`)
    //         reconnect()
    //         return
    //     }
    //     if (!Bot.uin.includes(info.uin)) {
    //         Bot.uin.push(info.uin)
    //     }
    //     bot.info = {
    //         ...info,
    //         user_id: info.uin,
    //         self_id: info.uin,
    //         nickname: info.nick,
    //         username: info.nick
    //     }
    //     bot.nickname = info.nick
    //     bot.self_id = info.uin
    //     this.uin = bot.self_id
    //     bot.uin = bot.self_id
    //     bot.ws = new WebSocket(`ws://${bot.host}:${bot.port}`)
    //     bot.send = (type, payload) => bot.ws.send(JSON.stringify({ type, payload }))
    //     bot.ws.on('open', () => bot.send('meta::connect', { token: bot.token }))
    //     bot.ws.on('message', data => toQQRedMsg(bot, data))
    //     bot.ws.on('close', (code) => {
    //         delete Bot[bot.self_id]
    //         this.status = 0
    //         switch (code) {
    //             case 1005:
    //                 logger.error(`[ws-plugin] ${this.name}(${this.uin}) 主动断开连接`)
    //                 return
    //             case 1006:
    //                 this.status = 3
    //                 logger.error(`[ws-plugin] ${this.name}(${this.uin}) QQNT被关闭`)
    //                 reconnect()
    //                 return
    //             default:
    //                 return
    //         }
    //     })
    //     Bot[bot.self_id] = new QQRedBot(bot)
    //     logger.mark(`[ws-plugin] ${logger.blue(`[${bot.self_id}]`)} ${this.name} 已连接`)
    //     this.status = 1
    //     Bot.em(`connect.${bot.self_id}`, Bot[bot.self_id])
    //     return true
    // }

    createHttp() {
        const parts = this.address.split(':');
        this.host = parts[0];
        this.port = parts[1];
        this.express = express();
        this.server = http.createServer(this.express);
        this.express.use(express.json({ limit: '50mb' }));
        this.express.use(express.urlencoded({ extended: true, limit: '50mb' }));
        this.express.use((req, res, next) => this.authorization(req, res, next))

        this.express.get('/:action', async (req, res) => {
            const { action } = req.params;
            const { query: params } = req;
            const data = await this.getData(action, params)
            res.status(200).json(data || {})
        });

        this.express.post('/:action', async (req, res) => {
            const { action } = req.params;
            const { body: params } = req;
            const data = await this.getData(action, params)
            res.status(200).json(data || {})
        });

        this.express.post('/', async (req, res) => {
            const { action, params } = req.body;
            const data = await this.getData(action, params)
            res.status(200).json(data || {})
        });

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

    createHttpPost() {
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
                        'x-self-id': this.uin,
                        'user-agent': `ws-plugin/${Version.version}`
                    },
                    body
                })
            }
        }
    }

    close() {
        this.stopReconnect = true
        if (this.status == 1) {
            this.ws?.close?.()
            this.status = 0
        }
    }

    authorization(req, res, next) {
        let code = null
        const token = req.headers['authorization']?.replace?.(/^(Token|Bearer) /, '') || req.query.access_token
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

    async getData(action, params, echo) {
        let result
        try {
            const data = await getApiData(action, params, this.name, this.uin);
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
        } finally {
            return result
        }
    }

    async sendMasterMsg(msg) {
        const bot = Version.isTrss ? Bot[this.uin] : Bot
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
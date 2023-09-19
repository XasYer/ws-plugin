import WebSocket, { WebSocketServer } from 'ws'
import { getApiData, makeGSUidSendMsg, lifecycle, heartbeat, setMsgMap, QQNTBot, getToken, toQQNTMsg } from '../model/index.js'
import { Version, Config } from './index.js'
import express from "express"
import http from "http"
import fetch from 'node-fetch'

export default class Client {
    constructor({ name, address, type, reconnectInterval, maxReconnectAttempts, accessToken, uin = Bot.uin }) {
        this.name = name;
        this.address = address;
        this.type = type;
        this.reconnectInterval = reconnectInterval;
        this.maxReconnectAttempts = maxReconnectAttempts;
        this.accessToken = accessToken;
        this.uin = uin
        this.ws = null
        this.status = 0
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
            logger.error(`出错了,可能是ws地址填错了~\nws名字: ${this.name}\n地址: ${this.address}\n类型: 1`)
            return
        }
        this.ws.on('open', async () => {
            logger.mark(`${this.name}已连接`);
            if (this.status == 3 && this.reconnectCount > 1 && Config.reconnectToMaster) {
                await this.sendMasterMsg(`${this.name}重连成功~`)
            } else if (this.status == 0 && Config.firstconnectToMaster) {
                await this.sendMasterMsg(`${this.name}连接成功~`)
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
            let ret
            try {
                let responseData = await getApiData(data.action, data.params, this.name, this.uin);
                ret = {
                    status: 'ok',
                    retcode: 0,
                    data: responseData,
                    echo: data.echo
                }
            } catch (error) {
                if (!error.noLog) logger.error('ws-plugin出现错误', error)
                ret = {
                    status: 'failed',
                    retcode: -1,
                    msg: error.message,
                    wording: 'ws-plugin获取信息失败',
                    echo: data.echo
                }
            }
            this.ws.send(JSON.stringify(ret));
        })
        this.ws.on('close', async code => {
            logger.warn(`${this.name} 连接已关闭`);
            clearInterval(this.timer)
            if (Config.disconnectToMaster && this.reconnectCount == 1 && this.status == 1) {
                await this.sendMasterMsg(`${this.name} 已断开连接...`)
            } else if (Config.firstconnectToMaster && this.reconnectCount == 1 && this.status == 0) {
                await this.sendMasterMsg(`${this.name} 连接失败...`)
            }
            this.status = 3
            if (!this.stopReconnect && ((this.reconnectCount < this.maxReconnectAttempts) || this.maxReconnectAttempts <= 0)) {
                if (code === 1005) {
                    logger.warn(`${this.name} 连接异常,停止重连`);
                    this.status = 0
                } else {
                    logger.warn(`${this.name} 开始尝试重新连接第${this.reconnectCount}次`);
                    this.reconnectCount++
                    setTimeout(() => {
                        this.createWs()
                    }, this.reconnectInterval * 1000);
                }
            } else {
                this.stopReconnect = false
                this.status = 0
                logger.warn(`${this.name} 达到最大重连次数或关闭连接,停止重连`);
            }
        })
        this.ws.on('error', (event) => {
            logger.error(`${this.name} 连接失败\n${event}`);
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
                if (this.accessToken != token) {
                    socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
                    socket.destroy();
                }
            }
            if (req.url === '/') {
                this.wss.handleUpgrade(req, socket, head, conn => {
                    conn.id = req.headers["sec-websocket-key"]
                    let time = null
                    conn.send(lifecycle(this.uin))
                    if (Config.heartbeatInterval > 0) {
                        time = setInterval(async () => {
                            conn.send(heartbeat(this.uin))
                        }, Config.heartbeatInterval * 1000)
                    }
                    logger.mark(`${this.name} 接受 WebSocket 连接: ${req.connection.remoteAddress}`);
                    conn.on("error", (event) => {
                        logger.error(`${this.name} 接受 WebSocket 连接时出现错误: ${event}`)
                    })
                    conn.on("close", () => {
                        if (this.stopReconnect = false) {
                            logger.warn(`${this.name} 关闭 WebSocket 连接`);
                        }
                        this.arr = this.arr.filter(i => i != req.headers["sec-websocket-key"])
                        clearInterval(time)
                    })
                    conn.on("message", async event => {
                        const data = JSON.parse(event)
                        let ret
                        try {
                            let responseData = await getApiData(data.action, data.params, this.name, this.uin);
                            ret = {
                                status: 'ok',
                                retcode: 0,
                                data: responseData,
                                echo: data.echo
                            }
                        } catch (error) {
                            if (!error.noLog) logger.error('ws-plugin出现错误', error)
                            ret = {
                                status: 'failed',
                                retcode: -1,
                                msg: error.message,
                                wording: 'ws-plugin获取信息失败',
                                echo: data.echo
                            }
                        }
                        conn.send(JSON.stringify(ret));
                    })
                    this.arr.push(conn)
                })
            } else if (req.url === '/api' || req.url === '/api/') {
                // 处理 /api 请求
            } else if (req.url === '/event' || req.url === '/event/') {
                // 处理 /event 请求
            }
        })
        this.ws = {
            send: (msg) => {
                for (const i of this.arr) {
                    i.send(msg)
                }
            },
            close: () => {
                this.server.close()
                logger.warn(`CQ WebSocket 服务器已关闭: ${this.host}:${this.port}`)
                for (const i of this.arr) {
                    i.close()
                }
            }
        }
        this.wss = new WebSocketServer({ noServer: true })
        try {
            this.server.listen(this.port, this.host, () => {
                this.status = 1
                logger.mark(`CQ WebSocket 服务器已启动: ${this.host}:${this.port}`)
            })
        } catch (error) {
            logger.error(error)
            logger.error(`${this.name} CQ WebSocket 服务器失败: ${this.host}:${this.port}`)
        }
    }

    createGSUidWs() {
        try {
            this.ws = new WebSocket(this.address)
        } catch (error) {
            logger.error(`出错了,可能是ws地址填错了~\nws名字: ${this.name}\n地址: ${this.address}\n类型: 3`)
            return
        }
        this.ws.on('open', async () => {
            logger.mark(`${this.name}已连接`);
            if (this.status == 3 && this.reconnectCount > 1 && Config.reconnectToMaster) {
                await this.sendMasterMsg(`${this.name}重连成功~`)
            } else if (this.status == 0 && Config.firstconnectToMaster) {
                await this.sendMasterMsg(`${this.name}连接成功~`)
            }
            this.status = 1
            this.reconnectCount = 1
        })

        this.ws.on('message', async event => {
            const data = JSON.parse(event.toString());
            const { sendMsg, quote } = await makeGSUidSendMsg(data)
            if (sendMsg.length > 0) {
                let sendRet
                switch (data.target_type) {
                    case 'group':
                        if (Version.isTrss) {
                            await Bot[data.bot_self_id].pickGroup(data.target_id).sendMsg(sendMsg)
                        } else {
                            sendRet = await Bot.sendGroupMsg(data.target_id, sendMsg, quote)
                        }
                        break;
                    case 'direct':
                        if (Version.isTrss) {
                            await Bot[data.bot_self_id].pickFriend(data.target_id).sendMsg(sendMsg)
                        } else {
                            sendRet = await Bot.sendPrivateMsg(data.target_id, sendMsg, quote)
                        }
                        break;
                    case 'channel':
                        if (Version.isTrss) {
                            await Bot[data.bot_self_id].pickGroup(data.target_id).sendMsg(sendMsg)
                        }
                        break
                    default:
                        break;
                }
                if (sendRet) await setMsgMap(sendRet.rand, sendRet)
                logger.mark(`[ws-plugin] 连接名字:${this.name} 处理完成`)
            }
        })

        this.ws.on('close', async code => {
            logger.warn(`${this.name}连接已关闭`);
            if (Config.disconnectToMaster && this.reconnectCount == 1 && this.status == 1) {
                await this.sendMasterMsg(`${this.name}已断开连接...`)
            } else if (Config.firstconnectToMaster && this.reconnectCount == 1 && this.status == 0) {
                await this.sendMasterMsg(`${this.name}连接失败...`)
            }
            this.status = 3
            if (!this.stopReconnect && ((this.reconnectCount < this.maxReconnectAttempts) || this.maxReconnectAttempts <= 0)) {
                if (code === 1005) {
                    logger.warn(`${this.name} 连接异常,停止重连`);
                    this.status = 0
                } else {
                    logger.warn('开始尝试重新连接第' + this.reconnectCount + '次');
                    this.reconnectCount++
                    setTimeout(() => {
                        this.createGSUidWs()
                    }, this.reconnectInterval * 1000);
                }
            } else {
                this.stopReconnect = false
                this.status = 0
                logger.warn('达到最大重连次数或关闭连接,停止重连');
            }
        })

        this.ws.on('error', (event) => {
            logger.error(`${this.name}连接失败\n${event}`);
        })
    }

    async createQQNT() {
        const token = this.address.split(':')
        if (!token[2]) {
            if (this.accessToken) {
                token[2] = this.accessToken
            } else {
                token[2] = getToken()
                if (!token[2]) return
            }
        }
        const bot = {
            host: token[0],
            port: token[1],
            token: token[2]
        }
        bot.sendApi = async (method, api, body) => {
            const controller = new AbortController()
            const signal = controller.signal
            const timeout = 30000
            setTimeout(() => {
                controller.abort()
            }, timeout);
            return await fetch(`http://${bot.host}:${bot.port}/api/${api}`, {
                signal,
                method,
                body,
                headers: {
                    Authorization: 'Bearer ' + bot.token
                }
            }).then(r => {
                if (!r.ok) throw r
                const contentType = r.headers.get('content-type');
                if (contentType.includes('application/json')) {
                    return r.json();
                } else if (contentType.includes('text/plain')) {
                    return r.text();
                } else {
                    return r
                }
            }).catch(error => {
                if (error.name === 'AbortError') {
                    return { error: `${logger.red(`[${this.uin}] ${api} 请求超时, 请检查账号状态！`)}`, code: 1 }
                } else {
                    return { error: `${logger.red(`[${this.uin}] ${api} 请求失败\n${error}`)}`, code: 2 }
                }
            })
        }
        this.ws = {
            close: () => {
                bot.ws?.close()
            }
        }
        const reconnect = () => {
            if (!this.stopReconnect && ((this.reconnectCount < this.maxReconnectAttempts) || this.maxReconnectAttempts <= 0)) {
                this.status = 3
                logger.warn(`${this.name} 开始尝试重新连接第${this.reconnectCount}次`);
                this.reconnectCount++
                setTimeout(() => {
                    this.createQQNT()
                }, this.reconnectInterval * 1000);
            } else {
                this.stopReconnect = false
                this.status = 0
                logger.warn(`${this.name} 达到最大重连次数或关闭连接,停止重连`);
            }
        }
        let info = await bot.sendApi('get', 'getSelfProfile')
        if (info.error) {
            if (info.code == 2) {
                logger.error(`${this.name} Token错误`)
                return
            }
            logger.error(`${this.name} 请检查是否安装Chronocat并启动QQNT`)
            reconnect()
            return
        }
        if (!info.uin) {
            logger.error(`${this.name} 请点击登录`)
            reconnect()
            return
        }
        if (!Bot.uin.includes(info.uin)) {
            Bot.uin.push(info.uin)
        }
        bot.info = {
            ...info,
            user_id: info.uin,
            self_id: info.uin,
            nickname: info.nick,
            username: info.nick
        }
        bot.nickname = info.nick
        bot.self_id = info.uin
        this.uin = bot.self_id
        bot.uin = bot.self_id
        bot.ws = new WebSocket(`ws://${bot.host}:${bot.port}`)
        bot.send = (type, payload) => bot.ws.send(JSON.stringify({ type, payload }))
        bot.ws.on('open', () => bot.send('meta::connect', { token: bot.token }))
        bot.ws.on('message', data => toQQNTMsg(bot, data))
        bot.ws.on('close', (code) => {
            delete Bot[bot.self_id]
            this.status = 3
            switch (code) {
                case 1005:
                    this.status = 0
                    logger.error(`${this.name}(${this.uin}) 主动断开连接`)
                    return
                case 1006:
                    logger.error(`${this.name}(${this.uin}) QQNT被关闭`)
                    reconnect()
                    return
                default:
                    return
            }
        })
        Bot[bot.self_id] = new QQNTBot(bot)
        logger.mark(`${logger.blue(`[${bot.self_id}]`)} ${this.name} 已连接`)
        this.status = 1
        Bot.em(`connect.${bot.self_id}`, Bot[bot.self_id])
        return true
    }

    close() {
        this.stopReconnect = true
        if (this.status == 1) {
            this.ws?.close()
            this.status = 3
        }
    }

    async sendMasterMsg(msg) {
        let target = []
        if (Config.howToMaster > 0) {
            target.push(Config.masterQQ[Config.howToMaster - 1])
        } else if (Config.howToMaster == 0) {
            target.push(...Config.masterQQ)
        }
        for (const i of target) {
            let result = await Bot.sendPrivateMsg(i, msg)
            if (result) {
                logger.mark(`[ws-plugin] 连接名字:${this.name} 通知主人:${i} 处理完成`)
            } else {
                const timer = setInterval(async () => {
                    result = await Bot.sendPrivateMsg(i, msg)
                    if (result) {
                        clearInterval(timer)
                        logger.mark(`[ws-plugin] 连接名字:${this.name} 通知主人:${i} 处理完成`)
                    }
                }, 5000)
            }
        }
    }

}
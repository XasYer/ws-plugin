import { QQRedBot } from "./bot.js"
import { getToken } from './tool.js'
import { toQQRedMsg } from './message.js'
import { Version, Config, allSocketList, setAllSocketList } from '../../components/index.js'
import WebSocket from 'ws'
import fetch from "node-fetch"

logger.info(logger.yellow("- 正在加载 Chronocat(red) 适配器插件"))

export const redAdapter = new class RedAdapter {
    constructor() {
        this.id = "QQ"
        this.name = 'chronocat'
    }

    reconnectCount = 1

    async connect(data) {
        if (data.closed) return
        const [host, port] = data.address.split(':')
        let token = data.accessToken
        if (!token) {
            token = getToken()
            if (!token) return
        }
        const bot = {
            host,
            port,
            token
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
                if (contentType?.includes('application/json')) {
                    return r.json();
                } else if (contentType?.includes('text/plain')) {
                    return r.text();
                } else {
                    return r
                }
            }).catch(error => {
                if (error.name === 'AbortError') {
                    return { error: `${logger.red(`[${this.uin}] ${api} 请求超时, 请检查账号状态或重启QQ！`)}` }
                } else {
                    return { error }
                }
            })
        }
        const reconnect = () => {
            if (!data.stopReconnect && ((this.reconnectCount < data.maxReconnectAttempts) || data.maxReconnectAttempts <= 0)) {
                logger.warn(`[ws-plugin] ${this.name} 开始尝试重新连接第${this.reconnectCount}次`);
                this.reconnectCount++
                setTimeout(() => {
                    this.connect(data)
                }, data.reconnectInterval * 1000);
            } else {
                this.stopReconnect = false
                logger.warn(`[ws-plugin] ${this.name} 达到最大重连次数或关闭连接,停止重连`);
            }
        }
        let info = await bot.sendApi('get', 'getSelfProfile')
        if (info.error) {
            if (info.error.code == 'ECONNREFUSED') {
                logger.error(`[ws-plugin] ${this.name} 请检查是否安装Chronocat并启动QQNT`)
                reconnect()
                return
            } else if (info.error.status == 401) {
                logger.error(`[ws-plugin] ${this.name} Token错误`)
                return
            }
            logger.error(`[ws-plugin] ${this.name} 出现错误`)
            logger.error(await info.error.text?.() || info.error)
            return
        }
        if (!info.uin) {
            logger.error(`[ws-plugin] ${this.name} 请点击登录`)
            reconnect()
            return
        }
        bot.info = {
            ...info,
            user_id: info.uin,
            self_id: info.uin,
            nickname: info.nick,
            username: info.nick
        }
        bot.nickname = info.nick
        bot.self_id = Number(info.uin)
        this.uin = bot.self_id
        bot.uin = bot.self_id
        bot.ws = new WebSocket(`ws://${bot.host}:${bot.port}`)
        bot.send = (type, payload) => bot.ws.send(JSON.stringify({ type, payload }))
        bot.ws.on('open', () => bot.send('meta::connect', { token: bot.token }))
        bot.ws.on('message', data => toQQRedMsg(bot, data))
        bot.ws.on('close', (code) => {
            delete Bot[bot.self_id]
            switch (code) {
                case 1005:
                    logger.error(`[ws-plugin] ${this.name}(${bot.self_id}) 主动断开连接`)
                    return
                case 1006:
                    logger.error(`[ws-plugin] ${this.name}(${bot.self_id}) QQNT被关闭`)
                    reconnect()
                    return
                default:
                    return
            }
        })
        Bot[bot.self_id] = new QQRedBot(bot)
        if (!Version.isTrss) {
            /** 米游社主动推送、椰奶状态pro */
            if (!Bot?.adapter) {
                Bot.adapter = [Bot.uin]
                Bot.adapter.push(bot.self_id)
            } else {
                Bot.adapter.push(bot.self_id)
                /** 去重防止断连后出现多个重复的id */
                Bot.adapter = Array.from(new Set(Bot.adapter.map(JSON.stringify))).map(JSON.parse)
            }
        }
        logger.mark(`${logger.blue(`[${bot.self_id}]`)} ${this.name}(${this.id}) 已连接`)
        data.ws = {
            close: () => {
                bot.ws.close()
            }
        }
        data.status = 1
        data.uin = this.uin
        setAllSocketList(data)
        this.reconnectCount = 1
        Bot.em(`connect.${bot.self_id}`, Bot[bot.self_id])
        return true
    }

    async load() {
        for (const i of allSocketList) {
            if (i.type == 4) {
                await new Promise(resolve => {
                    redAdapter.connect(i).then(resolve)
                    setTimeout(resolve, 5000)
                })
            }
        }
    }
}

if (Version.isTrss) {
    Bot.adapter.push(redAdapter)
}
logger.info(logger.green("- Chronocat(red) 适配器插件 加载完成"))
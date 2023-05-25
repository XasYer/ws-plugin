import plugin from '../../../lib/plugins/plugin.js'
import { Config, clearWebSocket, initWebSocket } from '../components/index.js'

export class setting extends plugin {
    constructor() {
        super({
            name: '[ws-plugin] 设置',
            dsc: '[ws-plugin] 设置',
            event: 'message.private',
            priority: 998,
            rule: [
                {
                    reg: '^#ws添加连接$',
                    fnc: 'addWs',
                    permission: 'master'
                },
                {
                    reg: '^#ws删除连接',
                    fnc: 'delWs',
                    permission: 'master'
                },
                {
                    reg: '^#ws连接说明$',
                    fnc: 'help',
                    permission: 'master'
                },
                {
                    reg: '^#ws重新连接$',
                    fnc: 'reset',
                    permission: 'master'
                }
            ]
        })

    }

    async addWs() {
        this.setContext('checkAddWs')
        await this.reply('请一次性发送以下参数:\n连接名字,连接地址,连接类型,重连间隔,最大重连次数\n用逗号分割,例如:\nNoneBot2,ws://127.0.0.1:8080/onebot/v11/ws,1,5,0\n如果对参数不懂意思,可以发送#ws连接说明')
        return false
    }

    async delWs() {
        let msg = this.e.msg
        msg = msg.replace('#ws删除连接', '').trim()
        if (msg) {
            let servers = Config.servers
            let target = null
            for (let i = 0; i < servers.length; i++) {
                if (servers[i].name == msg) {
                    target = servers[i]
                    break
                }
            }
            if (!target) {
                this.reply(`没有连接名字为${msg}的连接`)
                return true
            } else {
                try {
                    Config.delServersArr(target.name)
                    this.reply('操作成功~')
                    return true
                } catch (error) {
                    logger.error(error)
                    this.reply('操作失败~')
                    return true
                }
            }
        } else {
            this.setContext('checkDelWs')
            this.reply('请继续发送需要删除的ws连接名字')
            return false
        }
    }

    async help() {
        await this.reply('ws连接说明:\n1.连接名字:一般代表需要连接的bot名字\n2.连接地址:需要连接的ws地址或者本地开启的地址:端口\n3.连接类型:1.反向ws连接 2.正向ws连接 3.gsuid_core专用连接\n4.重连间隔:连接被断开之后每隔一段时间进行重新连接,单位秒,0代表不重连\n5.最大重连次数:每次连接失败时+1,达到最大重连次数时停止重新连接,0代表一直重连')
        return true
    }

    async checkAddWs() {
        if (!this.e.msg) {
            return false
        }
        let msg = this.e.msg
        if (msg == '#ws连接说明') {
            await this.help()
            this.setContext('checkAddWs')
            return false
        }
        msg = msg.split(/,|，/g)
        if (msg.length != 5) {
            await this.reply('格式有误,请检查后重新发送')
            this.setContext('checkAddWs')
        } else {
            let value = {
                name: msg[0],
                address: msg[1],
                type: msg[2],
                reconnectInterval: msg[3],
                maxReconnectAttempts: msg[4],
            }
            try {
                Config.modifyarr('ws-config', 'servers', value)
                this.reply('操作成功~')
            } catch (error) {
                logger.error(error)
                this.reply('操作失败~')
            }
            this.finish('checkAddWs')
        }
        return false
    }

    async checkDelWs() {
        if (!this.e.msg) {
            return false
        }
        let msg = this.e.msg
        let servers = Config.servers
        let target = null
        for (let i = 0; i < servers.length; i++) {
            if (servers[i].name == msg) {
                target = servers[i]
                break
            }
        }
        if (!target) {
            this.reply(`没有连接名字为${msg}的连接`)
            this.finish('checkDelWs')
            return true
        } else {
            try {
                Config.delServersArr(target.name)
                this.reply('操作成功,请留意控制台输出')
                this.finish('checkDelWs')
                return true
            } catch (error) {
                logger.error(error)
                this.reply('操作失败,请留意控制台输出')
                this.finish('checkDelWs')
                return true
            }
        }
    }

    async reset() {
        clearWebSocket()
        initWebSocket(Config.servers)
        this.reply('操作成功~')
        return true
    }
}
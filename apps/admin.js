import plugin from '../../../lib/plugins/plugin.js'
import { Config, clearWebSocket, initWebSocket, Render, Version, socketList, serverList, closeList } from '../components/index.js'
import lodash from 'lodash'

let keys = lodash.map(Config.getCfgSchemaMap(), (i) => i.key)
let sysCfgReg = new RegExp(`^#ws设置\\s*(${keys.join('|')})?\\s*(.*)$`)

export class setting extends plugin {
    constructor() {
        super({
            name: '[ws-plugin] 设置',
            dsc: '[ws-plugin] 设置',
            event: 'message',
            priority: 1,
            rule: [
                {
                    reg: '^#ws(添加|删除|打开|关闭|重新|查看)连接.*$',
                    fnc: 'modifyWs',
                    permission: 'master'
                },
                {
                    reg: '^#ws连接说明$',
                    fnc: 'help',
                    permission: 'master'
                },
                {
                    reg: sysCfgReg,
                    fnc: 'setting',
                    permission: 'master'
                }
            ]
        })
    }

    async modifyWs() {
        let reg = new RegExp('^#ws(添加|删除|打开|关闭|重新|查看)连接(.*)$')
        let regRet = reg.exec(this.e.msg)
        if (!regRet) {
            return true
        }
        switch (regRet[1]) {
            case '添加':
                if (regRet[2]) {
                    let msg = regRet[2].split(/,|，/g)
                    await this.addWs(msg)
                } else {
                    this.setContext('checkAddWs', this.e.isGroup)
                    await this.reply([
                        '请一次性发送以下参数:\n',
                        '-----------------------\n',
                        '连接名字,连接地址,连接类型,重连间隔,最大重连次数,access-token(没有可不加)\n',
                        '-----------------------\n',
                        '用逗号分割,例如:\nNoneBot2,ws://127.0.0.1:8080/onebot/v11/ws,1,5,0\n',
                        '如果对参数不懂意思,可以发送#ws连接说明'
                    ])
                }
                break
            case '删除':
                if (regRet[2]) {
                    await this.delWs(regRet[2])
                } else {
                    this.setContext('checkDelWs', this.e.isGroup)
                    await this.reply('请继续发送需要删除的ws连接名字')
                }
                break
            case '打开':
                if (regRet[2]) {
                    await this.openWs(regRet[2])
                } else {
                    this.setContext('checkOpenWs', this.e.isGroup)
                    this.reply('请继续发送需要打开的ws连接名字')
                }
                break
            case '关闭':
                if (regRet[2]) {
                    await this.closeWs(regRet[2])
                } else {
                    this.setContext('checkCloseWs', this.e.isGroup)
                    this.reply('请继续发送需要关闭的ws连接名字')
                }
                break
            case '重新':
                this.reset()
                break
            case '查看':
                this.view()
                break
            default:
                break
        }
    }

    async setting(e) {
        let cfgReg = sysCfgReg
        let regRet = cfgReg.exec(e.msg)
        let cfgSchemaMap = Config.getCfgSchemaMap()
        if (!regRet) {
            return true
        }

        if (regRet[1]) {
            // 设置模式
            let val = regRet[2] || ''

            let cfgSchema = cfgSchemaMap[regRet[1]]
            if (cfgSchema.input) {
                val = cfgSchema.input(val)
            } else {
                val = cfgSchema.type === 'num' ? (val * 1 || cfgSchema.def) : !/关闭/.test(val)
            }
            Config.modify(cfgSchema.fileName, cfgSchema.cfgKey, val)
        }

        let schema = Config.getCfgSchema()
        let cfg = Config.getCfg()
        let imgPlus = false

        // 渲染图像
        return await Render.render('admin/index', {
            schema,
            cfg,
            imgPlus,
            isMiao: Version.isMiao
        }, { e, scale: 1.4 })
    }

    async addWs(msg) {
        if (msg.length != 5 && msg.length != 6) {
            await this.reply('格式有误,请检查后重新发送')
            return false
        } else {
            let value = {
                name: msg[0],
                address: msg[1],
                type: msg[2],
                reconnectInterval: msg[3],
                maxReconnectAttempts: msg[4],
            }
            if (msg[5]) {
                value.accessToken = msg[5]
            }
            let old = Config.servers
            if (Array.isArray(old) && old.length > 0) {
                for (const item of old) {
                    if (item.name == value.name) {
                        this.reply(`已经有连接名为${value.name}的连接了\n连接地址为${item.address}\n请删除旧的连接或更改连接名字`)
                        return false
                    } else if (item.address == value.address) {
                        this.reply(`已经有连接地址为${value.address}的连接了\n连接名字为${item.name}\n请删除旧的连接或更改连接地址`)
                        return false
                    }
                }
            }
            try {
                Config.modifyarr('ws-config', 'servers', value)
                this.reply('操作成功~')
            } catch (error) {
                logger.error(error)
                this.reply('操作失败~')
            }
            return true
        }
    }

    async openWs(msg) {
        let servers = Config.servers
        let target = null
        for (let i = 0; i < servers.length; i++) {
            if (servers[i].name == msg) {
                servers[i].close = false
                target = servers[i]
                break
            }
        }
        if (!target) {
            this.reply(`没有连接名字为${msg}的连接`)
            return true
        } else {
            try {
                Config.modify('ws-config', 'servers', servers)
                this.reply('操作成功~')
                return true
            } catch (error) {
                logger.error(error)
                this.reply('操作失败~')
                return true
            }
        }
    }

    async closeWs(msg) {
        let servers = Config.servers
        let target = null
        for (let i = 0; i < servers.length; i++) {
            if (servers[i].name == msg) {
                servers[i].close = true
                target = servers[i]
                break
            }
        }
        if (!target) {
            this.reply(`没有连接名字为${msg}的连接`)
            return true
        } else {
            try {
                Config.modify('ws-config', 'servers', servers)
                this.reply('操作成功~')
                return true
            } catch (error) {
                logger.error(error)
                this.reply('操作失败~')
                return true
            }
        }
    }

    async checkOpenWs() {
        if (!this.e.msg) {
            return false
        }
        let msg = this.e.msg
        await this.openWs(msg)
        this.finish('checkOpenWs', this.e.isGroup)
    }

    async checkCloseWs() {
        if (!this.e.msg) {
            return false
        }
        let msg = this.e.msg
        await this.closeWs(msg)
        this.finish('checkCloseWs', this.e.isGroup)
    }

    async delWs(msg) {
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
    }

    async help() {
        await this.reply([
            'ws连接说明:\n',
            '1.连接名字:一般代表需要连接的bot名字\n',
            '2.连接地址:需要连接的ws地址或者本地开启的地址:端口\n',
            '3.连接类型:1.反向ws连接 2.正向ws连接 3.gsuid_core专用连接\n',
            '4.重连间隔:连接被断开之后每隔一段时间进行重新连接,单位秒,0代表不重连\n',
            '5.最大重连次数:每次连接失败时+1,达到最大重连次数时停止重新连接,0代表一直重连\n',
            '6.access-token:访问密钥'
        ])
        return true
    }

    async checkAddWs() {
        if (!this.e.msg) {
            return false
        }
        let msg = this.e.msg
        if (msg == '#ws连接说明') {
            await this.help()
            this.setContext('checkAddWs', this.e.isGroup)
            return false
        }
        msg = msg.split(/,|，/g)
        await this.addWs(msg)
        this.finish('checkAddWs', this.e.isGroup)
        return false
    }

    async checkDelWs() {
        if (!this.e.msg) {
            return false
        }
        let msg = this.e.msg
        await this.delWs(msg)
        this.finish('checkDelWs', this.e.isGroup)
    }

    async reset() {
        clearWebSocket()
        initWebSocket(Config.servers)
        this.reply('操作成功~')
        return true
    }

    async view() {
        let servers = Config.servers
        let msg = []
        let status = []
        if (socketList.length != 0) {
            socketList.forEach(item => {
                status.push({
                    name: item.name,
                    state: item.readyState
                })
            })
        }
        if (closeList.length != 0) {
            closeList.forEach(item => {
                status.push({
                    name: item.name,
                    state: '断线重连中...'
                })
            })
        }
        if (serverList.length != 0) {
            serverList.forEach(item => {
                status.push({
                    name: item.name,
                    state: '运行中'
                })
            })
        }
        if (Array.isArray(servers)) {
            servers.forEach(item => {
                if (msg.length != 0) {
                    msg.push('\n----------------\n')
                }
                let statu = null
                if (item.close) {
                    statu = '已关闭连接'
                } else {
                    for (let i = 0; i < status.length; i++) {
                        if (status[i].name == item.name) {
                            if (status[i].state == 1) {
                                statu = '正常'
                            } else {
                                statu = status[i].state
                            }
                        }
                    }
                }
                msg.push(`连接名字: ${item.name}\n连接类型: ${item.type}\n当前状态: ${statu}`)
                if (!this.e.isGroup) {
                    msg.push(`\n连接地址: ${item.address}`)
                }
            })
        }
        if (msg.length > 0) {
            await this.reply(msg)
        } else {
            await this.reply('暂无连接')
        }
        return true
    }
}
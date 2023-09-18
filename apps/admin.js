import plugin from '../../../lib/plugins/plugin.js'
import { Config, clearWebSocket, initWebSocket, Render, Version, socketList } from '../components/index.js'
import lodash from 'lodash'

let keys = lodash.map(Config.getCfgSchemaMap(), (i) => i.key)
let sysCfgReg = new RegExp(`^#ws设置\\s*(${keys.join('|')})?\\s*(.*)$`)
const groupReg = '^#ws(查看|删除|添加)?(禁用|启用)群([0-9]*)$'

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
                },
                {
                    reg: groupReg,
                    fnc: 'modifyGroup',
                    permission: 'master'
                }
            ]
        })
    }

    async modifyGroup() {
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
                    break;
                case '删除':
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
                    break;
                case '添加':
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
                default:
                    break;
            }
        } else {
            let isExist = false
            switch (type) {
                case '禁用':
                    // 先看白名单有没有这个群
                    if (Array.isArray(cfg['yesGroup']) && cfg['yesGroup'].length > 0) {
                        for (const i of cfg['yesGroup']) {
                            if (i == group_id) {
                                isExist = true
                            }
                        }
                    }
                    // 如果在白名单中则删除白名单
                    if (isExist) {
                        cfg['yesGroup'] = cfg['yesGroup'].filter(i => i != group_id)
                        sendMsg.push(`操作成功~从白名单中删除了[${group_id}]!\n当前白名单列表:\n`)
                        sendMsg.push(cfg['yesGroup'].join('\n'))
                    }
                    // 否则添加为黑名单 
                    else {
                        // 再看看黑名单有没有这个群
                        if (Array.isArray(cfg['noGroup']) && cfg['noGroup'].length > 0) {
                            for (const item of cfg['noGroup']) {
                                if (item == group_id) {
                                    isExist = true
                                    break
                                }
                            }
                        } else {
                            cfg['noGroup'] = []
                        }
                        if (isExist) {
                            sendMsg.push(`操作失败~黑名单中已经添加了[${group_id}]\n当前黑名单列表:\n`)
                            sendMsg.push(cfg['noGroup'].join('\n'))
                        } else {
                            cfg['noGroup'].push(group_id)
                            sendMsg.push(`操作成功~向黑名单中添加了[${group_id}]!\n当前黑名单列表:\n`)
                            sendMsg.push(cfg['noGroup'].join('\n'))
                        }
                    }
                    break
                case '启用':
                    // 先看黑名单有没有这个群
                    if (Array.isArray(cfg['noGroup']) && cfg['noGroup'].length > 0) {
                        for (const item of cfg['noGroup']) {
                            if (item == group_id) {
                                isExist = true
                                break
                            }
                        }
                    } else {
                        cfg['noGroup'] = []
                    }
                    // 如果在黑名单中则删除黑名单
                    if (isExist) {
                        cfg['noGroup'] = cfg['noGroup'].filter(i => i != group_id)
                        sendMsg.push(`操作成功~从黑名单中删除了[${group_id}]!\n当前黑名单列表:\n`)
                        sendMsg.push(cfg['noGroup'].join('\n'))
                    }
                    // 否则添加为黑名单 
                    else {
                        // 再看看白名单有没有这个群
                        if (Array.isArray(cfg['yesGroup']) && cfg['yesGroup'].length > 0) {
                            for (const item of cfg['yesGroup']) {
                                if (item == group_id) {
                                    isExist = true
                                    break
                                }
                            }
                        } else {
                            cfg['yesGroup'] = []
                        }
                        if (isExist) {
                            sendMsg.push(`操作失败~白名单中已经添加了[${group_id}]\n当前白名单列表:\n`)
                            sendMsg.push(cfg['yesGroup'].join('\n'))
                        } else {
                            cfg['yesGroup'].push(group_id)
                            sendMsg.push(`操作成功~向白名单中添加了[${group_id}]!\n当前白名单列表:\n`)
                            sendMsg.push(cfg['yesGroup'].join('\n'))
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

    async modifyWs() {
        let reg = new RegExp('^#ws(添加|删除|打开|关闭|重新|查看)连接(.*)$')
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
                this.setContext('checkAddWs', this.e.isGroup)
                await this.reply([
                    '请输入以下参数,用逗号分割\n',
                    '---------------------------------\n',
                    '连接名字,连接类型\n',
                    '---------------------------------\n',
                    '连接名字: 用来区分每个连接\n',
                    '连接类型: 1:反向ws连接 2:正向ws连接 3:gscore连接 4:qqnt连接'
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

    async checkAddWs() {
        if (!this.e.msg) {
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
            this.finish('checkAddWs', this.e.isGroup)
            return false
        }
        if (addWsMsg.length == 2) {
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
                    this.setContext('checkAddWs', this.e.isGroup)
                    await redis.setEx('ws-plugin:addWs:' + this.e.user_id, 120, JSON.stringify(addWsMsg))
                    break;
                case '2':
                    await this.reply([
                        '请继续发送以下参数,用逗号分割\n',
                        '---------------------------------\n',
                        '连接地址,access-token(默认空)\n',
                        '---------------------------------\n',
                        '连接地址: 需要启动的ws地址,比如127.0.0.1:8080\n',
                        'access-token: 访问秘钥'
                    ])
                    this.setContext('checkAddWs', this.e.isGroup)
                    await redis.setEx('ws-plugin:addWs:' + this.e.user_id, 120, JSON.stringify(addWsMsg))
                    break;
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
                    this.setContext('checkAddWs', this.e.isGroup)
                    await redis.setEx('ws-plugin:addWs:' + this.e.user_id, 120, JSON.stringify(addWsMsg))
                    break;
                case '4':
                    await this.reply([
                        '请继续发送以下参数,用逗号分割\n',
                        '---------------------------------\n',
                        '连接地址,Token(为空尝试自动获取),重连间隔(默认5),最大重连次数(默认0)\n',
                        '---------------------------------\n',
                        '连接地址: Host:Port,比如127.0.0.1:16530\n',
                        'Token: Chronocat 连接 Token',
                        '重连间隔: 断开连接时每隔多少秒进行重新连接\n',
                        '最大重连次数: 达到这个数之后不进行重连,为0时会不断重连',
                    ])
                    this.setContext('checkAddWs', this.e.isGroup)
                    await redis.setEx('ws-plugin:addWs:' + this.e.user_id, 120, JSON.stringify(addWsMsg))
                    break;
                default:
                    await this.reply('格式有误,请检查后重新发送#ws添加连接')
                    this.finish('checkAddWs', this.e.isGroup)
                    await redis.del('ws-plugin:addWs:' + this.e.user_id)
                    break;
            }
        } else {
            const config = {
                name: addWsMsg[0],
                address: addWsMsg[2],
                type: addWsMsg[1],
            }
            switch (addWsMsg[1]) {
                case '1':
                case '3':
                    config['reconnectInterval'] = addWsMsg[3] || '5'
                    config['maxReconnectAttempts'] = addWsMsg[4] || '0'
                    config['accessToken'] = addWsMsg[5]
                    break;
                case '4':
                    config['accessToken'] = addWsMsg[3]
                    config['reconnectInterval'] = addWsMsg[4] || '5'
                    config['maxReconnectAttempts'] = addWsMsg[5] || '0'
                    break
                case '2':
                    config['accessToken'] = addWsMsg[3]
                    break
                default:
                    break;
            }
            config.uin = this.self_id
            await this.addWs(config)
            this.finish('checkAddWs', this.e.isGroup)
            await redis.del('ws-plugin:addWs:' + this.e.user_id)
        }
        return false
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

    async addWs(msg) {
        if (Array.isArray(msg) && msg.length != 5 && msg.length != 6) {
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
                    maxReconnectAttempts: msg[4],
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
        for (let i = 0; i < servers.length; i++) {
            if (servers[i].name == msg) {
                servers[i].close = false
                try {
                    Config.setArr('ws-config', 'servers', i, servers[i])
                    this.reply('操作成功~')
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

    async closeWs(msg) {
        let servers = Config.servers
        for (let i = 0; i < servers.length; i++) {
            if (servers[i].name == msg) {
                servers[i].close = true
                try {
                    Config.setArr('ws-config', 'servers', i, servers[i])
                    this.reply('操作成功~')
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
        for (let i = 0; i < servers.length; i++) {
            if (servers[i].name == msg) {
                try {
                    Config.delServersArr(servers[i].name)
                    this.reply('操作成功~')
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
        initWebSocket()
        this.reply('操作成功~')
        return true
    }

    async view() {
        const msg = []
        for (const i of Config.servers) {
            if (msg.length != 0) msg.push('\n----------------\n')
            let status = '已关闭连接'
            for (const s of socketList) {
                if (s.name == i.name) {
                    switch (s.status) {
                        case 0:
                            status = '已关闭连接'
                            break;
                        case 1:
                            if (s.type == 2) {
                                status = '运行中'
                            } else {
                                status = '已连接'
                            }
                            break
                        case 3:
                            if (s.type == 2) {
                                status = '已停止运行'
                            } else {
                                status = '断线重连中'
                            }
                            break
                        default:
                            break;
                    }
                }
            }
            msg.push(`连接名字: ${i.name}\n连接类型: ${i.type}\n当前状态: ${status}`)
        }
        if (msg.length > 0) {
            await this.reply(msg)
        } else {
            await this.reply('暂无连接')
        }
        return true
    }
}
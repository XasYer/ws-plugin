import { socketList, Config } from '../../components/index.js'
import { makeOneBotReportMsg, makeGSUidReportMsg } from '../../model/index.js'
import _ from 'lodash'
import cfg from '../../../../lib/config/config.js'

Bot.on('message', async e => {
    //如果没有已连接的Websocket
    if (socketList.length == 0) {
        return false
    }
    //判断是否启用
    let groupList = Config.noGroup
    if (Array.isArray(groupList) && groupList.length > 0) {
        if (groupList.some(item => item == e.group_id)) return false
    }
    //判断前缀
    if (e.message[0].type === 'text') {
        if (Array.isArray(Config.noMsgStart) && Config.noMsgStart.length > 0) {
            if (Config.noMsgStart.some(item => e.message[0].text.startsWith(item))) {
                return false
            }
        }
    }
    //深拷贝e
    let msg = _.cloneDeep(e);
    //增加isGroup e.isPrivate
    if (msg.message_type == 'group') {
        msg.isGroup = true
    } else if (msg.message_type == 'private') {
        msg.isPrivate = true
    } else {
        return false
    }
    msg = onlyReplyAt(msg)
    if (!msg) {
        return false
    }
    socketList.forEach(async socket => {
        if (Number(socket.type) != 3) {
            await SendOneBotMsg(socket, msg)
        } else {
            await SendGSUidMsg(socket, msg)
        }
    })
})

async function SendOneBotMsg(socket, e) {
    let Message = await makeOneBotReportMsg(e)
    if (!Message) {
        return
    }
    socket.send(Message)
}

async function SendGSUidMsg(socket, e) {
    let bytes = await makeGSUidReportMsg(e)
    if (!bytes) {
        return
    }
    socket.send(bytes)
}

function onlyReplyAt(e) {
    if (!e.message) return false

    let groupCfg = cfg.getGroup(e.group_id)
    if (groupCfg.onlyReplyAt != 1 || !groupCfg.botAlias || e.isPrivate) return e

    let at = atBot(e.message)
    if (at) return e
    e = hasAlias(e)
    if (e) return e

    return false
}

function atBot(msg) {
    if (!msg) return false
    for (let i = 0; i < msg.length; i++) {
        if (msg[i].type === 'at') {
            if (msg[i].qq == Bot.uin) {
                return true
            }
        }
    }
    return false
}

function hasAlias(e) {
    if (!e.message) return false
    if (e.message[0].type === 'text') {
        if (e.isGroup) {
            let groupCfg = cfg.getGroup(e.group_id)
            let alias = groupCfg.botAlias
            if (!Array.isArray(alias)) {
                alias = [alias]
            }
            for (let name of alias) {
                if (e.message[0].text.startsWith(name)) {
                    e.message[0].text = _.trimStart(e.message[0].text, name).trim()
                    return e
                }
            }
        }
    }
    return false
}
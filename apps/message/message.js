import { sendSocketList, Config, Version } from '../../components/index.js'
import { makeOneBotReportMsg, makeGSUidReportMsg, setGuildLatestMsgId, setQQBotLateseReply, setMsg, getGroup_id, getUser_id } from '../../model/index.js'
import _ from 'lodash'
import cfg from '../../../../lib/config/config.js'


Bot.on('message', async e => {
    // 被禁言或者全体禁言
    if (Config.muteStop && (e.group?.mute_left > 0 || e.group?.all_muted)) return false
    // 如果没有已连接的Websocket
    if (sendSocketList.length == 0) return false
    if (e.group_id) {
        // 判断云崽白名单群
        const whiteGroup = Config.whiteGroup
        if (Array.isArray(whiteGroup) && whiteGroup.length > 0) {
            if (!whiteGroup.some(i => i == e.group_id)) return false
        }
        // 判断插件白名单群
        const yesGroup = Config.yesGroup
        if (Array.isArray(yesGroup) && yesGroup.length > 0) {
            if (!yesGroup.some(i => i == e.group_id)) return false
        }
        // 判断云崽黑名单群
        const blackGroup = Config.blackGroup
        if (Array.isArray(blackGroup) && blackGroup.length > 0) {
            if (blackGroup.some(i => i == e.group_id)) return false
        }
        // 判断插件黑名单群
        const noGroup = Config.noGroup
        if (Array.isArray(noGroup) && noGroup.length > 0) {
            if (noGroup.some(i => i == e.group_id)) return false
        }
    }
    // 判断云崽黑名单QQ
    if (e.user_id && Array.isArray(Config.blackQQ)) {
        if (Config.blackQQ.some(i => i == e.user_id)) return false
    }
    // 判断插件前缀
    if (Array.isArray(Config.noMsgStart) && Config.noMsgStart.length > 0) {
        if (e.message?.[0]?.type === 'text') {
            if (Config.noMsgStart.some(i => e.message[0].text.startsWith(i))) return false
        }
    }
    let isMaster = e.isMaster
    if (Version.isTrss) {
        if (e.user_id && cfg.master[e.self_id]?.includes(String(e.user_id))) {
            isMaster = true
        }
    }
    const message_id = Math.floor(Math.random() * Math.pow(2, 32)) | 0
    const self_id = await getUser_id({ user_id: e.self_id })
    const user_id = await getUser_id({ user_id: e.user_id })
    const time = (new Date(e.time)).getTime() || Date.now() / 1000
    let msg = {
        time: e.time,
        message_id: e.message_id,
        message: _.cloneDeep(e.message),
        rand: e.rand,
        seq: e.seq,
        source: e.source,
        user_id: e.user_id,
        self_id: e.self_id,
        isMaster,
        sender: e.sender,
        param: {
            time,
            self_id,
            post_type: e.post_type,
            message_type: e.message_type,
            sub_type: e.sub_type || e.message_type == 'group' ? 'normal' : 'friend',
            message_id,
            user_id,
            font: 0,
            sender: {
                user_id,
                nickname: e.sender.nickname,
                card: e.sender.card,
                sex: e.sender.sex || 'unknown',
                role: e.sender.role || 'member'
            },
        }
    }
    if (e.guild_id) {
        setGuildLatestMsgId(e.message_id, e.group_id || e.user_id)
    } else if (e.bot?.adapter?.id === 'QQBot') {
        setQQBotLateseReply(e.reply, e.group_id || e.user_id)
    }
    let userInfo
    //增加isGroup e.isPrivate
    if (e.message_type == 'group') {
        msg.isGroup = true
        const group_id = await getGroup_id({ group_id: e.group_id })
        msg.group_id = e.group_id
        msg.param.group_id = group_id
        userInfo = await e.bot.pickMember(e.group_id, e.user_id)
    } else if (e.message_type == 'private') {
        userInfo = await e.bot.pickFriend(e.user_id)
        msg.isPrivate = true
    } else {
        return false
    }
    const avatar = await userInfo?.getAvatarUrl?.()
    if (avatar) msg.param.avatar = avatar
    // 判断云崽前缀
    msg = onlyReplyAt(msg)
    if (!msg) return false
    for (const i of sendSocketList) {
        logger.debug('[ws-plugin]', i.name, 'status', i.status, 'type', i.type, 'uin', i.uin, 'self_id', i.self_id)
        logger.debug('[ws-plugin]', 'source', JSON.stringify(msg.source))
        if (i.status == 1) {
            let reportMsg = null
            switch (Number(i.type)) {
                case 1:
                case 2:
                case 6:
                    if (Version.isTrss || e.adapter) {
                        if (i.uin != e.self_id) continue
                    }
                    e.reply = reply(e)
                    msg.messagePostFormat = i.other?.messagePostFormat || Config.messagePostFormat
                    reportMsg = await makeOneBotReportMsg(msg)
                    break;
                case 3:
                    reportMsg = await makeGSUidReportMsg(msg)
                    break
                default:
                    break;
            }
            if (reportMsg) i.ws.send(reportMsg)
        }
    }
})

function reply(e) {
    if (!Version.isTrss) {
        const replyNew = e.reply
        return async function () {
            const ret = await replyNew.apply(this, arguments)
            if (ret) {
                setMsg({
                    message_id: ret.message_id,
                    time: ret.time,
                    seq: ret.seq,
                    rand: ret.rand,
                    user_id: e.user_id,
                    group_id: e.group_id,
                    onebot_id: Math.floor(Math.random() * Math.pow(2, 32)) | 0,
                })
            }
            return ret
        }
    } else {
        if (e.bot?.version?.name == 'ICQQ') {
            return async function (massage, quote = false) {
                let ret
                if (e.isGroup) {
                    if (e.group?.sendMsg) {
                        ret = await e.group.sendMsg(massage, quote)
                    } else {
                        ret = await e.bot.pickGroup(e.group_id).sendMsg(massage, quote)
                    }
                } else {
                    if (e.friend?.sendMsg) {
                        ret = await e.friend.sendMsg(massage, quote)
                    } else {
                        ret = await e.bot.pickFriend(e.user_id).sendMsg(massage, quote)
                    }
                }
                if (ret) {
                    setMsg({
                        message_id: ret.message_id,
                        time: ret.time,
                        seq: ret.seq,
                        rand: ret.rand,
                        user_id: e.user_id,
                        group_id: e.group_id,
                        onebot_id: Math.floor(Math.random() * Math.pow(2, 32)) | 0,
                    })
                }
                return ret
            }
        }
        // 暂时先不处理其他协议
        return e.reply
    }
}

function onlyReplyAt(e) {
    if (!e.message) return false

    let groupCfg = Version.isTrss ? cfg.getGroup(e.self_id, e.group_id) : cfg.getGroup(e.group_id)
    if (groupCfg.onlyReplyAt != 1 || !groupCfg.botAlias || e.isPrivate) return e

    let at = atBot(e)
    if (at) return e
    e = hasAlias(e, groupCfg)
    if (e) return e

    return false
}

function atBot(e) {
    for (const i of e.message) {
        if (i.type === 'at') {
            if (i.qq == e.self_id) return true
        }
    }
    return false
}

function hasAlias(e, groupCfg) {
    if (e.message[0].type === 'text') {
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
    return false
}
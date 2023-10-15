import { sendSocketList, Config, Version } from '../../components/index.js'
import { makeOneBotReportMsg, makeGSUidReportMsg, setGuildLatestMsgId, setMsgMap } from '../../model/index.js'
import _ from 'lodash'
import cfg from '../../../../lib/config/config.js'


Bot.on('message', async e => {
    if (e.self_id == '88888'){
        if (e.group?.bot?.uin) {
            e.self_id = e.group.bot.uin
        } else if (e.friend?.bot?.uin) {
            e.self_id = e.friend.bot.uin
        }
    }
    // 被禁言或者全体禁言
    if (Config.muteStop && (e.group?.mute_left > 0 || e.group?.all_muted)) return false
    // 如果没有已连接的Websocket
    if (sendSocketList.length == 0) return false
    if (e.group_id) {
        // 判断云崽白名单
        const whiteGroup = Config.whiteGroup
        if (Array.isArray(whiteGroup) && whiteGroup.length > 0) {
            if (!whiteGroup.some(i => i == e.group_id)) return false
        }
        // 判断插件白名单
        const yesGroup = Config.yesGroup
        if (Array.isArray(yesGroup) && yesGroup.length > 0) {
            if (!yesGroup.some(i => i == e.group_id)) return false
        }
        // 判断云崽黑名单
        const blackGroup = Config.blackGroup
        if (Array.isArray(blackGroup) && blackGroup.length > 0) {
            if (blackGroup.some(i => i == e.group_id)) return false
        }
        // 判断插件黑名单
        const noGroup = Config.noGroup
        if (Array.isArray(noGroup) && noGroup.length > 0) {
            if (noGroup.some(i => i == e.group_id)) return false
        }
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
            time: e.time,
            self_id: e.self_id,
            post_type: e.post_type,
            message_type: e.message_type,
            sub_type: e.sub_type,
            message_id,
            user_id: e.user_id,
            font: 0,
            sender: e.sender,
            anonymous: e.anonymous ? {
                id: e.anonymous.id,
                name: e.anonymous.name,
                flag: e.anonymous.flag
            } : null
        }
    }
    let message = []
    //增加isGroup e.isPrivate
    if (e.guild_id) {
        setGuildLatestMsgId(e.message_id)
        //处理成message
        if (e.content) {
            let content = toMsg(e.content)
            message.push(...content)
        }
        if (e.attachments) {
            e.attachments.forEach(i => {
                if (i.content_type.startsWith('image')) {
                    message.push({
                        type: 'image',
                        file: i.filename,
                        url: i.url
                    })
                }
            })
        }
        msg.message = message

        msg.isGuild = true
        msg.param = {
            time: Math.floor(new Date(msg.timestamp).getTime() / 1000),
            post_type: 'message',
            message_type: 'guild',
            sub_type: 'channel',
            guild_id: e.guild_id,
            channel_id: e.channel_id,
            user_id: e.author.id,
            message_id: e.message_id,
            self_id: e.bot.appID,
            sender: {
                user_id: e.author.id,
                nickname: e.author.username,
                tiny_id: e.author.id,
            },
            self_tiny_id: e.bot.appID,
        }
    } else if (e.message_type == 'group') {
        msg.isGroup = true
        msg.group_id = e.group_id
        msg.param.group_id = e.group_id
        msg.self_id = e.group?.bot?.uin || msg.self_id
    } else if (e.message_type == 'private') {
        msg.isPrivate = true
        msg.self_id = e.friend?.bot?.uin || msg.self_id
    } else {
        return false
    }
    // 判断云崽前缀
    msg = onlyReplyAt(msg)
    if (!msg) return false
    for (const i of sendSocketList) {
        if (i.status == 1) {
            let reportMsg = null
            switch (Number(i.type)) {
                case 1:
                case 2:
                case 6:
                    if (Version.isTrss) {
                        if (i.uin != e.self_id) continue
                        if (!Version.protocol.some(i => i == e.bot?.version?.name)) continue
                    }
                    e.reply = reply(e)
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
        return async function (massage, quote = false, data = {}) {
            const ret = await replyNew(massage, quote, data)
            if (ret) {
                setMsgMap({
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
                    setMsgMap({
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

function toMsg(content) {
    const regex = /<@!(\d+)>|<emoji:(\d+)>|([^<]+)/g;
    let match;
    const result = [];
    while ((match = regex.exec(content)) !== null) {
        if (match[1]) {
            result.push({
                type: 'at',
                qq: match[1]
            });
        } else if (match[2]) {
            result.push({
                type: 'face',
                id: parseInt(match[2])
            });
        } else if (match[3]) {
            result.push({
                type: 'text',
                text: match[3]
            });
        }
    }
    return result;
}
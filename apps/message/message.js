import { socketList, Config, Version } from '../../components/index.js'
import { makeOneBotReportMsg, makeGSUidReportMsg, setGuildLatestMsgId, setMsgMap } from '../../model/index.js'
import _ from 'lodash'
import cfg from '../../../../lib/config/config.js'


Bot.on('message', async e => {
    // console.log(e);
    // 如果没有已连接的Websocket
    if (socketList.length == 0) return false
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
        } else {
            return false
        }
    }
    if (e.reply) {
        const _reply = e.reply
        e.reply = async function (massage, quote = false, data = {}) {
            const ret = await _reply(massage, quote, data)
            if (ret) {
                await setMsgMap(ret.rand, {
                    message_id: ret.message_id,
                    time: ret.time,
                    seq: ret.seq,
                    rand: ret.rand,
                })
            }
            return ret
        }
    }
    //深拷贝e
    let msg = _.cloneDeep(e);
    let message = []
    if (Version.isTrss) {
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
        // return false
    }
    //增加isGroup e.isPrivate
    if (msg.guild_id) {
        msg.isGuild = true
        msg.param = {
            time: Math.floor(new Date(msg.timestamp).getTime() / 1000),
            post_type: 'message',
            message_type: 'guild',
            sub_type: 'channel',
            guild_id: msg.guild_id,
            channel_id: msg.channel_id,
            user_id: msg.author.id,
            message_id: msg.message_id,
            self_id: msg.bot.appID,
            sender: {
                user_id: msg.author.id,
                nickname: msg.author.username,
                tiny_id: msg.author.id,
            },
            self_tiny_id: msg.bot.appID,
        }
    } else if (msg.message_type == 'group') {
        msg.isGroup = true
        msg.param = {
            time: e.time,
            self_id: e.self_id,
            post_type: e.post_type,         // 'message'
            message_type: e.message_type,   // 'group'
            sub_type: e.sub_type,           // 'normal' 'anonymous' 'notice'
            message_id: e.rand,
            group_id: e.group_id,
            user_id: e.user_id,
            font: 0,
            sender: e.sender,               // 'user_id' 'nickname'
            anonymous: e.anonymous ? {
                id: e.anonymous.id,
                name: e.anonymous.name,
                flag: e.anonymous.flag
            } : null
        }
    } else if (msg.message_type == 'private') {
        msg.isPrivate = true
        msg.param = {
            time: e.time,
            self_id: e.self_id,
            post_type: e.post_type,         // 'message'
            message_type: e.message_type,   // 'private'
            sub_type: e.sub_type,           // 'friend' 'group' 'other'
            message_id: e.rand,
            group_id: e.group_id,
            user_id: e.user_id,
            font: 0,
            sender: e.sender                // 'user_id' 'nickname'
        }
    } else {
        return false
    }
    // 判断云崽前缀
    msg = onlyReplyAt(msg)
    if (!msg) return false
    socketList.forEach(async i => {
        if (i.status == 1) {
            let reportMsg = null
            switch (Number(i.type)) {
                case 1:
                case 2:
                    reportMsg = await makeOneBotReportMsg(msg)
                    break;
                case 3:
                    reportMsg = await makeGSUidReportMsg(msg)
                default:
                    break;
            }
            if (reportMsg) i.ws.send(reportMsg)
        }
    })
})

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
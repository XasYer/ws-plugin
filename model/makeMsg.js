import { Config } from '../components/index.js'
import { MsgToCQ, CQToMsg } from './CQCode.js'
import { getMsgMap, setMsgMap } from './msgMap.js'
import { SendMusicShare } from './tool.js'
import _ from 'lodash'
import cfg from '../../../lib/config/config.js'
import fetch from 'node-fetch'

/**
 * 制作OneBot上报消息
 * @param {*} e 
 * @returns 
 */
async function makeOneBotReportMsg(e) {
    let reportMsg = msgToOneBotMsg(e.message, e.source)

    if (!reportMsg) {
        return false
    }
    let raw_message = MsgToCQ(reportMsg)
    if (Config.messagePostFormat == 'string' || Config.messagePostFormat == '1') {
        reportMsg = raw_message
    }
    await setMsgMap(e.rand, {
        message_id: e.message_id,
        time: e.time,
        seq: e.seq,
        rand: e.rand,
    })
    let Message = {
        message: reportMsg,
        raw_message: raw_message,
        ...e.param
    }

    return JSON.stringify(Message)
}

/**
 * 制作gsuid_core上报消息
 * @param {*} e 
 * @returns 
 */
async function makeGSUidReportMsg(e) {
    let message = []
    let msg = e.message
    //前缀处理
    if (msg[0].type == 'text') {
        if (Config.noMsgStart.length > 0 && Array.isArray(Config.noMsgStart)) {
            if (Config.noMsgStart.some(item => e.msg.startsWith(item))) {
                return false
            }
        }
        if (e.isGroup) {
            let groupCfg = cfg.getGroup(e.group_id)
            let alias = groupCfg.botAlias
            if (!Array.isArray(alias)) {
                alias = [alias]
            }
            for (let name of alias) {
                if (msg[0].text.startsWith(name)) {
                    msg[0].text = _.trimStart(msg[0].text, name).trim()
                    break
                }
            }
        }
    }
    if (e.source) {
        message.push({
            type: "reply",
            data: e.message_id
        })
    }
    for (const i of msg) {
        switch (i.type) {
            case 'at':
                message.push({
                    type: 'at',
                    data: i.qq
                })
                break;
            case 'text':
                if (Config.noMsgInclude.length > 0 && Array.isArray(Config.noMsgInclude)) {
                    if (Config.noMsgInclude.some(item => i.text.includes(item))) {
                        return false
                    }
                }
                message.push({
                    type: 'text',
                    data: i.text
                })
                break;
            case 'image':
                message.push({
                    type: 'image',
                    data: i.url
                })
                break;
            case 'file':
                if (e.isGroup) continue
                let fileUrl = await e.friend.getFileUrl(e.file.fid);
                let res = await fetch(fileUrl);
                let arrayBuffer = await res.arrayBuffer();
                let buffer = Buffer.from(arrayBuffer);
                let base64 = buffer.toString('base64');
                let name = i.name
                message.push({
                    type: 'file',
                    data: `${name}|${base64}`
                })
                break;
            default:
                break;
        }
    }
    if (message.length == 0) {
        return false
    }
    let user_pm = 6
    if (e.isMaster) {
        user_pm = 1
    } else if (e.isGroup) {
        if (e.sender.role === 'owner') {
            user_pm = 2
        } else if (e.sender.role === 'admin') {
            user_pm = 3
        }
    }
    const MessageReceive = {
        bot_id: 'Yunzai_Bot',
        bot_self_id: e.self_id + "",
        msg_id: e.message_id,
        user_type: e.isGroup ? 'group' : 'direct',
        user_id: e.user_id + "",
        user_pm: user_pm,
        content: message
    };
    if (e.isGroup) {
        MessageReceive.group_id = e.group_id + ""
    }
    let data = JSON.stringify(MessageReceive)
    const encoder = new TextEncoder();
    const bytes = encoder.encode(data);
    return bytes
}

/**
 * 制作gsuid发送消息
 * @param {*} data 
 */
async function makeGSUidSendMsg(data) {
    let content = data.content, sendMsg = [], quote = null
    if (content[0].type.startsWith('log')) {
        logger.info(content[0].data);
    } else {
        let target = data.target_type == 'group' ? 'pickGroup' : 'pickFriend'
        for (const msg of content) {
            switch (msg.type) {
                case 'image':
                    sendMsg.push(segment.image(msg.data))
                    break;
                case 'text':
                    sendMsg.push(msg.data)
                    break;
                case 'at':
                    sendMsg.push(segment.at(Number(msg.data)))
                    break;
                case 'reply':
                    quote = await Bot.getMsg(msg.data)
                    break;
                case 'file':
                    let file = msg.data.split('|')
                    let buffer = Buffer.from(file[1], 'base64');
                    Bot.pickGroup(data.target_id).fs.upload(buffer, '/', file[0]);
                    break;
                case 'node':
                    let arr = []
                    for (const i of msg.data) {
                        const { sendMsg: message } = await makeGSUidSendMsg({ content: [i], target_type: data.target_type, target_id: data.target_id })
                        arr.push({
                            message,
                            nickname: '小助手',
                            user_id: 2854196310
                        })
                    }
                    sendMsg.push(await Bot[target](data.target_id).makeForwardMsg(arr))
                    break;
                default:
                    break;
            }
        }
    }
    return { sendMsg, quote }
}

/**
 * 制作onebot发送的消息
 * @param {*} params 
 * @returns sendMsg , quote
 */
async function makeSendMsg(params) {
    let msg = params.message
    if (typeof msg == 'string') msg = CQToMsg(msg)
    let target, uid, sendMsg = [], quote = null, node = null
    for (const i of msg) {
        switch (i.type) {
            case 'reply':
                quote = await getMsgMap(i.data.id)
                quote = await Bot.getMsg(quote.message_id)
                break
            case 'image':
                sendMsg.push(segment.image(decodeURIComponent(i.data.file)))
                break
            case 'text':
                sendMsg.push(i.data.text)
                break
            case 'at':
                let qq = i.data.qq + ''
                if (qq.length > 3) qq = Number(qq)
                sendMsg.push(segment.at(qq))
                break
            case 'video':
                sendMsg.push(segment.video(decodeURIComponent(i.data.file)))
                break
            case 'music':
                if (params.message_type == 'group') {
                    target = 'pickGroup'
                    uid = params.group_id
                } else {
                    target = 'pickFriend'
                    uid = params.user_id
                }
                if (i.data.type == 'custom') {
                    let data = i.data
                    data.message_type = params.message_type
                    data.user_id = params.user_id
                    data.group_id = params.group_id
                    await SendMusicShare(data)
                } else {
                    await Bot[target](uid).shareMusic(i.data.type, i.data.id)
                }
                break
            case 'poke':
                await Bot.pickGroup(params.group_id).pokeMember(Number(i.data.qq))
                break
            case 'record':
                sendMsg.push(segment.record(decodeURIComponent(i.data.file)))
                break
            case 'face':
                sendMsg.push(segment.face(i.data.id))
                break
            case 'node':
                if (node) {
                    node.messages.push({ data: i.data })
                } else {
                    node = {
                        ...params,
                        messages: [{ data: i.data }]
                    }
                }
                break
            case 'json':
                let json = i.data.data
                json = json.replace(/&#44;/g, ',')
                json = json.replace(/&amp;/g, '&')
                json = json.replace(/&#91;/g, '[')
                json = json.replace(/&#93;/g, ']')
                sendMsg.push(segment.json(json))
                break
            default:
                sendMsg.push(MsgToCQ([i]))
                logger.warn(`出现了未适配的消息的类型${JSON.stringify(i)}`)
                break
        }
    }
    if (node) {
        sendMsg.push(await makeForwardMsg(node))
    }
    return { sendMsg, quote }
}

/**
 * 制作合并转发的消息
 * @param {*} params 
 */
async function makeForwardMsg(params) {
    let forwardMsg = []
    for (const msg of params.messages) {
        if (typeof msg.data.content == 'string') {
            msg.data.content = [CQToMsg(msg.data.content)]
        }
        if (msg.data.content.type == 'image') {
            msg.data.content = [{
                type: 'image',
                data: {
                    file: msg.data.content.file || msg.data.content.data.file
                }
            }]
        }
        for (let i of msg.data.content) {
            if (!Array.isArray(i)) i = [i]
            const data = {
                ...params,
                message: i
            }
            let { sendMsg } = await makeSendMsg(data)
            forwardMsg.push({
                nickname: msg.data.name,
                user_id: Number(msg.data.uin),
                message: sendMsg
            })
        }
    }
    if (params.group_id) {
        forwardMsg = await Bot.pickGroup(params.group_id).makeForwardMsg(forwardMsg)
    } else if (params.user_id) {
        forwardMsg = await Bot.pickFriend(params.user_id).makeForwardMsg(forwardMsg)
    }
    return forwardMsg
}

/**
 * 转换成onebot消息
 * @returns 
 */
function msgToOneBotMsg(msg, source = null) {
    let reportMsg = []
    if (source) {
        reportMsg.push({
            "type": "reply",
            "data": {
                "id": source.rand
            }
        })
    }
    for (let i = 0; i < msg.length; i++) {
        switch (msg[i].type) {
            case 'at':
                reportMsg.push({
                    "type": "at",
                    "data": {
                        "qq": msg[i].qq
                    }
                })
                break
            case 'text':
                if (Array.isArray(Config.noMsgStart) && Config.noMsgInclude.length > 0) {
                    if (Config.noMsgInclude.some(item => msg[i].text.includes(item))) {
                        return false
                    }
                }
                reportMsg.push({
                    "type": "text",
                    "data": {
                        "text": msg[i].text
                    }
                })
                break
            case 'image':
                reportMsg.push({
                    "type": "image",
                    "data": {
                        file: msg[i].file,
                        subType: msg[i].asface ? 1 : 0,
                        url: msg[i].url
                    }
                })
                break
            case 'json':
                reportMsg.push({
                    "type": 'json',
                    "data": {
                        "data": msg[i].data
                    }
                })
                break
            case 'face':
                reportMsg.push({
                    'type': 'face',
                    'data': {
                        'id': msg[i].id
                    }
                })
                break
            case 'record':
                reportMsg.push({
                    'type': 'record',
                    'data': {
                        'file': msg[i].file
                    }
                })
                break
            default:
                break
        }
    }
    return reportMsg
}

export {
    makeOneBotReportMsg,
    makeGSUidReportMsg,
    makeSendMsg,
    makeForwardMsg,
    makeGSUidSendMsg,
    msgToOneBotMsg
}
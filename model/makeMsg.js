import { Config } from '../components/index.js'
import { MsgToCQ, CQToMsg } from './CQCode.js'
import { getMsgMap, setMsgMap } from './msgMap.js'
import _ from 'lodash'
import cfg from '../../../lib/config/config.js'
import fetch from 'node-fetch'

/**
 * 制作OneBot上报消息
 * @param {*} e 
 * @returns 
 */
async function makeOneBotReportMsg(e) {
    let reportMsg = []
    let msg = e.message
    //前缀处理
    if (msg[0].type == 'text') {
        if (Array.isArray(Config.noMsgStart) && Config.noMsgStart.length > 0) {
            if (Config.noMsgStart.some(item => msg[0].text.startsWith(item))) {
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
        reportMsg.push({
            "type": "reply",
            "data": {
                "id": e.source.rand
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
                        subType: 0,
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
    if (Config.messagePostFormat == 'string' || Config.messagePostFormat == '1') {
        reportMsg = MsgToCQ(reportMsg)
    }
    setMsgMap(e.rand, {
        time: e.time,
        message_type: e.message_type,
        message_id: e.rand,
        real_id: e.seq,
        sender: e.sender,
        message: e.message,
        message_string: e.message_id,
        group_id: e.group_id,
        user_id: e.user_id,
    })
    let Message = {
        time: e.time,
        self_id: e.self_id,
        post_type: e.post_type,
        message_type: e.message_type,
        sub_type: e.sub_type,
        message_id: e.rand,
        group_id: e.group_id || null,
        user_id: e.user_id,
        message: reportMsg,
        raw_message: e.raw_message,
        font: 1234,//onebot要求int类型,但是icqq获取的好像是string?就随便填了个
        sender: e.sender
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
    for (let i = 0; i < msg.length; i++) {
        if (msg[i].type == 'at') {
            message.push({
                type: 'at',
                data: msg[i].qq
            })
        } else if (msg[i].type == 'text') {
            if (Config.noMsgInclude.length > 0 && Array.isArray(Config.noMsgInclude)) {
                if (Config.noMsgInclude.some(item => msg[i].text.includes(item))) {
                    return false
                }
            }
            message.push({
                type: 'text',
                data: msg[i].text
            })
        } else if (msg[i].type == 'image') {
            message.push({
                type: 'image',
                data: msg[i].url
            })
        } else if (msg[i].type == 'file') {
            if (e.isGroup) {
                continue
            }
            let fileUrl = await e.friend.getFileUrl(e.file.fid);
            let res = await fetch(fileUrl);
            let arrayBuffer = await res.arrayBuffer();
            let buffer = Buffer.from(arrayBuffer);
            let base64 = buffer.toString('base64');
            let name = msg[i].name
            message.push({
                type: 'file',
                data: `${name}|${base64}`
            })
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
async function makeGSUidSendMsg(data, name) {
    let msg = data.content
    if (msg[0].type.startsWith('log')) {
        logger.info(msg[0].data);
    } else {
        let sendMsg = []
        let target = data.target_type == 'group' ? 'pickGroup' : 'pickFriend'
        for (let k = 0; k < msg.length; k++) {
            if (msg[k].type == 'image') {
                sendMsg.push(segment.image(msg[k].data))
            } else if (msg[k].type == 'text') {
                sendMsg.push(msg[k].data)
            } else if (msg[k].type == 'node') {
                for (let i = 0; i < msg[k].data.length; i++) {
                    let _sendMsg
                    if (msg[k].data[i].type == 'text') {
                        _sendMsg = msg[k].data[i].data
                    } else if (msg[k].data[i].type == 'image') {
                        _sendMsg = segment.image(msg[k].data[i].data)
                    }
                    sendMsg.push({
                        message: [
                            _sendMsg
                        ],
                        nickname: '小助手',
                        user_id: 2854196310
                    })
                }
                sendMsg.push(await Bot[target](data.target_id).makeForwardMsg(sendMsg))
            } else if (msg[k].type == 'file') {
                let file = msg[k].data.split('|')
                let buffer = Buffer.from(file[1], 'base64');
                Bot.pickGroup(data.target_id).fs.upload(buffer, '/', file[0]);
            }
        }
        if (sendMsg.length > 0 && Array.isArray(sendMsg)) {
            await Bot[target](data.target_id).sendMsg(sendMsg)
            logger.mark(`[ws-plugin] 连接名字:${name} 处理完成`)
        }
    }
}

/**
 * 制作需要发送的消息
 * @param {*} params 
 * @returns 
 */
async function makeSendMsg(params) {
    let msg = params.message
    let sendMsg = []
    let quote = null
    if (typeof msg == 'string') {
        msg = CQToMsg(msg)
    }
    // console.log('params', params);
    let target
    let uid
    for (let i = 0; i < msg.length; i++) {
        switch (msg[i].type) {
            case 'reply':
                quote = getMsgMap(msg[i].data.id)
                let seq
                if (quote.message_type == 'group') {
                    target = 'pickGroup'
                    uid = quote.group_id
                    seq = quote.seq
                } else {
                    target = 'pickFriend'
                    uid = quote.user_id
                    seq = quote.time
                }
                quote = (await Bot[target](uid).getChatHistory(seq, 1))[0]
                break
            case 'image':
                sendMsg.push(segment.image(msg[i].data.file))
                break
            case 'text':
                sendMsg.push(msg[i].data.text)
                break
            case 'at':
                sendMsg.push(segment.at(Number(msg[i].data.qq)))
                break
            case 'video':
                sendMsg.push(segment.video(decodeURIComponent(msg[i].data.file)))
                break
            case 'music':
                if (params.message_type == 'group') {
                    target = 'pickGroup'
                    uid = params.group_id
                } else {
                    target = 'pickFriend'
                    uid = params.user_id
                }
                if (msg[i].data.id) {
                    await Bot[target](uid).shareMusic(msg[i].data.type, msg[i].data.id)
                } else {
                    // TODO
                    logger.warn('不会分享自定义歌曲捏')
                }
                break
            case 'poke':
                await Bot.pickGroup(params.group_id).pokeMember(Number(msg[i].data.qq))
                break
            case 'record':
                sendMsg.push(segment.record(decodeURIComponent(msg[i].data.file)))
                break
            case 'face':
                sendMsg.push(segment.face(msg[i].data.id))
                break
            default:
                sendMsg.push('出现了未适配的消息的类型')
                logger.warn(`出现了未适配的消息的类型${msg[i]}`)
                break
        }
    }
    return [sendMsg, quote]
}

/**
 * 制作合并转发的消息
 * @param {*} params 
 */
async function makeForwardMsg(params) {
    let forwardMsg = []
    let msg = params.messages
    for (let i = 0; i < msg.length; i++) {
        let _msg = null
        if (typeof msg[i].data.content == 'string') {
            _msg = (await makeSendMsg({ message: msg[i].data.content }))[0]
        } else if (msg[i].data.content.type == 'image') {
            _msg = segment.image(msg[i].data.content.data.file)
        } else if (Array.isArray(msg[i].data.content)) {
            _msg = []
            for (let j = 0; j < msg[i].data.content.length; j++) {
                if (msg[i].data.content[j].type == 'text') {
                    _msg.push(msg[i].data.content[j].data.text)
                } else if (msg[i].data.content[j].type == 'image') {
                    _msg.push(segment.image(msg[i].data.content[j].data.file))
                } else {
                    _msg.push('出现了未适配的消息的类型,建议联系开发者解决')
                    logger.warn(`出现了未适配的消息的类型${msg[i]}`)
                }
            }
        } else {
            _msg = '出现了未适配的消息的类型,建议联系开发者解决'
            logger.warn(`出现了未适配的消息的类型${msg[i]}`)
        }
        forwardMsg.push({
            message: _msg,
            nickname: msg[i].data.name,
            user_id: Number(msg[i].data.uin)
        })
    }
    if (params.group_id) {
        forwardMsg = await Bot.pickGroup(params.group_id).makeForwardMsg(forwardMsg)
    } else if (params.user_id) {
        forwardMsg = await Bot.pickFriend(params.user_id).makeForwardMsg(forwardMsg)
    }
    return forwardMsg
}

export {
    makeOneBotReportMsg,
    makeGSUidReportMsg,
    makeSendMsg,
    makeForwardMsg,
    makeGSUidSendMsg
}
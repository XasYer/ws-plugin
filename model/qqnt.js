import fetch, { FormData, Blob } from 'node-fetch'
import fs from 'fs'
import os from 'os'
import { setMsgMap, getMsgMap } from './msgMap.js'

function toQQNTMsg(self_id, data) {
    data = JSON.parse(data)
    switch (data.type) {
        case 'meta::connect':
            setTimeout(() => {
                Bot[self_id].version = {
                    ...data.payload,
                    id: 'QQ'
                }
            }, 5000)
            break
        case 'message::recv':
            if (Bot[self_id]?.stat?.recv_msg_cnt) {
                Bot[self_id].stat.recv_msg_cnt++
            } else {
                Bot[self_id].stat.recv_msg_cnt = 1
            }
            makeMessage(self_id, data.payload[0])
            break
        default:
            break;
    }
}

function makeMessage(self_id, payload) {

    const copyPayload = JSON.parse(JSON.stringify(payload))
    copyPayload.content = 'user_id is null'

    const e = {}
    e.bot = Bot[self_id]
    e.post_type = 'message'
    e.message_id = payload.msgId
    e.user_id = payload.senderUin
    e.time = payload.msgTime
    e.seq = payload.msgSeq
    e.rand = payload.msgRandom
    e.sender = {
        user_id: payload.senderUin,
        nickname: payload.sendNickName,
    }
    e.nickname = payload.sendNickName
    e.self_id = self_id
    e.message = []
    e.raw_message = ''
    for (const i of payload.elements) {
        switch (i.elementType) {
            case 1:
                if (i.textElement.atType == 2) {
                    e.message.push({ type: 'at', qq: i.textElement.atUid })
                    e.raw_message += `[提及：${i.textElement.atUid}]`
                } else if (i.textElement.atType == 1) {
                    e.message.push({ type: 'at', qq: 'all' })
                    e.raw_message += `[提及：全体成员]`
                } else if (i.textElement.atType == 0) {
                    e.message.push({ type: 'text', text: i.textElement.content })
                    e.raw_message += i.textElement.content
                }
                break;
            case 2:
                const md5 = i.picElement.md5HexStr.toUpperCase()
                e.message.push({
                    type: 'image',
                    url: `https://gchat.qpic.cn/gchatpic_new/0/0-0-${md5}/0`
                })
                e.raw_message += `[图片: https://gchat.qpic.cn/gchatpic_new/0/0-0-${md5}/0]`
                break
            case 3:
                e.message.push({
                    type: 'file',
                    name: i.fileElement.fileName,
                    fid: i.fileElement.fileUuid.replace('/', ''),
                    md5: i.fileElement.fileMd5,
                    size: i.fileElement.fileSize,
                })
                e.raw_message += `[文件: ${i.fileElement.fileName}]`
            case 4:
                e.message.push({
                    type: 'record',
                    file: i.pttElement.fileName,
                    md5: i.pttElement.md5HexStr,
                    size: i.pttElement.fileSize
                })
                e.raw_message += `[语音: ${i.pttElement.fileName}]`
                break
            case 5:
                e.message.push({
                    type: 'video',
                    name: i.videoElement.fileName,
                    fid: i.videoElement.fileUuid,
                    md5: i.videoElement.thumbMd5,
                    size: i.videoElement.thumbSize
                })
                e.raw_message += `[视频: ${i.videoElement.fileName}]`
                break
            case 6:
                e.message.push({ type: 'face', id: i.faceElement.faceIndex })
                e.raw_message += `[表情: ${i.faceElement.faceIndex}]`
                break
            case 7:
                // e.message.push({ type: "reply", id: i.replyElement.replayMsgId })
                // e.raw_message += `[回复：${i.replyElement.replayMsgId}]`
                break
            case 8:
                switch (i.grayTipElement.subElementType) {
                    case 4:
                        e.post_type = 'notice'
                        e.notice_type = 'group'
                        e.sub_type = 'increase'
                        e.nickname = i.grayTipElement.groupElement.memberNick
                        break;
                    case 12:
                        e.post_type = 'notice'
                        e.notice_type = 'group'
                        e.sub_type = 'increase'
                        const reg = new RegExp(/jp="([0-9]+)".*jp="([0-9]+)"/g)
                        const regRet = reg.exec(i.grayTipElement.xmlElement.content)
                        if (regRet) {
                            e.user_id = regRet[2]
                        }
                        break
                    default:
                        break;
                }
                break
            default:
                break;
        }
    }
    if (payload.chatType == 2) {
        if (!e.sub_type) {
            e.message_type = 'group'
            e.sub_type = 'normal'
        }
        e.group_id = payload.peerUin
        e.group_name = payload.peerName
        logger.info(`${logger.blue(`[${e.self_id}]`)} 群消息：[${e.group_id}, ${e.user_id}] ${e.raw_message}`)
    } else if (payload.chatType == 1) {
        if (!e.sub_type) {
            e.message_type = 'private'
            e.sub_type = 'friend'
        }
        logger.info(`${logger.blue(`[${e.self_id}]`)} 好友消息：[${e.user_id}] ${e.raw_message}`)
    }

    switch (e.post_type) {
        case 'message':
            if (!e.user_id) {
                // 判断是否是#开头 ，是否包含 面板 ，体力
                const regList = [
                    '^#(\\S*)\\s?([\\s\\S]*)$',
                    '^#*(\\*|星铁|星轨|穹轨|星穹|崩铁|星穹铁道|崩坏星穹铁道|铁道)?(多|全|全部|a|A|q|d)?(体力|树脂|查询体力|便笺|便签|mr|tl|sz)$',
                    '^.*(面板|记录|统计|分析).*$'
                ]
                let isMatch = false
                for (const reg of regList) {
                    const regExp = new RegExp(reg)
                    if (regExp.test(e.raw_message)) {
                        isMatch = true
                        break
                    }
                }
                if (isMatch) {
                    const errMsg = [{ type: 'text', text: `ErrMsg：${e.raw_message}(๑•́ ₃ •̀๑)\n啾咪啊！出错了呢！请再发一次命令吧~（期待的眨眨眼）` }]
                    payload.chatType == 1 ? this.sendFriendMsg(e, errMsg) : this.sendGroupMsg(e, errMsg)
                }
                return logger.error(`解码数据失败：${logger.red(JSON.stringify(copyPayload))}`)
            } else {
                setMsgMap(e.message_id, {
                    message_id: e.message_id,
                    seq: e.seq,
                    rand: e.rand,
                    user_id: e.user_id
                })
                Bot.em(`${e.post_type}.${e.message_type}.${e.sub_type}`, e)
            }
            break;
        case 'notice':
            Bot.em(`${e.post_type}.${e.notice_type}.${e.sub_type}`, e)
            break
        default:
            break;
    }
}

function pickFriend(self_id, user_id) {
    const i = {
        ...Bot[self_id].fl.get(user_id),
        self_id: self_id,
        bot: Bot[self_id],
        user_id: user_id,
    }
    return {
        ...i,
        sendMsg: msg => sendFriendMsg(i, msg),
        recallMsg: async message_id => await recallFriendMsg(i, message_id)
    }
}

async function recallFriendMsg(data, message_id) {
    data.bot.api('POST', 'message/recall', JSON.stringify({
        peer: {
            chatType: 1,
            peerUin: data.user_id,
            guildId: null,
        },
        msgIds: [message_id]
    }))
}

function pickMember(self_id, group_id, user_id) {
    const i = {
        ...Bot[self_id].fl.get(user_id),
        self_id: self_id,
        bot: Bot[self_id],
        group_id: group_id,
        user_id: user_id,
    }
    return {
        ...pickFriend(self_id, user_id),
        ...i,
    }
}

async function getMemberMap(self_id, group_id) {
    const bot = Bot[self_id]
    const body = {
        group: group_id,
        size: 9999
    }
    const memberList = await bot.api('POST', 'group/getMemberList', JSON.stringify(body)).then(async r => {
        if (r.status == 200) {
            return await r.json()
        } else {
            return []
        }
    })
    const map = new Map()
    for (const i of memberList) {
        map.set(i.detail.uin, {
            ...i.detail,
            card: i.detail.cardName || i.detail.nick,
            nickname: i.detail.nick,
            group_id,
            user_id: i.detail.uin
        })
    }
    return map
}

function pickGroup(self_id, group_id) {
    const i = {
        ...Bot[self_id].gl.get(group_id),
        self_id: self_id,
        bot: Bot[self_id],
        group_id: group_id,
    }
    return {
        ...i,
        sendMsg: async msg => await sendGroupMsg(i, msg),
        pickMember: user_id => pickMember(self_id, group_id, user_id),
        getMemberMap: async () => await getMemberMap(self_id, group_id),
        recallMsg: async message_id => await recallGroupMsg(i, message_id)
    }
}

async function recallGroupMsg(data, message_id) {
    data.bot.api('POST', 'message/recall', JSON.stringify({
        peer: {
            chatType: 2,
            peerUin: data.group_id,
            guildId: null,
        },
        msgIds: [message_id]
    }))
}

async function sendGroupMsg(data, msg) {
    const { msg: elements, log } = await makeMsg(data, msg)
    logger.info(`${logger.blue(`[${data.self_id} => ${data.group_id}]`)} 发送群消息：${log}`)
    const result = await data.bot.api('POST', 'message/send', JSON.stringify({
        peer: {
            chatType: 2,
            peerUin: data.group_id
        },
        elements
    })).then(r => r.json())
    return { message_id: result.msgId }
}

async function sendFriendMsg(data, msg) {
    const { msg: elements, log } = await makeMsg(data, msg)
    logger.info(`${logger.blue(`[${data.self_id} => ${data.user_id}]`)} 发送好友消息：${log}`)
    const result = await data.bot.api('POST', 'message/send', JSON.stringify({
        peer: {
            chatType: 1,
            peerUin: data.user_id
        },
        elements
    })).then(r => r.json())
    return { message_id: result.msgId }
}

async function makeMsg(data, msg) {
    if (!Array.isArray(msg))
        msg = [msg]
    const msgs = []
    let log = ''
    for (let i of msg) {
        if (typeof i != "object")
            i = { type: "text", text: i }

        switch (i.type) {
            case "text":
                log += i.text
                i = [{
                    "elementType": 1,
                    "textElement": {
                        "content": i.text
                    }
                }]
                break
            case "image":
                const img = await makeImg(data, i.file)
                i = [img]
                log += `[图片: ${img.picElement.md5HexStr}]`
                break
            case "record":
                const record = await makeRecord(data, i.file)
                i = [record]
                log += `[语音: ${record.pttElement.md5HexStr}]`
                break
            case "face":
                i = [{
                    "elementType": 6,
                    "faceElement": {
                        "faceIndex": i.id,
                        "faceType": 1
                    }
                }]
                break
            // case "video":
            //     break
            // case "file":
            //     break
            case "at":
                log += `[提及: ${i.qq}]`
                i = [{
                    "elementType": 1,
                    "textElement": {
                        // "content": "@时空猫猫",
                        "atType": 2,
                        "atNtUin": i.qq
                    }
                }]
                break
            case "reply":
                const msg = await getMsgMap(i.id)
                if (msg) {
                    i = [{
                        "elementType": 7,
                        "replyElement": {
                            "replayMsgSeq": msg.seq,
                            "sourceMsgIdInRecords": i.id,
                            "senderUid": msg.user_id
                        }
                    }]
                } else {
                    i = []
                }
                break
            case "node":
                const array = []
                for (const { message } of i.data) {
                    const { msg: node } = awaitmakeMsg(data, message)
                    array.push(...node)
                }
                i = array
                break
            default:
                i = []
            // i = { type: "text", data: JSON.stringify(i) }
        }
        msgs.push(...i)
    }
    return { msg: msgs, log }
}

async function upload(data, msg, contentType) {
    let buffer
    if (msg.match(/^base64:\/\//)) {
        buffer = Buffer.from(msg.replace(/^base64:\/\//, ""), 'base64')
    } else if (msg.startsWith('http')) {
        const img = await fetch(msg)
        contentType = img.headers.get('content-type');
        const arrayBuffer = await img.arrayBuffer()
        buffer = Buffer.from(arrayBuffer)
    } else if (msg.startsWith('file:///')) {
        buffer = fs.readFileSync(msg.replace('file:///', ''))
        contentType = contentType.split('/')[0] + msg.substring(msg.lastIndexOf('.') + 1)
    }
    const blob = new Blob([buffer], { type: contentType })
    const formData = new FormData()
    formData.append('file', blob, 'ws-plugin.' + contentType.split('/')[1])
    const file = await data.bot.api('POST', 'upload', formData).then(r => r.json())
    file.contentType = contentType
    return file
}

async function makeRecord(data, msg) {
    const file = await upload(data, msg, 'audio/mp3')
    return {
        elementType: 4,
        pttElement: {
            md5HexStr: file.md5,
            fileSize: file.fileSize,
            fileName: file.md5 + '.' + file.ntFilePath.substring(file.ntFilePath.lastIndexOf('.') + 1),
            filePath: file.ntFilePath,
            waveAmplitudes: [8, 0, 40, 0, 56, 0],
            duration: 320
        }
    }
}

async function makeImg(data, msg) {
    const file = await upload(data, msg, 'image/png')
    return {
        elementType: 2,
        picElement: {
            md5HexStr: file.md5,
            fileSize: file.fileSize,
            picHeight: file.imageInfo.height,
            picWidth: file.imageInfo.width,
            fileName: file.md5 + '.' + file.ntFilePath.substring(file.ntFilePath.lastIndexOf('.') + 1),
            sourcePath: file.ntFilePath,
            picType: file.imageInfo.type === 'gif' ? 2000 : 1000
        }
    }
}

async function getToken() {
    let path
    if (os.platform() === 'win32') {
        path = os.homedir() + '/AppData/Roaming/BetterUniverse/QQNT/RED_PROTOCOL_TOKEN'
    } else if (os.platform() === 'linux') {
        path = os.homedir() + '/BetterUniverse/QQNT/RED_PROTOCOL_TOKEN'
    }
    try {
        return fs.readFileSync(path, 'utf8');
    } catch (error) {
        logger.error('QQNT自动获取Token失败,请尝试手动获取')
        logger.error(error)
        return false
    }
}

const qqnt = {
    toQQNTMsg,
    pickFriend,
    pickGroup,
    pickMember,
    getToken
}

export default qqnt 

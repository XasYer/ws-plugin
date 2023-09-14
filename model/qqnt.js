import fetch, { FormData, Blob } from 'node-fetch'
import fs from 'fs'
import { setMsgMap, getMsgMap } from './msgMap.js'
import { createHash, randomBytes, randomUUID } from 'crypto'
import { resolve, join } from 'path'
import { exec } from 'child_process'
import { writeFile, readFile } from 'fs/promises'
import { createRequire } from 'module'
import schedule from "node-schedule"
import os from 'os'
import _ from 'lodash'
const require = createRequire(import.meta.url)

async function toQQNTMsg(bot, data) {
    data = JSON.parse(data)
    switch (data.type) {
        case 'meta::connect':
            await getNtPath(bot)
            setTimeout(() => {
                Bot[bot.self_id].version = {
                    ...data.payload,
                    id: 'QQ'
                }
            }, 5000)
            break
        case 'message::recv':
            if (Bot[bot.self_id]?.stat?.recv_msg_cnt) {
                Bot[bot.self_id].stat.recv_msg_cnt++
            } else {
                Bot[bot.self_id].stat.recv_msg_cnt = 1
            }
            const payload = data.payload[0]
            const e = makeMessage(bot.self_id, payload)
            if (!e) return
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
                            payload.chatType == 1 ? sendFriendMsg(e, errMsg) : sendGroupMsg(e, errMsg)
                        }
                        return logger.error(`解码数据失败：${logger.red(JSON.stringify({
                            msg: e.raw_message,
                            message_id: e.message_id,
                            message_type: e.message_type,
                            content: 'user_id is null'
                        }))}`)
                    } else {
                        if (e.message_type == 'group') {
                            logger.info(`${logger.blue(`[${e.self_id}]`)} 群消息：[${e.group_id}, ${e.user_id}] ${e.raw_message}`)
                        } else if (e.message_type == 'private') {
                            logger.info(`${logger.blue(`[${e.self_id}]`)} 好友消息：[${e.user_id}] ${e.raw_message}`)
                        }
                        setMsgMap(e.message_id, {
                            // message_id: e.message_id,
                            message_id: payload.msgId,
                            seq: e.seq,
                            rand: e.rand,
                            user_id: e.user_id,
                            time: e.time
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
            break
        default:
            break;
    }
}

function makeMessage(self_id, payload) {
    if (!payload) return null
    const e = {}
    e.bot = Bot[self_id]
    e.post_type = 'message'
    e.user_id = Number(payload.senderUin) || null
    // e.message_id = payload.msgId
    e.message_id = `${payload.peerUin}:${payload.msgSeq}`
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
                break
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
                // e.message.push({
                //     type: 'reply',
                //     id: `${payload.peerUin}:${i.replyElement.replayMsgSeq}`,
                //     seq: `${payload.peerUin}:${i.replyElement.replayMsgSeq}`,
                // })
                let replyMsg = i.replyElement.sourceMsgTextElems.reduce((acc, item) => acc + item.textElemContent, '')
                const id = `${payload.peerUin}:${i.replyElement.replayMsgSeq}`
                e.source = {
                    message_id: id,
                    seq: id,
                    time: id,
                    rand: e.rand,
                    user_id: i.replyElement.senderUid,
                    message: replyMsg
                }
                e.raw_message += `[回复: ${id}]`
                break
            case 8:
                switch (i.grayTipElement.subElementType) {
                    case 4:
                        if (i.grayTipElement.groupElement.memberAdd) {
                            // i.grayTipElement.groupElement.type = 4
                            e.post_type = 'notice'
                            e.notice_type = 'group'
                            e.sub_type = 'increase'
                            e.nickname = i.grayTipElement.groupElement.memberAdd.otherAdd.name
                            e.user_id = i.grayTipElement.groupElement.memberAdd.otherAdd.uin
                        }
                        if (i.grayTipElement.groupElement.shutUp) {
                            // i.grayTipElement.groupElement.type = 8
                            e.post_type = 'notice'
                            e.notice_type = 'group'
                            e.sub_type = 'ban'
                            e.duration = i.grayTipElement.groupElement.shutUp.duration
                            e.user_id = i.grayTipElement.groupElement.shutUp.member.uin
                            e.operator_id = i.grayTipElement.groupElement.shutUp.admin.uin
                        }
                        break;
                    case 12:
                        const reg = new RegExp('^<gtip align=".*"><qq uin=".+" col=".*" jp="([0-9]+)" /><nor txt="(.+)"/><qq uin=".*" col=".*" jp="([0-9]+)" /> <nor txt="(.+)"/> </gtip>$')
                        const regRet = reg.exec(i.grayTipElement.xmlElement.content)
                        if (regRet) {
                            if (regRet[2] == '邀请' && regRet[4] == '加入了群聊。') {
                                e.post_type = 'notice'
                                e.notice_type = 'group'
                                e.sub_type = 'increase'
                                e.user_id = regRet[3]
                            }
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
    } else if (payload.chatType == 1) {
        if (!e.sub_type) {
            e.message_type = 'private'
            e.sub_type = 'friend'
        }
    }
    return e
}

function pickFriend(self_id, user_id) {
    const i = {
        ...Bot[self_id].fl.get(Number(user_id)),
        self_id: self_id,
        bot: Bot[self_id],
        user_id: user_id,
    }
    return {
        ...i,
        sendMsg: msg => sendFriendMsg(i, msg),
        recallMsg: async message_id => await recallFriendMsg(i, message_id),
        sendFile: async file => await sendFriendMsg(i, [{ type: 'file', file }]),
        getChatHistory: async (message_id, count) => await getFriendChatHistory(i, message_id, count)
    }
}

async function getFriendChatHistory(data, message_id, count) {
    const msg = await getMsgMap(message_id)
    if (msg) {
        const result = await data.bot.api('POST', 'message/getHistory', JSON.stringify({
            peer: {
                chatType: 1,
                peerUin: data.user_id,
                guildId: null
            },
            offsetMsgId: msg.message_id,
            count: count || 20
        })).then(r => r.json())
        if (result.msgList) {
            const msgList = []
            for (const i of result.msgList) {
                const user_id = (await getMsgMap(`${i.peerUid}:${i.msgSeq}`))?.user_id
                i.senderUin = user_id
                msgList.push(makeMessage(data.self_id, i))
            }
            return msgList
        }
    }
    return []
}

async function recallFriendMsg(data, message_id) {
    message_id = (await getMsgMap(message_id))?.message_id
    if (message_id) {
        data.bot.api('POST', 'message/recall', JSON.stringify({
            peer: {
                chatType: 1,
                peerUin: data.user_id,
                guildId: null,
            },
            msgIds: [message_id]
        }))
    }
}

function pickMember(self_id, group_id, user_id) {
    const i = {
        ...Bot[self_id].fl.get(Number(user_id)),
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
        ...Bot[self_id].gl.get(Number(group_id)),
        self_id: self_id,
        bot: Bot[self_id],
        group_id: group_id,
    }
    return {
        ...i,
        sendMsg: async msg => await sendGroupMsg(i, msg),
        pickMember: user_id => pickMember(self_id, group_id, user_id),
        getMemberMap: async () => await getMemberMap(self_id, group_id),
        recallMsg: async message_id => await recallGroupMsg(i, message_id),
        sendFile: async file => await sendGroupMsg(i, [{ type: 'file', file }]),
        getChatHistory: async (message_id, count) => await getGroupChatHistory(i, message_id, count)
    }
}

async function getGroupChatHistory(data, message_id, count) {
    const msg = await getMsgMap(message_id)
    if (msg) {
        const result = await data.bot.api('POST', 'message/getHistory', JSON.stringify({
            peer: {
                chatType: 2,
                peerUin: data.group_id,
                guildId: null
            },
            offsetMsgId: msg.message_id,
            count: count || 20
        })).then(r => r.json())
        if (result.msgList) {
            const msgList = []
            for (const i of result.msgList) {
                const user_id = (await getMsgMap(`${i.peerUid}:${i.msgSeq}`))?.user_id
                i.senderUin = user_id
                i.peerUin = data.group_id
                msgList.push(makeMessage(data.self_id, i))
            }
            return msgList
        }
    }
    return []
}

async function recallGroupMsg(data, message_id) {
    message_id = (await getMsgMap(message_id))?.message_id
    if (message_id) {
        data.bot.api('POST', 'message/recall', JSON.stringify({
            peer: {
                chatType: 2,
                peerUin: data.group_id,
                guildId: null,
            },
            msgIds: [message_id]
        }))
    }
}

async function sendGroupMsg(data, msg) {
    const { msg: elements, log } = await makeMsg(data, msg)
    if (!elements) return { message_id: null }
    logger.info(`${logger.blue(`[${data.self_id} => ${data.group_id}]`)} 发送群消息：${log}`)
    const result = await data.bot.api('POST', 'message/send', JSON.stringify({
        peer: {
            chatType: 2,
            peerUin: data.group_id
        },
        elements
    })).then(r => r.json())
    const message_id = `${result.peerUid}:${result.msgSeq}`
    setMsgMap(message_id, {
        // message_id: e.message_id,
        message_id: result.msgId,
        seq: message_id,
        rand: message_id,
        user_id: data.self_id,
        time: result.msgTime
    })
    return { message_id }
}

async function sendFriendMsg(data, msg) {
    const { msg: elements, log } = await makeMsg(data, msg)
    if (!elements) return { message_id: null }
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
                i = {
                    "elementType": 1,
                    "textElement": {
                        "content": i.text + ''
                    }
                }
                break
            case "image":
                i = await makeImg(data, i.file || i.url)
                log += `[图片: ${i.picElement.md5HexStr}]`
                break
            case "record":
                const record = await uploadAudio(i.file)
                if (record) {
                    i = record
                    log += `[语音: ${record.pttElement.md5HexStr}]`
                } else {
                    i = {
                        "elementType": 1,
                        "textElement": {
                            "content": JSON.stringify(i)
                        }
                    }
                }
                break
            case "face":
                i = {
                    "elementType": 6,
                    "faceElement": {
                        "faceIndex": i.id,
                        "faceType": 1
                    }
                }
                log += `[表情: ${i.id}]`
                break
            case "video":
                const video = await uploadVideo(data.bot, i.file)
                if (video) {
                    i = video
                    log += `[视频: ${video.videoElement.videoMd5}]`
                } else {
                    i = {
                        "elementType": 1,
                        "textElement": {
                            "content": JSON.stringify(i)
                        }
                    }
                }
                break
            case "file":
                const file = await uploadFile(i.file)
                if (file) {
                    i = file
                    log += `[文件: ${file.fileElement.fileMd5}]`
                } else {
                    i = {
                        "elementType": 1,
                        "textElement": {
                            "content": JSON.stringify(i)
                        }
                    }
                }
                break
            case "at":
                log += `[提及: ${i.qq}]`
                i = {
                    "elementType": 1,
                    "textElement": {
                        // "content": "@时空猫猫",
                        "atType": 2,
                        "atNtUin": i.qq
                    }
                }
                break
            case "reply":
                const msg = await getMsgMap(i.id)
                if (msg) {
                    log += `[回复: ${i.id}]`
                    i = {
                        "elementType": 7,
                        "replyElement": {
                            "replayMsgSeq": msg.seq,
                            "sourceMsgIdInRecords": msg.message_id,
                            "senderUid": msg.user_id,
                            "replyMsgTime": msg.time
                        }
                    }
                } else {
                    i = {
                        "elementType": 1,
                        "textElement": {
                            "content": JSON.stringify(i)
                        }
                    }
                }
                break
            case "node":
                await sendNodeMsg(data, i.data)
                return { msg: null, log: null }
                break
            default:
                log += JSON.stringify(i)
                i = {
                    "elementType": 1,
                    "textElement": {
                        "content": JSON.stringify(i)
                    }
                }
        }
        msgs.push(i)
    }
    return { msg: msgs, log }
}

async function sendNodeMsg(data, msg) {
    let seq = randomBytes(2).readUint16BE()
    async function makeMsg(msg) {
        const result = []
        for (let i of msg) {
            if (typeof i === 'string') i = { type: 'text', text: i }
            switch (i.type) {
                case 'text':
                    result.push({
                        text: {
                            str: i.text
                        }
                    })
                    break;
                case 'image':
                    const img = await makeImg(data, i.file || i.url)
                    const sendRet = await data.bot.api('POST', 'message/send', JSON.stringify({
                        peer: {
                            chatType: 1,
                            peerUin: data.self_id
                        },
                        elements: [img]
                    })).then(r => r.json())
                    data.bot.api('POST', 'message/recall', JSON.stringify({
                        peer: {
                            chatType: 1,
                            peerUin: data.self_id,
                            guildId: null,
                        },
                        msgIds: [sendRet.msgId]
                    }))
                    result.push({
                        text: {
                            str: `https://gchat.qpic.cn/gchatpic_new/0/0-0-${img.picElement.md5HexStr.toUpperCase()}/0`
                        }
                    })
                    // const img = await upload(data, i.file, 'image/png')
                    // result.push({
                    //     "customFace": {
                    //         "filePath": img.ntFilePath,
                    //         "fileId": randomBytes(2).readUint16BE(),
                    //         "serverIp": -1740138629,
                    //         "serverPort": 80,
                    //         "fileType": 1001,
                    //         "useful": 1,
                    //         "md5": new Uint8Array(
                    //             Buffer.from(img.md5, 'hex',),
                    //         ),
                    //         "imageType": 1001,
                    //         "width": img.imageInfo.width,
                    //         "height": img.imageInfo.width,
                    //         "size": img.fileSize,
                    //         "origin": 0,
                    //         "thumbWidth": 0,
                    //         "thumbHeight": 0,
                    //         "pbReserve": new Uint8Array([2, 0])
                    //     }
                    // })
                    break
                // case 'node':

                //     break
                default:
                    for (const key in i) {
                        if (typeof i[key] === 'string' && i[key].length > 50) {
                            i[key] = _.truncate(i[key], { length: 50 })
                        }
                    }
                    result.push({
                        text: {
                            str: JSON.stringify(i)
                        }
                    })
                    break;
            }
        }
        return result
    }
    const msgElements = []
    for (const i of msg) {
        if (typeof i.message == 'string') i.message = { type: 'text', text: i.message }
        if (!Array.isArray(i.message)) i.message = [i.message]
        const element = {
            head: {
                field2: 'u_PmxGsJErxkwN0ilC07NLWw',
                field8: {
                    field1: 2854196310,
                    field4: 'Q群管家'
                }
            },
            content: {
                field1: 82,
                field4: randomBytes(4).readUint32BE(),
                field5: seq++,
                field6: Math.floor(Date.now() / 1000),
                field7: 1,
                field8: 0,
                field9: 0,
                field15: {
                    field1: 0,
                    field2: 0
                }
            },
            body: {
                richText: {
                    elems: [...await makeMsg(i.message)]
                }
            }
        }
        msgElements.push(element)
    }
    let target
    if (data.group_id) {
        target = {
            chatType: 2,
            peerUin: data.group_id
        }
        logger.info(`${logger.blue(`[${data.self_id} => ${data.group_id}]`)} 发送群消息：[转发消息]`)
    } else if (data.user_id) {
        target = {
            chatType: 1,
            peerUin: data.user_id
        }
        logger.info(`${logger.blue(`[${data.self_id} => ${data.user_id}]`)} 发送好友消息：[转发消息]`)
    }
    const payload = {
        msgElements,
        srcContact: target,
        dstContact: target
    }
    await data.bot.api('POST', 'message/unsafeSendForward', JSON.stringify(payload))
}

async function upload(data, msg, contentType) {
    let buffer
    if (msg.match(/^base64:\/\//)) {
        buffer = Buffer.from(msg.replace(/^base64:\/\//, ""), 'base64')
    } else if (msg.startsWith('http')) {
        const img = await fetch(msg)
        const type = img.headers.get('content-type');
        if (type) contentType = type
        const arrayBuffer = await img.arrayBuffer()
        buffer = Buffer.from(arrayBuffer)
    } else if (msg.startsWith('file:///')) {
        buffer = fs.readFileSync(msg.replace('file:///', ''))
        contentType = contentType.split('/')[0] + '/' + msg.substring(msg.lastIndexOf('.') + 1)
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
        const user = os.userInfo().username
        path = `C:/Users/${user}/AppData/Roaming/BetterUniverse/QQNT/RED_PROTOCOL_TOKEN`
    } else {
        logger.error('非Windows系统请自行获取Token')
        return false
    }
    try {
        return fs.readFileSync(path, 'utf8');
    } catch (error) {
        logger.error('QQNT自动获取Token失败,请检查是否已安装Chronocat并尝试手动获取')
        logger.error(error)
        return false
    }
}

async function uploadFile(file) {
    let buffer, name, path = process.cwd() + '/plugins/ws-plugin/Temp/'
    if (file.startsWith('http')) {
        const http = await fetch(file)
        const arrayBuffer = await http.arrayBuffer()
        buffer = Buffer.from(arrayBuffer)
        name = file.substring(file.lastIndexOf('/') + 1)
        path = path + name
        fs.writeFileSync(path, buffer);
    } else if (file.startsWith('file:///')) {
        buffer = fs.readFileSync(file.replace('file:///', ''))
        name = file.substring(file.lastIndexOf('/') + 1)
        path = path + name
        fs.copyFileSync(file, path)
    } else if (Buffer.isBuffer(file)) {
        buffer = file
        name = 'buffer'
        path = path + name
        fs.writeFileSync(path, buffer);
    } else {
        buffer = fs.readFileSync(file)
        name = file.substring(file.lastIndexOf('/') + 1)
        path = path + name
        fs.copyFileSync(file, path)
    }
    const size = buffer.length
    const hash = createHash('md5');
    hash.update(buffer);
    const md5 = hash.digest('hex')
    return {
        elementType: 3,
        fileElement: {
            fileMd5: md5,
            fileName: name,
            filePath: path,
            fileSize: size,
        }
    }
}

const TMP_DIR = process.cwd() + '/plugins/ws-plugin/Temp'
if (!fs.existsSync(TMP_DIR)) fs.mkdirSync(TMP_DIR)
const NOOP = () => { }

const job = schedule.scheduleJob('0 0 4 * * ?', function () {
    logger.mark('[ws-plugin] 执行定时任务: 删除Temp')
    const files = fs.readdirSync(TMP_DIR)
    for (const file of files) {
        fs.unlinkSync(join(TMP_DIR, file))
    }
});

async function getNtPath(bot) {
    let dataPath = await redis.get('ws-plugin:qqnt:dataPath')
    if (!dataPath) {
        const buffer = fs.readFileSync('./plugins/ws-plugin/resources/common/cont/logo.png')
        const blob = new Blob([buffer], { type: 'image/png' })
        const formData = new FormData()
        formData.append('file', blob, '1.png')
        const file = await bot.api('POST', 'upload', formData).then(r => r.json())
        fs.unlinkSync(file.ntFilePath)
        const index = file.ntFilePath.indexOf('nt_data');
        dataPath = file.ntFilePath.slice(0, index + 'nt_data'.length);
        await redis.set('ws-plugin:qqnt:dataPath', dataPath)
    }
    return dataPath
}

async function uploadVideo(bot, file) {
    let type = 'mp4'
    if (file.match(/^base64:\/\//)) {
        const buffer = Buffer.from(file.replace(/^base64:\/\//, ""), 'base64')
        file = join(TMP_DIR, randomUUID({ disableEntropyCache: true }) + '.' + type)
        fs.writeFileSync(file, buffer)
    } else {
        file = file.replace('file:///', '')
        type = file.substring(file.lastIndexOf('.') + 1)
        const Temp = join(TMP_DIR, randomUUID({ disableEntropyCache: true }) + '.' + type)
        fs.copyFileSync(file, Temp)
        file = Temp
    }
    const ntPath = await getNtPath(bot)
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;
    const date = `${year}-${month.toString().padStart(2, '0')}`;
    const video = await getVideoInfo(file)

    let oriPath = `${ntPath}/Video`
    if (!fs.existsSync(oriPath)) fs.mkdirSync(oriPath)
    oriPath = `${oriPath}/${date}`
    if (!fs.existsSync(oriPath)) fs.mkdirSync(oriPath)
    oriPath = `${oriPath}/Ori`
    if (!fs.existsSync(oriPath)) fs.mkdirSync(oriPath)
    oriPath = `${oriPath}/${video.videoMd5}.${type}`

    let thumbPath = `${ntPath}/Video/${date}/Thumb`
    if (!fs.existsSync(thumbPath)) fs.mkdirSync(thumbPath)
    thumbPath = `${thumbPath}/${video.videoMd5}_0.png`

    fs.copyFileSync(file, oriPath)
    fs.unlinkSync(file)
    const thumb = await getThumbInfo(oriPath, thumbPath)
    return {
        elementType: 5,
        videoElement: {
            filePath: oriPath,
            fileName: video.videoMd5 + '.' + type,
            videoMd5: video.videoMd5,
            thumbMd5: thumb.thumbMd5,
            fileTime: video.fileTime,
            thumbSize: thumb.thumbSize,
            fileSize: video.fileSize,
            thumbWidth: thumb.thumbWidth,
            thumbHeight: thumb.thumbHeight
        }
    }
}

async function getVideoInfo(file) {
    const fileTime = await getVideoTime(file)
    const videoMd5 = await getVideoMd5(file)
    const fileSize = fs.readFileSync(file).length
    return {
        fileTime,
        videoMd5,
        fileSize
    }
}

function getVideoMd5(file) {
    return new Promise((resolve, reject) => {
        const stream = fs.createReadStream(file);
        const hash = createHash('md5');
        stream.on('data', chunk => {
            hash.update(chunk);
        });
        stream.on('end', () => {
            const md5 = hash.digest('hex');
            resolve(md5)
        });
    })
}

function getVideoTime(file) {
    return new Promise((resolve, reject) => {
        exec(`ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${file}"`, (error, stdout, stderr) => {
            if (error) {
                reject('获取视频长度失败, 请确保你的 ffmpeg 已正确安装')
            }
            const durationInSeconds = parseInt(stdout);
            resolve(durationInSeconds)
        });
    })
}

async function getThumbInfo(file, thumbPath) {

    const tempPath = join(TMP_DIR, randomUUID({ disableEntropyCache: true }) + '.jpg')

    const { thumbMd5, thumbSize } = await extractThumbnail(file, tempPath);

    const { thumbWidth, thumbHeight } = getImageSize(tempPath);

    fs.copyFileSync(tempPath, thumbPath)
    fs.unlinkSync(tempPath)

    return { thumbMd5, thumbWidth, thumbHeight, thumbSize };
}

function extractThumbnail(inputFile, outputFile) {
    return new Promise((resolve, reject) => {
        exec(`ffmpeg -i "${inputFile}" -ss 00:00:00.000 -vframes 1 -vf "scale=iw/3:ih/3" "${outputFile}"
        `, async () => {
            fs.access(outputFile, fs.constants.F_OK, (err) => {
                if (err) {
                    reject('获取视频封面失败, 请确保你的 ffmpeg 已正确安装')
                }
            })

            const buffer = fs.readFileSync(outputFile);
            const hash = createHash('md5');
            hash.update(buffer);
            resolve({
                thumbMd5: hash.digest('hex'),
                thumbSize: buffer.length
            })
        })
    })
}

function getImageSize(file) {
    const buffer = fs.readFileSync(file);
    const start = buffer.indexOf(Buffer.from([0xff, 0xc0]));
    const thumbHeight = buffer.readUInt16BE(start + 5);
    const thumbWidth = buffer.readUInt16BE(start + 7);
    return { thumbWidth, thumbHeight };
}

async function uploadAudio(file) {
    let buffer
    if (file.match(/^base64:\/\//)) {
        buffer = Buffer.from(file.replace(/^base64:\/\//, ""), 'base64')
    } else if (file.startsWith('http')) {
        const http = await fetch(file)
        const arrayBuffer = await http.arrayBuffer()
        buffer = Buffer.from(arrayBuffer)
    } else if (file.startsWith('file:///')) {
        buffer = fs.readFileSync(file.replace('file:///', ''))
    }
    const head = buffer.subarray(0, 7).toString()
    let filePath
    let duration = 0
    if (!head.includes('SILK')) {
        const tmpPath = await saveTmp(buffer)
        duration = await getDuration(tmpPath)
        const res = await audioTrans(tmpPath)
        filePath = res.silkFile
        buffer = await readFile(filePath)
    } else {
        filePath = await saveTmp(buffer)
    }

    const hash = createHash('md5')
    hash.update(buffer.toString('binary'), 'binary')
    const md5 = hash.digest('hex')
    return {
        elementType: 4,
        pttElement: {
            md5HexStr: md5,
            fileSize: buffer.length,
            fileName: md5 + '.amr',
            filePath: filePath,
            waveAmplitudes: [36, 28, 68, 28, 84, 28],
            duration: duration
        }
    }
}

function audioTrans(tmpPath, samplingRate = '24000') {
    const { encode } = require('node-silk-encode')
    return new Promise((resolve, reject) => {
        const pcmFile = join(TMP_DIR, randomUUID({ disableEntropyCache: true }))
        exec(`ffmpeg -y -i "${tmpPath}" -ar ${samplingRate} -ac 1 -f s16le "${pcmFile}"`, async () => {
            fs.unlink(tmpPath, NOOP)
            fs.access(pcmFile, fs.constants.F_OK, (err) => {
                if (err) {
                    reject('音频转码失败, 请确保你的 ffmpeg 已正确安装')
                }
            })

            const silkFile = join(TMP_DIR, randomUUID({ disableEntropyCache: true }))
            await encode(pcmFile, silkFile, samplingRate)
            fs.unlink(pcmFile, NOOP)

            resolve({
                silkFile
            })
        })
    })
}

function getDuration(file) {
    return new Promise((resolve, reject) => {
        exec(`ffmpeg -i ${file}`, function (err, stdout, stderr) {
            const outStr = stderr.toString()
            const regDuration = /Duration\: ([0-9\:\.]+),/
            const rs = regDuration.exec(outStr)
            if (rs === null) {
                reject("获取音频时长失败, 请确保你的 ffmpeg 已正确安装")
            } else if (rs[1]) {
                const time = rs[1]
                const parts = time.split(":")
                const seconds = (+parts[0]) * 3600 + (+parts[1]) * 60 + (+parts[2])
                const round = seconds.toString().split('.')[0]
                resolve(+ round)
            }
        })
    })
}

async function saveTmp(data, ext = null) {
    ext = ext ? '.' + ext : ''
    const filename = randomUUID({ disableEntropyCache: true }) + ext
    const tmpPath = resolve(TMP_DIR, filename)
    await writeFile(tmpPath, data)
    return tmpPath
}


const qqnt = {
    toQQNTMsg,
    pickFriend,
    pickGroup,
    pickMember,
    getToken
}

export default qqnt
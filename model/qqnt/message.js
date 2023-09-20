import { uploadImg, uploadAudio, uploadVideo, uploadFile, TMP_DIR, getNtPath, roleMap, redPath } from './tool.js'
import { setMsgMap, getMsgMap } from '../msgMap.js'
import { randomBytes } from 'crypto'
import { join, extname, basename } from 'path'
import fs from 'fs'
import schedule from "node-schedule"

async function makeSendMsg(data, message) {
    if (!Array.isArray(message))
        message = [message]
    const msgs = []
    let log = ''
    for (let i of message) {
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
                i = await uploadImg(data.bot, i.file || i.url)
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
                        "atNtUin": String(i.qq)
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
                            "replayMsgId": msg.message_id,
                            "senderUin": String(msg.user_id),
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
                return await sendNodeMsg(data, i.data)
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

async function makeMessage(self_id, payload) {
    if (!payload) return null
    const e = {}
    e.bot = Bot[self_id]
    e.post_type = 'message'
    e.user_id = Number(payload.senderUin)
    if (!e.user_id || e.user_id == '0') return null
    e.message_id = `${payload.peerUin}:${payload.msgSeq}`
    e.time = payload.msgTime
    e.seq = payload.msgSeq
    e.rand = payload.msgRandom
    e.nickname = payload.sendNickName || payload.sendMemberName
    e.sender = {
        user_id: e.user_id,
        nickname: e.nickname,
        role: roleMap[payload.roleType] || 'member'
    }
    e.self_id = self_id
    e.message = []
    e.raw_message = ''
    for (const i of payload.elements) {
        switch (i.elementType) {
            case 1:
                if (i.textElement.atType == 2) {
                    const qq = i.textElement.atUid == '0' ? i.textElement.atNtUin : i.textElement.atUid
                    e.message.push({ type: 'at', qq })
                    e.raw_message += `[提及：${qq}]`
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
                const msg = await getMsgMap(id)
                e.source = {
                    message_id: id,
                    seq: id,
                    time: id,
                    rand: msg?.rand,
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
            case 16:
                e.message.push({ type: 'xml', data: i.multiForwardMsgElement.xmlContent })
                e.raw_message += `[xml: ${i.multiForwardMsgElement.xmlContent}]`
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
        e.group_id = Number(payload.peerUin)
        e.group_name = payload.peerName
    } else if (payload.chatType == 1) {
        if (!e.sub_type) {
            e.message_type = 'private'
            e.sub_type = 'friend'
        }
    }
    return e
}

async function sendNodeMsg(data, msg) {
    const msgElements = await makeNodeMsg(data, msg)
    let target
    if (data.group_id) {
        target = {
            chatType: 2,
            peerUin: String(data.group_id)
        }
    } else if (data.user_id) {
        target = {
            chatType: 1,
            peerUin: String(data.user_id)
        }
    }
    const payload = {
        msgElements,
        srcContact: target,
        dstContact: target
    }
    const result = await data.bot.sendApi('POST', 'message/unsafeSendForward', JSON.stringify(payload))
    if (result.error) {
        throw result.error
    }
    const message_id = `${result.peerUid}:${result.msgSeq}`
    setMsgMap(message_id, {
        message_id: result.msgId,
        seq: message_id,
        rand: result.msgRandom,
        user_id: data.self_id,
        time: result.msgTime,
        chatType: target.chatType,
        group_id: data.group_id,
        sender: data.self_id
    })
    logger.info(`${logger.blue(`[${data.self_id} => ${data.group_id || data.user_id}]`)} 发送${target.chatType == 1 ? '好友' : '群'}消息：[转发消息]`)
    return { message_id, rand: result.msgRandom }
}

async function makeNodeMsg(data, msg) {
    const msgElements = []
    for (const item of msg) {
        if (typeof item.message == 'string') item.message = { type: 'text', text: item.message }
        if (!Array.isArray(item.message)) item.message = [item.message]
        const elems = []
        for (let i of item.message) {
            if (typeof i === 'string') i = { type: 'text', text: i }
            switch (i.type) {
                case 'text':
                    elems.push({
                        text: {
                            str: i.text
                        }
                    })
                    break;
                case 'image':
                    const img = await uploadImg(data.bot, i.file || i.url)
                    const sendRet = await data.bot.sendApi('POST', 'message/send', JSON.stringify({
                        peer: {
                            chatType: 1,
                            peerUin: String(data.self_id)
                        },
                        elements: [img]
                    }))
                    if (sendRet.error) {
                        throw sendRet.error
                    }
                    data.bot.sendApi('POST', 'message/recall', JSON.stringify({
                        peer: {
                            chatType: 1,
                            peerUin: String(data.self_id),
                            guildId: null,
                        },
                        msgIds: [sendRet.msgId]
                    }))
                    let formattedStr = convertFileName(img.picElement.sourcePath)
                    elems.push({
                        "customFace": {
                            "filePath": formattedStr,
                            "fileId": randomBytes(2).readUint16BE(),
                            "serverIp": -1740138629,
                            "serverPort": 80,
                            "fileType": 1001,
                            "useful": 1,
                            "md5": Buffer.from(img.picElement.md5HexStr, 'hex').toString('base64'),
                            "imageType": 1001,
                            "width": img.picElement.picWidth,
                            "height": img.picElement.picHeight,
                            "size": img.fileSize,
                            "origin": 0,
                            "thumbWidth": 0,
                            "thumbHeight": 0,
                            // "pbReserve": [2, 0]
                            // "pbReserve": null
                        }
                    })
                    break
                case 'node':
                    elems.push(...await makeNodeMsg(data, i.data))
                    break
                default:
                    for (const key in i) {
                        if (typeof i[key] === 'string' && i[key].length > 50) {
                            i[key] = _.truncate(i[key], { length: 50 })
                        }
                    }
                    elems.push({
                        text: {
                            str: JSON.stringify(i)
                        }
                    })
                    break;
            }
        }
        const element = []
        if (!elems[0].head) {
            let seq = randomBytes(2).readUint16BE()
            element.push({
                head: {
                    field2: Number(item.user_id) || Number(data.self_id),
                    field8: {
                        field1: Number(data.group_id || 698673296),
                        field4: String(item.nickname || data.bot.nickname)
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
                        elems
                    }
                }
            })
        } else {
            element.push(...elems)
        }
        msgElements.push(...element)
    }
    return msgElements
}

function convertFileName(filePath) {
    // 获取文件名（不包括扩展名）
    let fileName = basename(filePath, extname(filePath));

    // 将文件名转换为大写，并按照指定的格式添加短横线
    let convertedName = fileName.toUpperCase().replace(/(.{8})(.{4})(.{4})(.{4})(.{12})/, '$1-$2-$3-$4-$5');

    // 将转换后的文件名和原始扩展名拼接起来
    let newFileName = `{${convertedName}}${extname(filePath)}`;

    return newFileName;
}

async function toQQNTMsg(bot, data) {
    data = JSON.parse(data)
    switch (data.type) {
        case 'meta::connect':
            if (!fs.existsSync(TMP_DIR)) fs.mkdirSync(TMP_DIR)
            const job = schedule.scheduleJob('0 0 4 * * ?', function () {
                logger.mark('[ws-plugin] 执行定时任务: 删除Temp')
                const files = fs.readdirSync(TMP_DIR)
                for (const file of files) {
                    fs.unlinkSync(join(TMP_DIR, file))
                }
                const path = `${redPath}/redprotocol-upload`
                const redTemp = fs.readdirSync(path)
                for (const file of redTemp) {
                    fs.unlinkSync(join(path, file))
                }
            });
            await getNtPath(bot)
            setTimeout(() => {
                if (Bot[bot.self_id]?.version) {
                    Bot[bot.self_id].version = {
                        ...data.payload,
                        id: 'QQ'
                    }
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
            const e = await makeMessage(bot.self_id, payload)
            if (!e) return
            switch (e.post_type) {
                case 'message':
                    if (e.message_type == 'group') {
                        logger.info(`${logger.blue(`[${e.self_id}]`)} 群消息：[${e.group_id}, ${e.user_id}] ${e.raw_message}`)
                        if (!Bot[bot.self_id].gml.has(Number(e.group_id))) {
                            Bot[bot.self_id].gml.set(Number(e.group_id), new Map())
                        }
                        if (!Bot[bot.self_id].gml.get(Number(e.group_id)).has(Number(e.user_id))) {
                            Bot[bot.self_id].gml.get(Number(e.group_id)).set(Number(e.user_id), {
                                bot_id: e.self_id,
                                group_id: e.group_id,
                                nickname: e.nickname,
                                role: e.sender.role,
                                user_id: e.user_id,
                                card: e.nickname,
                                sex: 'unknown'
                            })
                        }
                    } else if (e.message_type == 'private') {
                        logger.info(`${logger.blue(`[${e.self_id}]`)} 好友消息：[${e.user_id}] ${e.raw_message}`)
                        if (!Bot[bot.self_id].fl.has(Number(e.user_id))) {
                            Bot[bot.self_id].fl.set(Number(e.user_id), {
                                bot_id: e.self_id,
                                user_id: e.user_id,
                                nickname: e.nickname,
                            })
                        }
                    }
                    setMsgMap(e.message_id, {
                        // message_id: e.message_id,
                        message_id: payload.msgId,
                        seq: e.seq,
                        rand: e.rand,
                        user_id: e.user_id,
                        time: e.time,
                        chatType: e.message_type == 'group' ? 2 : 1,
                        group_id: e.group_id
                    })
                    Bot.em(`${e.post_type}.${e.message_type}.${e.sub_type}`, e)
                    // }
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



export {
    makeSendMsg,
    toQQNTMsg,
    makeMessage
}
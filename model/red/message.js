import { uploadImg, uploadAudio, uploadVideo, uploadFile, getNtPath, roleMap, redPath } from './tool.js'
import { TMP_DIR, sleep } from '../tool.js'
import { setMsgMap, getMsgMap } from '../msgMap.js'
import { Config, Version } from '../../components/index.js'
import { randomBytes } from 'crypto'
import { join, extname, basename } from 'path'
import fs from 'fs'
import schedule from "node-schedule"
import _ from 'lodash'
import PluginsLoader from '../../../../lib/plugins/loader.js'

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
                if (typeof i.text === 'boolean') break
                log += i.text
                i = {
                    "elementType": 1,
                    "textElement": {
                        "content": String(i.text)
                    }
                }
                break
            case "image":
                i = await uploadImg(data.bot, i.file || i.url)
                log += `[图片: ${i.picElement.md5HexStr}]`
                break
            case "record":
                const record = await uploadAudio(data.bot, i.file)
                if (record) {
                    i = record
                    log += `[语音: ${record.pttElement.md5HexStr}]`
                } else {
                    throw '语音上传失败'
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
                if (i.qq == 'all') {
                    i = {
                        "elementType": 1,
                        "textElement": {
                            "content": "@全体成员",
                            "atType": 1
                        }
                    }
                } else {
                    i = {
                        "elementType": 1,
                        "textElement": {
                            // "content": "@时空猫猫",
                            "atType": 2,
                            "atNtUin": String(i.qq)
                        }
                    }
                }
                break
            case "reply":
                const msg = await getMsgMap({ message_id: i.id })
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
                if (Config.redSendForwardMsgType == 1) {
                    return await sendNodeMsg(data, i.data)
                } else if (Config.redSendForwardMsgType == 2) {
                    let message_id, rand, seq, time
                    for (const { message: msg } of i.data) {
                        let peer = {
                            chatType: data.group_id ? 2 : 1,
                            peerUin: String(data.group_id || data.user_id)
                        }
                        const { msg: elements, log } = await makeSendMsg(data, msg)
                        if (!elements) continue
                        const result = await data.bot.sendApi('POST', 'message/send', JSON.stringify({
                            peer,
                            elements
                        }))
                        if (result.error) {
                            throw result.error
                        } else {
                            const sendRet = {
                                message_id: result.msgId,
                                seq: Number(result.msgSeq),
                                rand: Number(result.msgRandom),
                                time: Number(result.msgTime),
                                onebot_id: Math.floor(Math.random() * Math.pow(2, 32)) | 0,
                            }
                            if (data.group_id) {
                                sendRet.group_id = Number(data.group_id)
                            } else {
                                sendRet.user_id = Number(data.user_id)
                            }
                            setMsgMap(sendRet)
                            message_id = result.msgId
                            seq = Number(result.msgSeq)
                            rand = Number(result.msgRandom)
                            time = Number(result.msgTime)
                            logger.info(`${logger.blue(`[${data.self_id} => ${data.group_id || data.user_id}]`)} 发送消息：${log}`)
                        }
                        // 防止发太快
                        // await sleep(500)
                    }
                    return { message_id, rand, seq, time }
                } else if (Config.redSendForwardMsgType == 3) {
                    let message_id, rand, seq, time, elements = [], logs = ''
                    for (let index = 0; index < i.data.length; index++) {
                        const { msg: element, log } = await makeSendMsg(data, i.data[index].message)
                        if (!element) continue
                        if (index != i.data.length - 1) {
                            element.push({
                                "elementType": 1,
                                "textElement": {
                                    "content": '\n'
                                }
                            })
                        }
                        elements.push(...element)
                        logs += log
                    }
                    let peer = {
                        chatType: data.group_id ? 2 : 1,
                        peerUin: String(data.group_id || data.user_id)
                    }
                    const result = await data.bot.sendApi('POST', 'message/send', JSON.stringify({
                        peer,
                        elements
                    }))
                    if (result.error) {
                        throw result.error
                    } else {
                        const sendRet = {
                            message_id: result.msgId,
                            seq: Number(result.msgSeq),
                            rand: Number(result.msgRandom),
                            time: Number(result.msgTime),
                            onebot_id: Math.floor(Math.random() * Math.pow(2, 32)) | 0,
                        }
                        if (data.group_id) {
                            sendRet.group_id = Number(data.group_id)
                        } else {
                            sendRet.user_id = Number(data.user_id)
                        }
                        setMsgMap(sendRet)
                        message_id = result.msgId
                        seq = Number(result.msgSeq)
                        rand = Number(result.msgRandom)
                        time = Number(result.msgTime)
                        logger.info(`${logger.blue(`[${data.self_id} => ${data.group_id || data.user_id}]`)} 发送消息：${_.truncate(logs, { length: 1000 })}`)
                    }
                    return { message_id, rand, seq, time }
                }
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
    if (!e.user_id) return null
    // e.message_id = `${payload.peerUin}:${payload.msgSeq}`
    e.message_id = payload.msgId
    e.time = Number(payload.msgTime)
    e.seq = Number(payload.msgSeq)
    e.rand = Number(payload.msgRandom)
    e.nickname = payload.sendMemberName || payload.sendNickName
    e.sender = {
        user_id: e.user_id,
        nickname: e.nickname,
        role: roleMap[payload.roleType] || 'member'
    }
    e.self_id = Number(self_id)
    e.message = []
    e.raw_message = ''
    for (const i of payload.elements) {
        switch (i.elementType) {
            case 1:
                if (i.textElement.atType == 2) {
                    const qq = i.textElement.atUid == '0' ? i.textElement.atNtUin : i.textElement.atUid
                    e.message.push({ type: 'at', qq: Number(qq) })
                    if (qq == e.self_id) {
                        e.atBot = true
                    }
                } else if (i.textElement.atType == 1) {
                    e.message.push({ type: 'at', qq: 'all' })
                } else if (i.textElement.atType == 0) {
                    e.message.push({ type: 'text', text: i.textElement.content })
                }
                e.raw_message += i.textElement.content
                break;
            case 2:
                const md5 = i.picElement.md5HexStr
                const url = `https://gchat.qpic.cn/gchatpic_new/0/0-0-${md5.toUpperCase()}/0`
                e.message.push({
                    type: 'image',
                    url,
                    file: url
                })
                e.raw_message += `[图片]`
                break
            case 3:
                if (payload.chatType == 2) break
                const file = await Bot[self_id].sendApi('POST', 'message/fetchRichMedia', JSON.stringify({
                    "msgId": e.message_id,
                    "chatType": payload.chatType,
                    "peerUid": payload.peerUin,
                    "elementId": i.elementId,
                    "thumbSize": 0,
                    "downloadType": 2
                }))
                if (file.error) throw file.error
                const buffer = Buffer.from(await file.arrayBuffer())
                const fid = `${e.time}-${i.fileElement.fileName}`
                fs.writeFileSync(join(TMP_DIR, fid), buffer)
                e.message.push({
                    type: 'file',
                    name: i.fileElement.fileName,
                    fid,
                    md5: i.fileElement.fileMd5,
                    size: i.fileElement.fileSize,
                })
                e.raw_message += `[文件]`
                break
            case 4:
                e.message.push({
                    type: 'record',
                    file: i.pttElement.fileName,
                    md5: i.pttElement.md5HexStr,
                    size: i.pttElement.fileSize
                })
                e.raw_message += `[语音]`
                break
            case 5:
                e.message.push({
                    type: 'video',
                    name: i.videoElement.fileName,
                    fid: i.videoElement.fileUuid,
                    md5: i.videoElement.thumbMd5,
                    size: i.videoElement.thumbSize
                })
                e.raw_message += `[视频]`
                break
            case 6:
                e.message.push({ type: 'face', id: Number(i.faceElement.faceIndex) })
                e.raw_message += `[表情]`
                break
            case 7:
                // e.message.push({
                //     type: 'reply',
                //     id: `${payload.peerUin}:${i.replyElement.replayMsgSeq}`,
                //     seq: `${payload.peerUin}:${i.replyElement.replayMsgSeq}`,
                // })
                let replyMsg = i.replyElement.sourceMsgTextElems.reduce((acc, item) => acc + item.textElemContent, '')
                const getMsgData = {
                    seq: Number(i.replyElement.replayMsgSeq),
                }
                if (payload.chatType == 2) {
                    getMsgData.group_id = Number(payload.peerUin)
                } else if (payload.chatType == 1) {
                    getMsgData.user_id = e.user_id
                }
                const msg = await getMsgMap(getMsgData)
                e.source = {
                    message_id: msg?.message_id,
                    seq: Number(i.replyElement.replayMsgSeq),
                    time: Number(i.replyElement.replyMsgTime),
                    rand: msg?.rand,
                    user_id: Number(i.replyElement.senderUid),
                    message: replyMsg
                }
                let replyText = ''
                if (payload.chatType == 2) {
                    replyText += '@' + (e.bot.gml.get(Number(payload.peerUin))?.get(e.source.user_id)?.card || payload.peerUin)
                } else {
                    replyText += '@' + (e.bot.fl.get(Number(payload.peerUin))?.nickname || payload.peerUin)
                }
                e.raw_message = replyText + e.raw_message
                break
            case 8:
                switch (i.grayTipElement.subElementType) {
                    case 4:
                        if (i.grayTipElement.groupElement.memberAdd) {
                            // i.grayTipElement.groupElement.type = 4
                            e.post_type = 'notice'
                            e.notice_type = 'group'
                            e.sub_type = 'increase'
                            e.nickname = i.grayTipElement.memberNick
                            e.user_id = Number(i.grayTipElement.groupElement.memberUin)
                            // e.nickname = i.grayTipElement.groupElement.memberAdd.otherAdd.name
                            // e.user_id = Number(i.grayTipElement.groupElement.memberAdd.otherAdd.uin)
                        }
                        if (i.grayTipElement.groupElement.shutUp) {
                            // i.grayTipElement.groupElement.type = 8
                            e.post_type = 'notice'
                            e.notice_type = 'group'
                            e.sub_type = 'ban'
                            e.duration = i.grayTipElement.groupElement.shutUp.duration
                            e.user_id = Number(i.grayTipElement.groupElement.shutUp.member.uin)
                            e.operator_id = Number(i.grayTipElement.groupElement.shutUp.admin.uin)
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
                                e.user_id = Number(regRet[3])
                            }
                        }
                        break
                    default:
                        break;
                }
                break
            case 11:
                e.message.push({
                    type: 'bface',
                    file: i.marketFaceElement.emojiId,
                    text: i.marketFaceElement.faceName
                })
                e.raw_message += i.marketFaceElement.faceName
                break
            case 16:
                e.message.push({ type: 'xml', data: i.multiForwardMsgElement.xmlContent })
                e.raw_message += `{xml:${i.multiForwardMsgElement.xmlContent}}`
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
    } else if (payload.chatType == 100) {
        if (!e.sub_type) {
            e.message_type = 'private'
            e.sub_type = 'group'
        }
        Bot[self_id].fl.set(e.user_id, {
            bot_id: self_id,
            user_id: e.user_id,
            nickname: e.nickname,
            isGroupMsg: true
        })
    }

    if (e.group_id) e.group = e.bot.pickGroup(e.group_id)
    if (e.user_id) e.friend = e.bot.pickFriend(e.user_id)
    if (e.group && e.user_id) e.member = e.group.pickMember(e.user_id)
    if (!Version.isTrss) {
        e.pickFriend = (user_id) => Bot[self_id].pickFriend(user_id)
        e.pickGroup = (group) => Bot[self_id].pickGroup(group)
        e.pickMember = (group_id, user_id) => Bot[self_id].pickMember(group_id, user_id)
        e.pickUser = (user_id) => Bot[self_id].pickUser(user_id)
        e.reply = (msg, quote) => {
            if (!Array.isArray(msg)) msg = [msg]
            if (quote && e.message_id) {
                msg.unshift({ type: 'reply', id: e.message_id })
            }
            if (e.isGroup) {
                if (e.group?.sendMsg) {
                    return e.group.sendMsg(msg)
                } else {
                    return e.bot.pickGroup(e.group_id).sendMsg(msg)
                }
            } else {
                if (e.friend?.sendMsg) {
                    return e.friend.sendMsg(msg)
                } else {
                    return e.bot.pickFriend(e.user_id).sendMsg(msg)
                }
            }
        }
        e.toString = () => {
            return e.raw_message
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
    const sendRet = {
        message_id: result.msgId,
        seq: Number(result.msgSeq),
        rand: Number(result.msgRandom),
        user_id: Number(data.user_id),
        time: Number(result.msgTime),
        group_id: Number(data.group_id),
    }
    setMsgMap(sendRet)
    logger.info(`${logger.blue(`[${data.self_id} => ${data.group_id || data.user_id}]`)} 发送${target.chatType == 1 ? '好友' : '群'}消息：[转发消息]`)
    return sendRet
}

async function makeNodeMsg(data, msg) {
    const msgElements = []
    let seq = randomBytes(2).readUint16BE()
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
                    elems.push(...(await makeNodeMsg(data, i.data)))
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
            element.push({
                head: {
                    // field2: Number(data.self_id),
                    field8: {
                        // field1: Number(data.group_id),
                        field4: 'QQ用户' //String(data.bot.nickname)
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

async function toQQRedMsg(bot, data) {
    data = JSON.parse(data)
    switch (data.type) {
        case 'meta::connect':
            const job = schedule.scheduleJob('0 0 4 * * ?', function () {
                logger.mark('[ws-plugin] 执行定时任务: 删除Temp')
                try {
                    const files = fs.readdirSync(TMP_DIR)
                    for (const file of files) {
                        fs.unlink(join(TMP_DIR, file), () => { })
                    }
                    const path = `${redPath}/redprotocol-upload`
                    const redTemp = fs.readdirSync(path)
                    for (const file of redTemp) {
                        fs.unlink(join(path, file), () => { })
                    }
                } catch (error) {

                }
            });
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
            if (!e || (e.post_type === 'message' && e.message.length == 0)) return
            switch (e.post_type) {
                case 'message':
                    if (e.message_type == 'group') {
                        logger.info(`${logger.blue(`[${e.self_id}]`)} 群消息：[${e.group_name}(${e.group_id}), ${e.nickname}(${e.user_id})] ${e.raw_message}`)
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
                        logger.info(`${logger.blue(`[${e.self_id}]`)} 好友消息：[${e.nickname}(${e.user_id})] ${e.raw_message}`)
                        if (!Bot[bot.self_id].fl.has(Number(e.user_id))) {
                            Bot[bot.self_id].fl.set(Number(e.user_id), {
                                bot_id: e.self_id,
                                user_id: e.user_id,
                                nickname: e.nickname,
                            })
                        }
                    }
                    setMsgMap({
                        message_id: e.message_id,
                        seq: Number(e.seq),
                        rand: Number(e.rand),
                        user_id: Number(e.user_id),
                        time: Number(e.time),
                        group_id: Number(e.group_id),
                    })
                    // Bot.on('message',()=>{})可以监听到消息 但是self_id = 88888
                    Bot.em(`${e.post_type}.${e.message_type}.${e.sub_type}`, e)
                    // Bot.on('message',()=>{})不可以监听到消息 但是self_id正常
                    // PluginsLoader.deal(e)
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
    toQQRedMsg,
    makeMessage
}
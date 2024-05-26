import { uploadImg, uploadAudio, uploadVideo, uploadFile, getNtPath, roleMap, redPath } from './tool.js'
import { TMP_DIR, sleep, toImg, deleteFolder } from '../tool.js'
import { setMsg, getMsg } from '../DataBase.js'
import { Config, Version, Render } from '../../components/index.js'
import { randomBytes } from 'crypto'
import { join, extname, basename } from 'path'
import fs from 'fs'
import YAML from 'yaml'
import schedule from 'node-schedule'
import _ from 'lodash'
import Runtime from '../../../../lib/plugins/runtime.js'

async function makeSendMsg(data, message) {
  if (!Array.isArray(message)) message = [message]
  const msgs = []
  let log = ''
  for (let i of message) {
    if (typeof i != 'object') i = { type: 'text', text: i }

    switch (i.type) {
      case 'text':
        if (typeof i.text === 'boolean') break
        log += i.text
        i = {
          elementType: 1,
          textElement: {
            content: String(i.text)
          }
        }
        break
      case 'image':
        i = await uploadImg(data.bot, i.file || i.url, i.name)
        log += `[图片: ${i.picElement.md5HexStr}]`
        break
      case 'record':
        const record = await uploadAudio(data.bot, i.file)
        if (record) {
          i = record
          log += `[语音: ${record.pttElement.md5HexStr}]`
        } else {
          throw '语音上传失败'
        }
        break
      case 'face':
        i = {
          elementType: 6,
          faceElement: {
            faceIndex: i.id,
            faceType: 1
          }
        }
        log += `[表情: ${i.id}]`
        break
      case 'video':
        const video = await uploadVideo(data.bot, i.file)
        if (video) {
          i = video
          log += `[视频: ${video.videoElement.videoMd5}]`
        } else {
          throw '视频上传失败'
        }
        break
      case 'file':
        const file = await uploadFile(data.bot, i.file, i.name)
        if (file) {
          i = file
          log += `[文件: ${file.fileElement.fileMd5}]`
        } else {
          throw '文件上传失败'
        }
        break
      case 'at':
        log += `[提及: ${i.qq}]`
        if (i.qq == 'all') {
          i = {
            elementType: 1,
            textElement: {
              content: '@全体成员',
              atType: 1
            }
          }
        } else {
          i = {
            elementType: 1,
            textElement: {
              // "content": "@时空猫猫",
              atType: 2,
              atNtUin: String(i.qq)
            }
          }
        }
        break
      case 'reply':
        const msg = await getMsg({ message_id: i.id })
        if (msg) {
          log += `[回复: ${i.id}]`
          i = {
            elementType: 7,
            replyElement: {
              replayMsgSeq: msg.seq,
              replayMsgId: msg.message_id,
              senderUin: String(msg.user_id)
            }
          }
        } else {
          i = null
        }
        break
      case 'node':
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
                onebot_id: Math.floor(Math.random() * Math.pow(2, 32)) | 0
              }
              if (data.group_id) {
                sendRet.group_id = Number(data.group_id)
              } else {
                sendRet.user_id = Number(data.user_id)
              }
              setMsg(sendRet)
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
                elementType: 1,
                textElement: {
                  content: '\n'
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
              onebot_id: Math.floor(Math.random() * Math.pow(2, 32)) | 0
            }
            if (data.group_id) {
              sendRet.group_id = Number(data.group_id)
            } else {
              sendRet.user_id = Number(data.user_id)
            }
            setMsg(sendRet)
            message_id = result.msgId
            seq = Number(result.msgSeq)
            rand = Number(result.msgRandom)
            time = Number(result.msgTime)
            logger.info(`${logger.blue(`[${data.self_id} => ${data.group_id || data.user_id}]`)} 发送消息：${_.truncate(logs, { length: 1000 })}`)
          }
          return { message_id, rand, seq, time }
        } else if (Config.redSendForwardMsgType == 4) {
          data.reply = msg => {
            if (data.group_id) {
              return Bot[data.self_id].pickGroup(data.group_id).sendMsg(msg)
            } else if (data.user_id) {
              return Bot[data.self_id].pickFriend(data.user_id).sendMsg(msg)
            }
          }
          data.runtime = new Runtime(data)

          const title = _.head(i.data).message
          if (Config.toImgNoTitle && _.isString(title)) {
            const img = await toImg(_.tail(i.data), data, { retType: 'base64' })
            return await makeSendMsg(data, [title, img])
          } else return await toImg(i.data, data)
        } else if (Config.redSendForwardMsgType == 5) {
          const elements = []

          for (const m of i.data) {
            if (Array.isArray(m.message)) {
              const msg = []
              for (const message of m.message) {
                const { msg: element } = await makeSendMsg(data, message)
                msg.push(...element)
              }
              elements.push(msg)
            } else {
              const { msg: element } = await makeSendMsg(data, m.message)
              elements.push(element)
            }
          }

          log += `[转发消息]`
          return { msg: { elementType: 10, elements }, log, node: true }
        }
        break
      case 'button':
        continue
      default:
        logger.warn('[ws-plugin] 未知消息类型:', i)
        i = null
    }
    if (i) msgs.push(i)
  }
  return { msg: msgs, log }
}

async function makeMessage(self_id, payload) {
  if (!payload) return null
  const e = {}
  e.bot = Bot[self_id]
  e.adapter = e.bot.version
  e.post_type = 'message'
  e.user_id = Number(payload.senderUin)
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
  for (const i of payload.elements || []) {
    switch (i.elementType) {
      case 1:
        if (i.textElement.atType == 2) {
          const qq = i.textElement.atUid == '0' ? i.textElement.atNtUin : i.textElement.atUid
          e.message.push({ type: 'at', qq: Number(qq), text: i.textElement.content })
          if (qq == e.self_id) {
            e.atBot = true
          }
        } else if (i.textElement.atType == 1) {
          e.message.push({ type: 'at', qq: 'all', text: i.textElement.content })
        } else if (i.textElement.atType == 0) {
          e.message.push({ type: 'text', text: i.textElement.content })
        }
        e.raw_message += i.textElement.content
        break
      case 2:
        const md5 = i.picElement.md5HexStr
        e.message.push({
          type: 'image',
          url: `https://gchat.qpic.cn/gchatpic_new/0/0-0-${md5.toUpperCase()}/0`,
          file: `${md5}.image`
        })
        e.raw_message += '[图片]'
        break
      case 3:
        if (payload.chatType == 2) break
        const file = await Bot[self_id].sendApi('POST', 'message/fetchRichMedia', JSON.stringify({
          msgId: e.message_id,
          chatType: payload.chatType,
          peerUid: payload.peerUin,
          elementId: i.elementId,
          thumbSize: 0,
          downloadType: 2
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
          size: i.fileElement.fileSize
        })
        e.raw_message += '[文件]'
        break
      case 4:
        e.message.push({
          type: 'record',
          file: i.pttElement.fileName,
          md5: i.pttElement.md5HexStr,
          size: i.pttElement.fileSize
        })
        e.raw_message += '[语音]'
        break
      case 5:
        e.message.push({
          type: 'video',
          name: i.videoElement.fileName,
          fid: i.videoElement.fileUuid,
          md5: i.videoElement.thumbMd5,
          size: i.videoElement.thumbSize
        })
        e.raw_message += '[视频]'
        break
      case 6:
        e.message.push({ type: 'face', id: Number(i.faceElement.faceIndex) })
        e.raw_message += '[表情]'
        break
      case 7:
        // e.message.push({
        //     type: 'reply',
        //     id: `${payload.peerUin}:${i.replyElement.replayMsgSeq}`,
        //     seq: `${payload.peerUin}:${i.replyElement.replayMsgSeq}`,
        // })
        let replyMsg = i.replyElement.sourceMsgTextElems.reduce((acc, item) => acc + item.textElemContent, '')
        const getMsgData = {
          seq: Number(i.replyElement.replayMsgSeq)
        }
        if (payload.chatType == 2) {
          getMsgData.group_id = Number(payload.peerUin)
        } else if (payload.chatType == 1) {
          getMsgData.user_id = e.user_id
        }
        const msg = await getMsg(getMsgData)
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
            break
          case 12:
            const reg = /<nor txt="(.+?)"\s*\/>/
            const text = i.grayTipElement.xmlElement.content.match(new RegExp(reg, 'g'))?.map(i => i.match(reg)[1]).join('')
            if (text.includes('邀请加入了群聊')) {
              const QQReg = /<qq uin="(.*?)" col=".*?" jp="(.*?)" \/>/
              const QQ = i.grayTipElement.xmlElement.content.match(new RegExp(QQReg, 'g')).map(i => i.match(QQReg)[1])
              e.post_type = 'notice'
              e.notice_type = 'group'
              e.sub_type = 'increase'
              e.user_id = Number(QQ[1])
              if (e.user_id == e.self_id) {
                await e.bot.getGroupList()
                if (!e.bot.fl.has(e.group_id)) {
                  e.bot.fl.set(e.group_id, {
                    bot_id: e.self_id,
                    group_id: e.group_id
                  })
                }
              }
            } else if (text.includes('你们已成功添加为好友')) {
              if (e.user_id == 0) {
                e.user_id = Number(payload.peerUin)
              }
              e.post_type = 'notice'
              e.notice_type = 'friend'
              e.sub_type = 'increase'
              await e.bot.getFriendList()
              if (!e.bot.fl.has(e.user_id)) {
                e.bot.fl.set(e.user_id, {
                  bot_id: e.self_id,
                  user_id: e.user_id
                })
              }
            } else if (text.includes('你的账号因系统检测或多人举报涉及业务违规操作')) {
              // 一小时提醒一次
              if (await redis.get(`ws-plugin:warningTips:${e.self_id}`)) {
                break
              }
              await redis.set(`ws-plugin:warningTips:${e.self_id}`, 1, { EX: 60 * 60 })
              const urlReg = /<url jp="(.+?)" col=".*" txt="(.+?)"\s*\/>/
              const match = i.grayTipElement.xmlElement.content.match(urlReg)
              const url = match[1]
              const tip = match[2]
              const content = `[${e.self_id}]${text}${tip}${url}`
              const masterQQ = []
              const master = Version.isTrss ? Config.master[e.self_id] : Config.masterQQ
              if (Config.howToMaster > 0) {
                masterQQ.push(master?.[Config.howToMaster - 1])
              } else if (Config.howToMaster == 0) {
                masterQQ.push(...master)
              }
              for (const i of masterQQ) {
                await e.bot.pickFriend(i).sendMsg(content)
              }
            }
            break
          // jsonGrayTipElement
          case 17:
            break
          default:
            break
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
        break
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
  } else if (payload.group && payload.user1 && payload.user2) {
    // 群系统通知
    e.flag = payload.seq
    e.seq = payload.seq
    e.group_id = payload.group.groupCode
    e.group_name = payload.group.groupName
    e.time = Date.now()
    e.nickname = payload.user1.nickName
    let uin1 = payload.user1.uin, uin2 = payload.user2.uin
    if (payload.user1.uid && !uin1) {
      const uin = await e.bot.getuin(payload.user1.uid)
      if (uin) {
        uin1 = uin
      } else {
        // 不是qq要通知吗
        uin1 = payload.user1.uid
      }
    }
    if (payload.user2.uid && !uin2) {
      const uin = await e.bot.getuin(payload.user2.uid)
      if (uin) {
        uin2 = uin
      } else {
        // 不是qq要通知吗
        uin2 = payload.user2.uid
      }
    }
    switch (payload.type) {
      // 邀请Bot入群
      case 1:
        e.post_type = 'request'
        e.request_type = 'group'
        e.sub_type = 'invite'
        e.user_id = uin2
        e.nickname = payload.user2.nickName
        e.approve = (yes = true) => e.bot.setGroupInvite(e.group_id, e.seq, yes)
        break
      // 邀请好友入群
      case 5:
        e.inviter_id = uin2
      // 申请入群
      case 7:
        e.post_type = 'request'
        e.request_type = 'group'
        e.sub_type = 'add'
        e.comment = payload.postscript
        if (payload.warningTips) {
          e.tips = payload.warningTips
        }
        e.user_id = uin1
        e.approve = (yes = true) => e.bot.setGroupAddRequest(e.seq, yes, '', false, e.group_id)
        break
      // 有人被设置管理
      case 8:
        e.post_type = 'notice'
        e.notice_type = 'group'
        e.sub_type = 'admin'
        e.set = true
        e.user_id = uin1
        break
      // 有人被踢群
      case 9:
        e.operator_id = uin2
      // 有人退群
      case 11:
        e.post_type = 'notice'
        e.notice_type = 'group'
        e.sub_type = 'decrease'
        e.user_id = uin1
        if (!e.operator_id) e.operator_id = e.user_id
        break
      // Bot被取消管理
      case 12:
      // 其他人被取消管理
      case 13:
        e.post_type = 'notice'
        e.notice_type = 'group'
        e.sub_type = 'admin'
        e.set = false
        e.user_id = uin1
        break
      // 群聊被转让
      case 14:
        e.post_type = 'notice'
        e.notice_type = 'group'
        e.sub_type = 'transfer'
        e.operator_id = uin1
        e.user_id = uin2
        break
      default:
        return
    }
    delete e.sender
    delete e.message
    for (const key in e) {
      if (!e[key]) delete e[key]
    }
  } else if (payload.extWords && payload.friendNick && payload.senderUin) {
    e.comment = payload.extWords
    e.nickname = payload.friendNick
    e.post_type = 'request'
    e.request_type = 'friend'
    e.sub_type = 'add'
    e.time = Number(payload.reqTime)
    e.flag = payload.reqTime
    e.seq = payload.reqTime
    e.user_id = Number(payload.senderUin)
    e.approve = (yes) => e.bot.setFriendReq('', yes, '', false, e.user_id)
    delete e.sender
    delete e.message
    for (const key in e) {
      if (!e[key]) delete e[key]
    }
  }
  if (!e.user_id) return null
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
    e.toString = () => e.raw_message
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
    group_id: Number(data.group_id)
  }
  setMsg(sendRet)
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
          break
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
              guildId: null
            },
            msgIds: [sendRet.msgId]
          }))
          let formattedStr = convertFileName(img.picElement.sourcePath)
          elems.push({
            customFace: {
              filePath: formattedStr,
              fileId: randomBytes(2).readUint16BE(),
              serverIp: -1740138629,
              serverPort: 80,
              fileType: 1001,
              useful: 1,
              md5: Buffer.from(img.picElement.md5HexStr, 'hex').toString('base64'),
              imageType: 1001,
              width: img.picElement.picWidth,
              height: img.picElement.picHeight,
              size: img.fileSize,
              origin: 0,
              thumbWidth: 0,
              thumbHeight: 0
              // "pbReserve": [2, 0]
              // "pbReserve": null
            }
          })
          break
        case 'node':
          elems.push(...(await makeNodeMsg(data, i.data)))
          break
        case 'button':
          continue
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
          break
      }
    }
    const element = []
    if (!elems[0].head) {
      element.push({
        head: {
          // field2: Number(data.self_id),
          field8: {
            // field1: Number(data.group_id),
            field4: 'QQ用户' // String(data.bot.nickname)
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
  let fileName = basename(filePath, extname(filePath))

  // 将文件名转换为大写，并按照指定的格式添加短横线
  let convertedName = fileName.toUpperCase().replace(/(.{8})(.{4})(.{4})(.{4})(.{12})/, '$1-$2-$3-$4-$5')

  // 将转换后的文件名和原始扩展名拼接起来
  let newFileName = `{${convertedName}}${extname(filePath)}`

  return newFileName
}

async function toQQRedMsg(self_id, data) {
  data = JSON.parse(data)
  switch (data.type) {
    case 'meta::connect':
      // setTimeout(() => {
      // if (Bot[bot.self_id]?.version) {
      Bot[self_id].version = {
        ...data.payload,
        id: 'QQ',
        red: true
      }
      // }
      // }, 5000)
      break
    case 'message::recv':
      if (Bot[self_id]?.stat?.recv_msg_cnt) {
        Bot[self_id].stat.recv_msg_cnt++
      } else {
        Bot[self_id].stat.recv_msg_cnt = 1
      }
      const payload = data.payload[0]
      const e = await makeMessage(self_id, payload)
      if (!e || (e.post_type === 'message' && e.message.length == 0)) return
      let event = ''
      switch (e.post_type) {
        case 'message':
          if (e.message_type == 'group') {
            logger.info(`${logger.blue(`[${e.self_id}]`)} 群消息：[${e.group_name}(${e.group_id}), ${e.nickname}(${e.user_id})] ${e.raw_message}`)
            if (!Bot[self_id].gml.has(Number(e.group_id))) {
              Bot[self_id].gml.set(Number(e.group_id), new Map())
            }
            if (!Bot[self_id].gml.get(Number(e.group_id)).has(Number(e.user_id))) {
              Bot[self_id].gml.get(Number(e.group_id)).set(Number(e.user_id), {
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
            if (!Bot[self_id].fl.has(Number(e.user_id))) {
              Bot[self_id].fl.set(Number(e.user_id), {
                bot_id: e.self_id,
                user_id: e.user_id,
                nickname: e.nickname
              })
            }
          }
          setMsg({
            message_id: e.message_id,
            seq: Number(e.seq),
            rand: Number(e.rand),
            user_id: Number(e.user_id),
            time: Number(e.time),
            group_id: Number(e.group_id)
          })
          event = `${e.post_type}.${e.message_type}.${e.sub_type}`
          break
        case 'notice':
          event = `${e.post_type}.${e.notice_type}.${e.sub_type}`
          break
        case 'request':
          switch (e.request_type) {
            case 'group':
              logger.info(`${logger.blue(`[${e.self_id}]`)} 群邀请：[${e.group_name}(${e.group_id})] 邀请人：[${e.nickname}(${e.user_id})]`)
              break
            case 'friend':
              logger.info(`${logger.blue(`[${e.self_id}]`)} 好友申请：[${e.nickname}(${e.user_id})]`)
              break
            default:
              return
          }
          event = `${e.post_type}.${e.request_type}.${e.sub_type}`
          break
        default:
          return
      }
      if (Version.isTrss) {
        Bot.em(event, e)
      } else {
        e.bot.self_id = e.self_id
        while (true) {
          Bot.emit(event, e)
          const i = event.lastIndexOf('.')
          if (i == -1) break
          event = event.slice(0, i)
        }
      }
      break
    default:
      break
  }
}

// 不想用Config读,免得和主分支冲突
function getConfig(key) {
  let defConfig, config
  try {
    defConfig = YAML.parse(
      fs.readFileSync('./plugins/ws-plugin/config/default_config/red.yaml', 'utf8')
    )[key]
    config = YAML.parse(
      fs.readFileSync('./plugins/ws-plugin/config/config/red.yaml', 'utf8')
    )[key]
  } catch (error) { }
  return config || defConfig
}

// 默认删除red upload的文件
const redTempPath = redPath + '/redprotocol-upload'

schedule.scheduleJob(getConfig('deleteDirCron'), () => {
  let deleteDir = getConfig('deleteDir')
  if (deleteDir) {
    if (!Array.isArray(deleteDir)) deleteDir = [deleteDir]
    for (const i of deleteDir) {
      deleteFolder(i, true)
    }
  }
  deleteFolder(redTempPath, true)
})

export {
  makeSendMsg,
  toQQRedMsg,
  makeMessage
}

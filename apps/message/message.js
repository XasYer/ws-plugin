import { sendSocketList, Config, Version } from '../../components/index.js'
import { makeOneBotReportMsg, makeGSUidReportMsg, setLatestMsg, setMsg, getGroup_id, getUser_id } from '../../model/index.js'
import _ from 'lodash'
import cfg from '../../../../lib/config/config.js'

Bot.on('message', async e => {
  if (!e.user_id) return false
  // 被禁言或者全体禁言
  if (Config.muteStop && (e.group?.mute_left > 0 || e.group?.all_muted)) return false
  // 临时会话
  if (Config.tempMsgReport && e.post_type === 'post_type' && e.message_type === 'private' && e.sub_type === 'group') return false
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
  const time = (new Date(e.time)).getTime() || Math.floor(Date.now() / 1000)
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
      }
    }
  }
  if (e.guild_id || e.bot?.adapter?.id === 'QQBot' || e.bot?.adapter?.id === 'QQGuild' || e.adapter == 'QQBot' || e.adapter == 'QQGuild') {
    setLatestMsg(e.group_id || e.user_id, { time, message_id: e.message_id, reply: e.reply })
  }
  let userInfo
  // 增加isGroup e.isPrivate
  if (e.message_type == 'group') {
    msg.isGroup = true
    const group_id = await getGroup_id({ group_id: e.group_id })
    msg.group_id = e.group_id
    msg.param.group_id = group_id
    userInfo = await e.bot?.pickMember?.(e.group_id, e.user_id)
  } else if (e.message_type == 'private') {
    userInfo = await e.bot?.pickFriend?.(e.user_id)
    msg.isPrivate = true
  } else {
    return false
  }
  const avatar = await userInfo?.getAvatarUrl?.()
  if (avatar) {
    msg.param.avatar = avatar
    msg.avatar = avatar
  }
  // 判断云崽前缀
  msg = onlyReplyAt(msg, 'yz')
  if (!msg) return false
  for (const i of sendSocketList) {
    if (i.status == 1) {
      msg.onlyReplyAt = Config.onlyReplyAt[i.other.rawName || i.name] || Config.onlyReplyAt
      const tmpMsg = onlyReplyAt(_.cloneDeep(msg), 'ws')
      if (!tmpMsg) continue
      let reportMsg = null
      switch (Number(i.type)) {
        case 1:
        case 2:
        case 6:
          if (i.uin != e.self_id) continue
          e.reply = reply(e)
          tmpMsg.messagePostFormat = i.other?.messagePostFormat || Config.messagePostFormat
          reportMsg = await makeOneBotReportMsg(tmpMsg)
          break
        case 3: {
          let botid = i.adapter?.gsBotId
          if (i.uin === 'all') {
            botid = {
              QQBot: 'qqgroup',
              QQGuild: 'qqguild',
              KOOK: 'kook',
              Telegram: 'telegram',
              Discord: 'discord'
            }[e.bot?.adapter?.id] || 'onebot'
          } else if (i.uin != e.self_id) continue
          reportMsg = await makeGSUidReportMsg(tmpMsg, botid)
          break
        }
        default:
          break
      }
      if (reportMsg) i.ws.send(reportMsg)
    }
  }
})

function reply (e) {
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
          onebot_id: Math.floor(Math.random() * Math.pow(2, 32)) | 0
        })
      }
      return ret
    }
  } else {
    if (e.bot?.version?.name == 'ICQQ') {
      let replyNew
      if (e.reply) {
        replyNew = e.reply
      } else {
        replyNew = msg => {
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
      }
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
            onebot_id: Math.floor(Math.random() * Math.pow(2, 32)) | 0
          })
        }
        return ret
      }
    }
    // 暂时先不处理其他协议
    return e.reply
  }
}

function onlyReplyAt (e, type) {
  if (!e.message) return false

  if (type === 'yz') {
    let groupCfg = Version.isTrss ? cfg.getGroup(e.self_id, e.group_id) : cfg.getGroup(e.group_id)
    if (groupCfg.onlyReplyAt == 0 || !groupCfg.botAlias) return e
    if (groupCfg.onlyReplyAt === 2 && e.isMaster) return e
    if (e.isPrivate) return e

    if (Config.ignoreOnlyReplyAt) {
      return rmAlias(e, groupCfg)
    }
    if (atBot(e)) {
      e.atBot = true
      return e
    }
    e = hasAlias(e, groupCfg)
    if (e) return e
  } else if (type === 'ws') {
    if (!e.onlyReplyAt.enable) {
      return e
    }
    if (atBot(e)) {
      return e
    }
    e = hasAlias(e, { botAlias: e.onlyReplyAt.prefix })
    if (e) return e
  }

  return false
}

function atBot (e) {
  for (const i of e.message) {
    if (i.type === 'at') {
      if (i.qq == e.self_id) return true
    }
  }
  return false
}

function hasAlias (e, groupCfg) {
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

function rmAlias (e, groupCfg) {
  let alias = groupCfg.botAlias
  if (!Array.isArray(alias)) {
    alias = [alias]
  }
  for (let name of alias) {
    for (const i in e.message) {
      if (e.message[i].type === 'text') {
        if (e.message[i].text?.startsWith(name)) {
          e.message[i].text = _.trimStart(e.message[i].text, name).trim()
        }
        break
      }
    }
  }
  return e
}

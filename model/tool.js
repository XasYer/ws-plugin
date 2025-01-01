/* eslint-disable no-sequences */
/* eslint-disable no-unused-expressions */
import _ from 'lodash'
import fs from 'fs'
import { Version, Render, Config } from '../components/index.js'
import { join } from 'path'
import { randomUUID } from 'crypto'
import { Stream } from 'stream'
import fetch from 'node-fetch'
import schedule from 'node-schedule'

async function CreateMusicShare (data) {
  let appid; let appname; let appsign; let style = 4
  switch (data.subType) {
    case 'bilibili':
      appid = 100951776, appname = 'tv.danmaku.bili', appsign = '7194d531cbe7960a22007b9f6bdaa38b'
      break
    case 'netease':
      appid = 100495085, appname = 'com.netease.cloudmusic', appsign = 'da6b069da1e2982db3e386233f68d76d'
      break
    case 'kuwo':
      appid = 100243533, appname = 'cn.kuwo.player', appsign = 'bf9ff4ffb4c558a34ee3fd52c223ebf5'
      break
    case 'kugou':
      appid = 205141, appname = 'com.kugou.android', appsign = 'fe4a24d80fcf253a00676a808f62c2c6'
      break
    case 'migu':
      appid = 1101053067, appname = 'cmccwm.mobilemusic', appsign = '6cdc72a439cef99a3418d2a78aa28c73'
      break
    case 'qq':
    default:
      appid = 100497308, appname = 'com.tencent.qqmusic', appsign = 'cbd27cd7c861227d013a25b2d10f0799'
      break
  }

  let text = ''; let title = data.title; let singer = data.content; let prompt = '[分享]'; let jumpUrl = data.url; let preview = data.image; let musicUrl = data.voice

  prompt = '[分享]' + title + '-' + singer

  let recv_uin = 0
  let send_type = 0
  let recv_guild_id = 0

  if (data.message_type === 'group') { // 群聊
    recv_uin = data.group_id
    send_type = 1
  } else if (data.message_type === 'guild') { // 频道
    recv_uin = Number(data.channel_id)
    recv_guild_id = BigInt(data.guild_id)
    send_type = 3
  } else if (data.message_type === 'private') { // 私聊
    recv_uin = data.user_id
    send_type = 0
  }

  let body = {
    1: appid,
    2: 1,
    3: style,
    5: {
      1: 1,
      2: '0.0.0',
      3: appname,
      4: appsign
    },
    6: text,
    10: send_type,
    11: recv_uin,
    12: {
      10: title,
      11: singer,
      12: prompt,
      13: jumpUrl,
      14: preview,
      16: musicUrl
    },
    19: recv_guild_id
  }
  return body
}

async function SendMusicShare (data) {
  let core, bot
  if (Version.isTrss) {
    bot = Bot[data.bot_id]
    core = bot?.core
  } else {
    bot = Bot
    try {
      core = (await import('oicq')).core
    } catch (error) {
      core = null
    }
  }
  if (!core) {
    const msg = [data.url]
    if (data.message_type === 'group') { // 群聊
      await bot?.pickGroup?.(data.group_id)?.sendMsg?.(msg)
    } else if (data.message_type === 'private') { // 私聊
      await bot?.pickFriend?.(data.user_id)?.sendMsg?.(msg)
    }
    return
  }
  try {
    let body = await CreateMusicShare(data)
    let payload = await bot.sendOidb('OidbSvc.0xb77_9', core.pb.encode(body))
    let result = core.pb.decode(payload)
    if (result[3] != 0) {
      if (data.message_type === 'group') { // 群聊
        await bot?.pickGroup(data.group_id).sendMsg('歌曲分享失败：' + result[3])
      } else if (data.message_type === 'private') { // 私聊
        await bot?.pickFriend(data.user_id).sendMsg('歌曲分享失败：' + result[3])
      }
      // e.reply('歌曲分享失败：' + result[3], true);
    }
  } catch (error) {
    const msg = [data.url]
    if (data.message_type === 'group') { // 群聊
      await bot?.pickGroup?.(data.group_id)?.sendMsg?.(msg)
    } else if (data.message_type === 'private') { // 私聊
      await bot?.pickFriend?.(data.user_id)?.sendMsg?.(msg)
    }
  }
}

function sleep (ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

const TMP_DIR = process.cwd() + '/plugins/ws-plugin/Temp'
if (!fs.existsSync(TMP_DIR)) fs.mkdirSync(TMP_DIR)

schedule.scheduleJob('0 0 0 * * ?', function () {
  logger.mark('[ws-plugin] 执行定时任务: 删除Temp')
  try {
    const files = fs.readdirSync(TMP_DIR)
    for (const file of files) {
      fs.unlink(join(TMP_DIR, file), () => { })
    }
  } catch (error) { }
})

const mimeTypes = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpg',
  '.gif': 'image/gif',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
}

function decodeHtml (html) {
  let map = {
    '&amp;': '&',
    '&#91;': '[',
    '&#93;': ']',
    '&#44;': ','
  }

  for (let key in map) {
    const value = map[key]
    const regex = new RegExp(key, 'g')
    html = html.replace(regex, value)
  }
  return html
}

const QRCode = await (async function () {
  try {
    return await import('qrcode')
  } catch (error) {
    return false
  }
})()

const toQRCodeRegExp = /https?:\/\/[\w\-_]+(\.[\w\-_]+)+([\w\-.,@?^=%&:/~+#]*[\w\-@?^=%&/~+#])?/g

async function makeQRCode (data) {
  return (await QRCode.toDataURL(data)).replace('data:image/png;base64,', 'base64://')
}

const htmlCache = {}
let id = 1

/**
 * 将转发消息渲染成图片并发送,data为makeForwordMsg.data
 * @param {Object} data makeForwordMsg.data
 * @param {{user_id:number,nickname:string,reply:function}} e 直接丢e即可
 * @param cfg 渲染配置
 * @param cfg.retype
 * * default/空：自动发送图片，返回true
 * * msgId：自动发送图片，返回msg id
 * * base64: 不自动发送图像，返回图像base64数据
 * @param {boolean} cfg.returnID 返回ws查看对应id, 默认不返回
 */
async function toImg (data, e, cfg = { retType: 'msgId', toQRCode: true, defToText: true }) {
  let isNode = false
  if (e.wsCacheIsNode) {
    isNode = e.wsCacheIsNode
    delete e.wsCacheIsNode
  }
  let html = []
  let wsids = []
  const user_id = e.bot?.uin || e.bot?.user_id || e.user_id || 10000
  const nickname = e.bot?.nickname || e.nickname || '^_^'
  if (!Array.isArray(data)) data = [data]
  for (let i of data) {
    if (!i) continue
    if (typeof i === 'string') i = { type: 'text', text: i }
    let message = '<div class="text">'
    if (Config.toImgID != 0) {
      message += `<span class="id">ID: ${id}</span>`
    }
    let node
    if (typeof i.message === 'string') i.message = { type: 'text', text: i.message || i.text }
    if (!i.message) i.message = { ...i }
    if (!Array.isArray(i.message)) i.message = [i.message]
    let img = 0; let text = 0; let OriginalMessage = []
    for (let m of i.message) {
      if (typeof m === 'string') m = { type: 'text', text: m }
      message += '<div>'
      OriginalMessage.push(m)
      switch (m.type) {
        case 'text':
          if (cfg.toQRCode && QRCode) {
            const match = m.text.match(toQRCodeRegExp)
            if (match) {
              for (const url of match) {
                const qrcode = await makeQRCode(url)
                m.text = m.text.replace(url, `${url}<br/><img src="${await saveImg(qrcode)}" /><br/>`)
              }
            }
          }
          message += m.text.replace(/\n/g, '<br />')
          text++
          break
        case 'image':
          message += `<img src="${await saveImg(m.file || m.url)}" />`
          img++
          break
        case 'node':
          e.wsCacheIsNode = true
          node = await toImg(m.data, e)
          break
        case 'button':
          message = message.replace(/<div>$/, '')
          OriginalMessage.pop()
          continue
        default:
          if (cfg.defToText) {
            message += JSON.stringify(m, null, '<br />')
            text++
          }
          break
      }
      message += '</div>'
    }
    message += '</div>'
    if (Config.toImgID != 0) {
      htmlCache[id] = OriginalMessage
    }
    wsids.push(id)
    id++
    if (node) {
      html.push(...node)
    } else {
      let uin = i.uin || (!i.user_id || i.user_id == 88888) ? user_id : i.user_id
      if (Array.isArray(uin)) uin = user_id
      const avatar = i.avatar || `https://q1.qlogo.cn/g?b=qq&s=0&nk=${uin}`
      const path = join(TMP_DIR, `${uin}.png`)
      if (!fs.existsSync(path)) {
        const img = await fetch(avatar)
        const arrayBuffer = await img.arrayBuffer()
        const buffer = Buffer.from(arrayBuffer)
        fs.writeFileSync(path, buffer)
      }
      // 只有一张图片
      if (img === 1 && text === 0) {
        message = message.replace('<div class="text">', '<div class="img">')
      }
      if (!isNode && html.length == 0 && Config.toImgID == 2) {
        html.push({
          avatar: `<img src="${path}" />`,
          nickname: i.nickname || nickname,
          message: '<div class="text"><div>可输入#ws查看+ID 查看对应消息</div></div>'
        })
      }
      html.push({
        avatar: `<img src="${path}" />`,
        nickname: i.nickname || nickname,
        message
      })
    }
  }
  if (!isNode) {
    const configPath = process.cwd() + '/plugins/ws-plugin/resources/chatHistory'
    let config
    if (fs.existsSync(`${configPath}/config.js`)) {
      config = await import(`file://${configPath}/config.js`)
    } else {
      config = await import(`file://${configPath}/config_default.js`)
    }
    const allTHeme = fs.readdirSync(configPath).filter(files => {
      const fullPath = join(configPath, files)
      const stat = fs.statSync(fullPath)
      if (stat.isDirectory()) {
        return fullPath
      } else {
        return false
      }
    })
    let target = 'default'
    if (typeof config.theme === 'string') {
      if (config.theme === 'all') {
        target = allTHeme[_.random(0, allTHeme.length - 1)]
      } else {
        target = config.theme
      }
    } else if (Array.isArray(config.theme)) {
      target = config.theme[_.random(0, config.theme.length - 1)]
    }
    let render = await Render.render(
            `chatHistory/${target}/index`,
            { data: html, target },
            { e, scale: 1.2, ...cfg }
    )
    return cfg.returnID ? { render, wsids } : render
  }
  return html
}

async function saveImg (data) {
  let buffer
  if (data instanceof Stream.Readable) {
    buffer = fs.readFileSync(data.path)
  } if (Buffer.isBuffer(data)) {
    buffer = data
  } else if (data.match(/^base64:\/\//)) {
    buffer = Buffer.from(data.replace(/^base64:\/\//, ''), 'base64')
  } else if (data.startsWith('http')) {
    const img = await fetch(data)
    const arrayBuffer = await img.arrayBuffer()
    buffer = Buffer.from(arrayBuffer)
  } else if (data.startsWith('file://')) {
    try {
      buffer = fs.readFileSync(data.replace(/^file:\/\//, ''))
    } catch (error) {
      buffer = fs.readFileSync(data.replace(/^file:\/\/\//, ''))
    }
  } else if (/^.{32}\.image$/.test(data)) {
    const img = await fetch(`https://gchat.qpic.cn/gchatpic_new/0/0-0-${data.replace('.image', '').toUpperCase()}/0`)
    const arrayBuffer = await img.arrayBuffer()
    buffer = Buffer.from(arrayBuffer)
  } else {
    buffer = fs.readFileSync(data)
  }
  let path = join(TMP_DIR, `${randomUUID({ disableEntropyCache: true })}.png`)
  fs.writeFileSync(path, buffer)
  return path
}

/**
 * 删除指定路径下的所有文件
 * @param {string} directoryPath 文件夹绝对路径或对于云崽的相对路径
 * @param {boolean} keepDirectory 是否保留传入的文件夹
 */
function deleteFolder (directoryPath, keepDirectory = false) {
  try {
    if (fs.existsSync(directoryPath)) {
      fs.readdirSync(directoryPath).forEach((file) => {
        const curPath = join(directoryPath, file)
        if (fs.lstatSync(curPath).isDirectory()) {
          deleteFolder(curPath)
        } else {
          try {
            fs.unlinkSync(curPath)
          } catch (error) {
            logger.error(`[ws-plugin] 删除文件失败: ${curPath}`, error)
          }
        }
      })

      if (!keepDirectory) {
        try {
          fs.rmdirSync(directoryPath)
        } catch (error) {
          logger.error(`[ws-plugin] 删除文件夹失败: ${directoryPath}`, error)
        }
      }
    }
  } catch (error) {
    logger.error('[ws-plugin] 删除文件失败', error)
  }
}

export {
  SendMusicShare,
  sleep,
  TMP_DIR,
  mimeTypes,
  decodeHtml,
  toImg,
  htmlCache,
  deleteFolder
}

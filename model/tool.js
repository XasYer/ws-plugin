import _ from 'lodash'
import fs from 'fs'
import { Version, Render } from '../components/index.js'
import Runtime from '../../../lib/plugins/runtime.js'
import { join } from 'path'
import { randomUUID } from 'crypto'
import { Stream } from "stream"
import fetch from 'node-fetch'
import schedule from "node-schedule"

async function CreateMusicShare(data) {
    let appid, appname, appsign, style = 4;
    switch (data.subType) {
        case 'bilibili':
            appid = 100951776, appname = 'tv.danmaku.bili', appsign = '7194d531cbe7960a22007b9f6bdaa38b';
            break;
        case 'netease':
            appid = 100495085, appname = "com.netease.cloudmusic", appsign = "da6b069da1e2982db3e386233f68d76d";
            break;
        case 'kuwo':
            appid = 100243533, appname = "cn.kuwo.player", appsign = "bf9ff4ffb4c558a34ee3fd52c223ebf5";
            break;
        case 'kugou':
            appid = 205141, appname = "com.kugou.android", appsign = "fe4a24d80fcf253a00676a808f62c2c6";
            break;
        case 'migu':
            appid = 1101053067, appname = "cmccwm.mobilemusic", appsign = "6cdc72a439cef99a3418d2a78aa28c73";
            break;
        case 'qq':
        default:
            appid = 100497308, appname = "com.tencent.qqmusic", appsign = "cbd27cd7c861227d013a25b2d10f0799";
            break;
    }

    var text = '', title = data.title, singer = data.content, prompt = '[分享]', jumpUrl = data.url, preview = data.image, musicUrl = data.voice;

    prompt = '[分享]' + title + '-' + singer;

    let recv_uin = 0;
    let send_type = 0;
    let recv_guild_id = 0;

    if (data.message_type === 'group') {//群聊
        recv_uin = data.group_id;
        send_type = 1;
    } else if (data.message_type === 'guild') {//频道
        recv_uin = Number(data.channel_id);
        recv_guild_id = BigInt(data.guild_id);
        send_type = 3;
    } else if (data.message_type === 'private') {//私聊
        recv_uin = data.user_id;
        send_type = 0;
    }

    let body = {
        1: appid,
        2: 1,
        3: style,
        5: {
            1: 1,
            2: "0.0.0",
            3: appname,
            4: appsign,
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
            16: musicUrl,
        },
        19: recv_guild_id
    };
    return body;
}

async function SendMusicShare(data) {
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
        if (data.message_type === 'group') {//群聊
            await bot?.pickGroup?.(data.group_id)?.sendMsg?.(msg)
        } else if (data.message_type === 'private') {//私聊
            await bot?.pickFriend?.(data.user_id)?.sendMsg?.(msg)
        }
        return
    }
    try {
        let body = await CreateMusicShare(data)
        let payload = await bot.sendOidb("OidbSvc.0xb77_9", core.pb.encode(body));
        let result = core.pb.decode(payload);
        if (result[3] != 0) {
            if (data.message_type === 'group') {//群聊
                await bot?.pickGroup(data.group_id).sendMsg('歌曲分享失败：' + result[3])
            } else if (data.message_type === 'private') {//私聊
                await bot?.pickFriend(data.user_id).sendMsg('歌曲分享失败：' + result[3])
            }
            // e.reply('歌曲分享失败：' + result[3], true);
        }
    } catch (error) {
        const msg = [data.url]
        if (data.message_type === 'group') {//群聊
            await bot?.pickGroup?.(data.group_id)?.sendMsg?.(msg)
        } else if (data.message_type === 'private') {//私聊
            await bot?.pickFriend?.(data.user_id)?.sendMsg?.(msg)
        }
        return
    }
}

function sleep(ms) {
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
});

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
    '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
}

function decodeHtml(html) {
    var map = {
        '&amp;': '&',
        '&#91;': '[',
        '&#93;': ']',
        '&#44;': ','
    };

    for (var key in map) {
        const value = map[key];
        const regex = new RegExp(key, 'g');
        html = html.replace(regex, value);
    }
    return html;
}

const htmlCache = {}
let id = 1

/**
 * 将转发消息渲染成图片,data为makeForwordMsg.data
 * @param {Object} data makeForwordMsg.data 
 * @param {{user_id:number,nickname:string,reply:function}} e 直接丢e即可
 * @param {boolean} send 是否发送,默认true
 * @param {boolean} isNode 默认为false即可
 */
async function toImg(data, e, send = true, isNode = false) {
    let html = []
    const user_id = e.bot.uin || e.bot.user_id || e.user_id
    const nickname = e.bot.nickname || e.nickname
    if (!Array.isArray(data)) data = [data]
    for (const i of data) {
        let message = '<div class="text">'
        message += `<span class="id">ID: ${id}</span>`
        let node
        if (typeof i.message === 'string') i.message = { type: 'text', text: i.message }
        if (!Array.isArray(i.message)) i.message = [i.message]
        let img = 0, text = 0, OriginalMessage = []
        for (let m of i.message) {
            if (typeof m === 'string') m = { type: 'text', text: m }
            message += '<div>'
            OriginalMessage.push(m)
            switch (m.type) {
                case 'text':
                    message += m.text.replace(/\n/g, '<br />')
                    text++
                    break;
                case 'image':
                    message += `<img src="${await saveImg(m.file || m.url)}" />`
                    img++
                    break;
                case 'node':
                    node = await toImg(m.data, e, false, true)
                    break
                default:
                    message += JSON.stringify(m, null, '<br />')
                    text++
                    break;
            }
            message += '</div>'
        }
        message += '</div>'
        htmlCache[id] = OriginalMessage
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
            if (!isNode && html.length == 0) {
                html.push({
                    avatar: `<img src="${path}" />`,
                    nickname: i.nickname || nickname,
                    message: `<div class="text"><div>可输入#ws查看+ID 查看对应消息</div></div>`
                })
            }
            html.push({
                avatar: `<img src="${path}" />`,
                nickname: i.nickname || nickname,
                message
            })
        }
    }
    if (send) {
        const configPath = process.cwd() + '/plugins/ws-plugin/resources/chatHistory'
        let config
        if (fs.existsSync(`${configPath}/config.js`)) {
            config = await import(`file://${configPath}/config.js`)
        } else {
            config = await import(`file://${configPath}/config_default.js`)
        }
        const allTHeme = fs.readdirSync(configPath).filter(files => {
            const fullPath = join(configPath, files);
            const stat = fs.statSync(fullPath);
            if (stat.isDirectory()) {
                return fullPath
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
        return await Render.render(`chatHistory/${target}/index`, {
            data: html,
            target
        }, { e, scale: 1.2, retMsgId: true })
    }
    return html
}

async function saveImg(data) {
    let buffer
    if (data instanceof Stream.Readable) {
        buffer = fs.readFileSync(data.path)
    } if (Buffer.isBuffer(data)) {
        buffer = data
    } else if (data.match(/^base64:\/\//)) {
        buffer = Buffer.from(data.replace(/^base64:\/\//, ""), 'base64')
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
function deleteFolder(directoryPath, keepDirectory = false) {
    try {
        if (fs.existsSync(directoryPath)) {
            fs.readdirSync(directoryPath).forEach((file) => {
                const curPath = join(directoryPath, file)
                if (fs.lstatSync(curPath).isDirectory()) {
                    deleteFolder(curPath)
                } else {
                    fs.unlinkSync(curPath)
                }
            });
            if (!keepDirectory) {
                fs.rmdirSync(directoryPath)
            }
        }
    } catch (error) {
        logger.error(`[ws-plugin] 删除文件失败`, error)
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
import _ from 'lodash'
import fs from 'fs'
import { Version } from '../components/index.js'

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


export {
    SendMusicShare,
    sleep,
    TMP_DIR,
    mimeTypes,
    decodeHtml
}
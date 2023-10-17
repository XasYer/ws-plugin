import fs from 'node:fs'
import { initWebSocket, Config, Version } from './components/index.js'
import { TMP_DIR, mimeTypes } from './model/index.js'
import { join, extname } from 'path'

const files = fs.readdirSync('./plugins/ws-plugin/apps').filter(file => file.endsWith('.js'))

let ret = []

logger.info('-----------------')
logger.info(`ws-plugin${Version.version}插件初始化~`)


files.forEach((file) => {
    ret.push(import(`./apps/${file}`))
})

ret = await Promise.allSettled(ret)

let apps = {}
for (let i in files) {
    let name = files[i].replace('.js', '')

    if (ret[i].status != 'fulfilled') {
        logger.error(`载入插件错误：${logger.red(name)}`)
        logger.error(ret[i].reason)
        continue
    }
    apps[name] = ret[i].value[Object.keys(ret[i].value)[0]]
}
let path = ['./apps/message/message.js', './apps/notice/notice.js', './apps/request/request.js']
for (const item of path) {
    try {
        await import(`${item}`)
    } catch (e) {
        logger.error(`载入事件错误：${item}`)
        logger.error(e)
    }
}

initWebSocket()
if (Version.isTrss) {
    Bot.express.get('/ws-plugin*', async (req, res) => {
        const file = req.query.file
        if (file) {
            const ext = extname(file)
            const contentType = mimeTypes[ext]
            fs.readFile(join(TMP_DIR, file), (err, content) => {
                if (err) {
                    res.writeHead(404)
                    res.end('File not found')
                } else {
                    const name = file.split('-')
                    const filename = encodeURIComponent(name[1]) || encodeURIComponent(name[0]) || encodeURIComponent(file)
                    res.writeHead(200, {
                        'Content-Type': contentType,
                        'Content-Disposition': `attachment; filename=${filename}`
                    })
                    res.end(content)
                }
            })
            return
        }
        res.writeHead(404)
        res.end('Page not found')
    })
} else {
    const getGroupMemberInfo = Bot.getGroupMemberInfo
    /** 劫持修改getGroupMemberInfo方法 */
    Bot.getGroupMemberInfo = async function (group_id, user_id) {
        let result
        try {
            result = await getGroupMemberInfo.call(this, group_id, user_id)
        } catch (error) {
            let nickname
            if (error.stack.includes('ws-plugin')) {
                nickname = 'chronocat'
            } else {
                nickname = String(group_id).includes("qg_") ? "QQGuild-Bot" : "WeChat-Bot"
            }
            result = {
                group_id,
                user_id,
                nickname,
                card: "",
                sex: "female",
                age: 6,
                join_time: "",
                last_sent_time: "",
                level: 1,
                role: "member",
                title: "",
                title_expire_time: "",
                shutup_time: 0,
                update_time: "",
                area: "南极洲",
                rank: "潜水",
            }
        }
        return result
    }
}

export { apps }

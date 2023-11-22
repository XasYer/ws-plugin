import fs from 'node:fs'
import { initWebSocket, Config, Version } from './components/index.js'
import { TMP_DIR, mimeTypes } from './model/index.js'
import { extname, join } from 'path'
import express from "express"
import http from "http"

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

if (Version.isTrss) {
    Bot.express.get('/ws-plugin*', createHttp)
} else {
    const getGroupMemberInfo = Bot.getGroupMemberInfo
    /** 劫持修改getGroupMemberInfo方法 */
    Bot.getGroupMemberInfo = async function (group_id, user_id) {
        let result
        try {
            result = await getGroupMemberInfo.call(this, group_id, user_id)
        } catch (error) {
            result = {
                group_id,
                user_id,
                nickname: 'QQ用户',
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
    const _express = express();
    const server = http.createServer(_express);
    _express.get('/ws-plugin*', createHttp)
    server.listen(Config.wsPort, () => {
        const host = 'localhost'
        const port = Config.wsPort
        logger.mark(`[ws-plugin] 启动 HTTP 服务器：${logger.green(`http://[${host}]:${port}`)}`)
    })
    server.on('error', () => {
        const host = 'localhost'
        const port = Config.wsPort
        logger.error(`[ws-plugin] 启动 HTTP 服务器失败：${logger.green(`http://[${host}]:${port}`)}`)
        logger.error(error)
    })
}

function deleteFolderRecursive(directoryPath) {
    if (fs.existsSync(directoryPath)) {
        fs.readdirSync(directoryPath).forEach((file) => {
            const curPath = join(directoryPath, file)
            if (fs.lstatSync(curPath).isDirectory()) {
                deleteFolderRecursive(curPath)
            } else {
                fs.unlinkSync(curPath)
            }
        })
        fs.rmdirSync(directoryPath)
    }
}
deleteFolderRecursive('./plugins/ws-plugin/model/dlc')

initWebSocket()
async function createHttp(req, res) {
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
                    'Content-Disposition': `attachment filename=${filename}`
                })
                res.end(content)
            }
        })
        return
    }
    res.writeHead(404)
    res.end('Page not found')
}
export { apps }

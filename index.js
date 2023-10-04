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

try {
    if (!global.segment) {
        global.segment = (await import('oicq')).segment
    }
    if (!Version.isTrss) {
        if (!global.core) {
            global.core = (await import('oicq')).core;
        }
    }
} catch (error) {

}
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
                    res.writeHead(200, {
                        'Content-Type': contentType,
                        'Content-Disposition': `attachment; filename=${name[1] || name[0]}`
                    })
                    res.end(content)
                }
            })
            return
        }
        res.writeHead(404);
        res.end('Page not found')
    })
}

export { apps }

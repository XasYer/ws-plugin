import fs from 'node:fs'
import { initWebSocket, Config, Version } from './components/index.js'

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
    Bot.once('online', () => {
        initWebSocket()
    })
} else {
    setTimeout(() => {
        initWebSocket()
    }, 1000 * 10)
}

export { apps }

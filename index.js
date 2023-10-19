import fs from 'node:fs'
import { initWebSocket, Config, Version } from './components/index.js'
import { join, basename, extname } from 'path'
import { pathToFileURL } from 'url'

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

const dirPath = join(process.cwd(), 'plugins', 'ws-plugin', 'model');
fs.readdirSync(dirPath).forEach(file => {
    const filePath = join(dirPath, file)
    if (fs.statSync(filePath).isDirectory() && !['db'].includes(file)) {
        fs.readdirSync(filePath).forEach(async i => {
            if (basename(i, extname(i)) === 'index') {
                try {
                    await import(pathToFileURL(join(filePath, i)))
                } catch (error) {
                    logger.error(error)
                }
            }
        })
    }
})

initWebSocket()

export { apps }

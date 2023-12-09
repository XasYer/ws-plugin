import { findGroup_id, findUser_id, findMessage_id } from '../model/db/index.js'
import moment from 'moment'

const reg = new RegExp('^#ws查询\s*(.+)$')

export class findDB extends plugin {
    constructor() {
        super({
            name: '[ws-plugin] 查询数据库',
            dsc: '[ws-plugin] 查询数据库',
            event: 'message',
            priority: 1,
            rule: [
                {
                    reg,
                    fnc: 'findDB'
                }
            ]
        })

    }
    async findDB(e) {
        if (!e.isMaster) {
            return false
        }
        const regRet = reg.exec(e.msg)
        const args = regRet[1].split(' ')
        let result, callback
        const type = args.shift()
        switch (type) {
            case 'g':
            case '-g':
            case 'group':
                callback = data => findGroup_id(data)
                break
            case 'u':
            case '-u':
            case 'user':
                callback = data => findUser_id(data)
                break
            case 'm':
            case '-m':
            case 'msg':
            case 'msg_id':
                callback = data => findMessage_id(data)
                break
            default:
                return false
        }
        const where = args.reduce((acc, item) => {
            let [key, value] = item.split("=")
            if (key) acc[key] = value
            return acc
        }, {})
        try {
            result = await callback(where)
        } catch (error) {
            logger.error('[ws-plugin]', error)
            e.reply(`执行失败: ${error.message}`, true)
            return false
        }
        if (result) {
            result.createdAt = moment(result.createdAt).utcOffset(8).format('YYYY-MM-DD HH:mm:ss')
            result.updatedAt = moment(result.updatedAt).utcOffset(8).format('YYYY-MM-DD HH:mm:ss')
        }
        const str = Object.entries(result).map(([key, value]) => `${key}: ${value}`).join('\n')
        e.reply(str, true)
        return true
    }

}
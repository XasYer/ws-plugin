import { htmlCache } from '../model/index.js'

const reg = new RegExp('^#ws查看\s*([0-9]+)$')

export class getMsg extends plugin {
    constructor() {
        super({
            name: '[ws-plugin] 用户信息',
            dsc: '[ws-plugin] 用户信息',
            event: 'message',
            priority: 1,
            rule: [
                {
                    reg,
                    fnc: 'getMsg'
                }
            ]
        })

    }
    async getMsg(e) {
        const id = reg.exec(e.msg)
        const msg = htmlCache[id[1]]
        if (msg) {
            e.reply(msg)
        }
        return true
    }

}
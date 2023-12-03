import { getGroup_id, getUser_id, setGroup_id, setUser_id } from '../model/index.js'

const setReg = new RegExp('^#ws修改群?[iI][Dd]\\s*(.+)$')

export class info extends plugin {
    constructor() {
        super({
            name: '[ws-plugin] 用户信息',
            dsc: '[ws-plugin] 用户信息',
            event: 'message',
            priority: 1,
            rule: [
                {
                    reg: '^#ws(me|id|ID)$',
                    fnc: 'getId'
                },
                {
                    reg: setReg,
                    fnc: 'setId',
                    permission: 'master'
                }
            ]
        })

    }
    async getId(e) {
        const user_id = await getUser_id({ user_id: e.user_id })
        const msg = [
            '',
            '用户真实id:',
            e.user_id,
            '',
            '用户虚拟id:',
            user_id,
        ]
        if (e.group_id) {
            const group_id = await getGroup_id({ group_id: e.group_id })
            msg.push(...[
                '',
                '群真实id:',
                e.group_id,
                '',
                '群虚拟id:',
                group_id,
    
            ])
        }
        e.reply(msg.join('\n'), false, { at: true })
        return true
    }

    async setId(e) {
        const regRet = setReg.exec(e.msg)
        const target = regRet[1].split(' '),
            type = e.msg.includes('群') ? 'group_id' : 'user_id',
            where = {}
        where[type] = e[type]
        if (target[1]) {
            where[type] = target[1]
        }
        const custom = target[0]
        let result
        if (type === 'group_id') {
            if (where[type]) {
                result = await setGroup_id(where, custom)
            } else {
                result = '修改失败,未包含群真实id'
            }
        } else {
            result = await setUser_id(where, custom)
        }
        e.reply(result)
        return true
    }

}
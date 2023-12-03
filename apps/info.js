import { getGroup_id, getUser_id, setGroup_id, setUser_id } from '../model/index.js'

const setReg = new RegExp('^#ws(修改|绑定|bind)群?(id|ID)?\\s*(.+)$')

const bind = {}

export class info extends plugin {
    constructor() {
        super({
            name: '[ws-plugin] 用户信息',
            dsc: '[ws-plugin] 用户信息',
            event: 'message',
            priority: 1,
            rule: [
                {
                    reg: '^#ws[_-]?(me|id|ID)$',
                    fnc: 'getId'
                },
                {
                    reg: setReg,
                    fnc: 'setId',
                },
                {
                    reg: '^#ws接受群?绑定',
                    fnc: 'acceptId'
                }
            ]
        })

    }
    async getId(e) {
        const user_id = await getUser_id({ user_id: e.user_id })
        const msg = [
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
        e.reply(msg.join('\n'), true)
        return true
    }

    async setId(e) {
        const regRet = setReg.exec(e.msg)
        const target = regRet[3].split(' '),
            type = e.msg.includes('群') ? 'group_id' : 'user_id',
            where = {}
        where[type] = e[type]
        if (target[1] && e.isMaster) {
            where[type] = target[1]
        }
        const custom = Number(target[0])
        if (isNaN(custom)) {
            e.reply('输入有误,ID应为纯数字')
            return
        }
        let result
        if (type === 'group_id') {
            if (where[type]) {
                if (e.isMaster) {
                    result = await setGroup_id(where, custom)
                }
                else {
                    const group_id = await getGroup_id({ group_id: where[type] })
                    if (group_id && group_id == e.group_id) {
                        result = '修改失败,未包含此真实id: ' + where[type]
                    } else {
                        result = `请在ID为[${custom}]的群中向Bot发送\n\n#ws接受群绑定 ${where[type]}`
                        bind[custom] = where[type]
                    }
                }
            } else {
                result = '修改失败,未包含群真实id'
            }
        } else {
            if (e.isMaster) {
                result = await setUser_id(where, custom)
            } else {
                const user_id = await getUser_id({ user_id: where[type] })
                if (user_id && user_id == e.user_id) {
                    result = '修改失败,未包含此真实id: ' + where[type]
                } else {
                    result = `请用ID为[${custom}]的账号向Bot发送\n\n#ws接受绑定 ${where[type]}`
                    bind[custom] = where[type]
                }
            }
        }
        e.reply(result)
        return true
    }

    async acceptId(e) {
        const isGroup = e.msg.includes('群')
        const custom = e.msg.replace(/^#ws接受群?绑定\s*/, '')
        if (isGroup) {
            const group_id = bind[e.group_id]
            if (custom == group_id) {
                e.reply([segment.at(e.user_id), await setGroup_id({ group_id: custom }, e.group_id)])
                delete bind[e.group_id]
            }
        } else {
            const user_id = bind[e.user_id]
            if (custom == user_id) {
                e.reply([segment.at(e.user_id), await setUser_id({ user_id: custom }, e.user_id)])
                delete bind[e.user_id]
            }
        }
        return true
    }

}
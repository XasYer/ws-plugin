import { getGroup_id, getUser_id, setGroup_id, setUser_id } from '../model/index.js'

const setReg = new RegExp('^#ws修改群?[iI][Dd]\\s*(.+)$')

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
                    // permission: 'master'
                },
                {
                    reg: '^#ws接受绑定',
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
        const target = regRet[1].split(' '),
            type = e.msg.includes('群') ? 'group_id' : 'user_id',
            where = {}
        where[type] = e[type]
        if (target[1] && e.isMaster) {
            where[type] = target[1]
        }
        const custom = target[0]
        let result
        if (type === 'group_id') {
            if (where[type]) {
                if (e.isMaster) {
                    result = await setGroup_id(where, custom)
                }
                // else {
                //     const group_id = await getGroup_id({ user_id: where[type] })
                //     if (group_id && group_id == e.group_id) {
                //         result = '修改失败,未包含此真实id: ' + where[type]
                //     } else {
                //         result = `请用ID为[${custom}]的账号向Bot发送\n\n#ws接受绑定 ${where[type]}`
                //     }
                //     result = `请用ID为[${custom}]的账号向Bot发送\n\n#ws接受绑定 ${where[type]}`
                // }
            } else {
                result = '修改失败,未包含群真实id'
            }
        } else {
            if (e.isMasters) {
                result = await setUser_id(where, custom)
            } else {
                const user_id = await getUser_id({ user_id: where[type] })
                if (user_id && user_id == e.user_id) {
                    result = '修改失败,未包含此真实id: ' + where[type]
                } else {
                    result = `请用ID为[${custom}]的账号向Bot发送\n\n#ws接受绑定 ${where[type]}`
                    bind[custom] = where[type]
                    console.log('bind', bind);
                }
            }
        }
        e.reply(result)
        return true
    }

    async acceptId(e) {
        const custom = e.msg.replace(/^#ws接受绑定\s*/, '')
        const user_id = bind[e.user_id]
        if (custom == user_id) {
            e.reply(await setUser_id({ user_id: custom }, e.user_id))
        }
    }

}
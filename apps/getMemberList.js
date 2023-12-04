import _ from 'lodash'
import { findAll, deleteAll, saveMemberList } from '../model/red/memberList.js'
import { sleep } from '../model/index.js'

let tips = [
    '注意:',
    '1.先在Bot端点击到其他群聊',
    '2.再点击到目标群聊界面',
    '3.然后发送此指令',
    '4.仅第一次能获取到完整列表',
    '本指令是为了解决获取群成员列表为空而存在的,会将本次获取到的数据保存下来使用'
]

export class getMemberList extends plugin {
    constructor() {
        super({
            name: '[ws-plugin] 获取群成员列表',
            dsc: '[ws-plugin] 获取群成员列表',
            event: 'message',
            priority: 1,
            rule: [
                {
                    reg: '^#ws获取群成员列表',
                    fnc: 'getMemberList',
                    permission: 'master'
                }
            ]
        })
    }

    async getMemberList(e) {
        if (tips) {
            e.reply(tips.join('\n'))
            tips = null
            await sleep(1000)
        }
        const group_id = e.msg.replace(/^#ws获取群成员列表/, '') || e.group_id
        if (!group_id) {
            e.reply('获取失败,未携带群号')
            return true
        }
        const result = await e.bot.sendApi('POST', 'group/getMemberList', JSON.stringify({ group: group_id, size: 9999 }))
        const msg = []
        if (result.length > 0) {
            // 先看看有没有已存在
            const cache = await findAll(group_id)
            if (cache.length > 0) {
                msg.push(`已删除旧数据: ${cache.length}\n`)
                // 如果已存在就删除已有的列表
                await deleteAll(group_id)
            }
            const memberList = []
            for (const i of result) {
                memberList.push({
                    group_id,
                    user_id: Number(i.detail.uin),
                    nickname: i.detail.nick,
                    card: i.detail.cardName,
                    role: i.detail.role,
                    update_time: Math.floor(Date.now() / 1000)
                })
            }
            await saveMemberList(memberList)
            msg.push(`本次获取人数: ${memberList.length}`)
        } else {
            msg.push('未获取到任何群员')
        }
        e.reply(msg)
        return true
    }

}

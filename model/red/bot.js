import { makeSendMsg, makeMessage } from './message.js'
import { setMsg, getMsg } from '../DataBase.js'
import { roleMap } from './tool.js'
import { Config, Version } from '../../components/index.js'
import { findAll } from './memberList.js'

export class QQRedBot {
    constructor(bot) {
        this.bot = bot
        this.self_id = bot.self_id
        this.nickname = bot.nickname
        this.adapter = {
            id: "QQ",
            name: "chronocat"
        }
        this.avatar = `https://q1.qlogo.cn/g?b=qq&s=0&nk=${bot.uin}`
        this.ws = bot.ws
        this.sendApi = bot.sendApi
        this.uin = bot.self_id
        this.uid = bot.info.uid
        this.nickname = bot.nickname
        this.self_id = bot.self_id
        this.stat = {
            start_time: Date.now() / 1000,
            recv_msg_cnt: 0
        }
        this.version = {
            id: "QQ",
            name: "chronocat"
        }
        this.fl = new Map()
        this.gl = new Map()
        this.gml = new Map()
        this.getConfig = {}
        this.init()
    }

    async init() {
        await this.getFriendList()
        await this.getGroupList()
    }

    pickGroup(group_id) {
        if (!this.getConfig[group_id]) {
            this.getGroupMemberList(group_id)
            this.getConfig[group_id] = true
        }
        const i = {
            ...this.gl.get(Number(group_id)),
            self_id: this.uin,
            bot: this.bot,
            group_id
        }
        return {
            ...i,
            sendMsg: async (msg) => await this.sendGroupMsg(group_id, msg),
            pickMember: user_id => this.pickMember(group_id, user_id),
            getMemberMap: async () => await this.getGroupMemberList(group_id),
            recallMsg: async message_id => await this.deleteMsg(message_id),
            sendFile: async file => await this.sendGroupMsg(group_id, [{ type: 'file', file }]),
            getChatHistory: async (seq, count) => await this.getChatHistory(seq, count, 'group', group_id),
            getInfo: async () => await this.getGroupInfo(group_id),
            muteMember: async (user_id, duration) => await this.setGroupBan(group_id, user_id, duration),
            muteAll: async (enable) => await this.setGroupWholeBan(group_id, enable),
            kickMember: async (user_id, message, block) => await this.setGroupKick(group_id, user_id, false, message),
            makeForwardMsg: (msg) => { return { type: "node", data: msg } }
        }
    }

    pickFriend(user_id) {
        user_id = Number(user_id)
        const user = this.fl.get(user_id)
        const i = {
            ...user,
            self_id: this.uin,
            bot: this.bot,
            user_id,
        }
        const chatType = user?.isGroupMsg ? 100 : 1
        return {
            ...i,
            sendMsg: async msg => await this.sendPrivateMsg(user_id, msg, chatType),
            recallMsg: async message_id => await this.deleteMsg(message_id),
            sendFile: async file => await this.sendPrivateMsg(user_id, [{ type: 'file', file }], chatType),
            getChatHistory: async (time, count) => await this.getChatHistory(time, count, 'friend', user_id),
            getFileUrl: async (fid) => `http://127.0.0.1:${Version.isTrss ? Config.bot.port : Config.wsPort}/ws-plugin?file=${fid}`,
            makeForwardMsg: (msg) => { return { type: "node", data: msg } },
            setFriendReq: async (seq, yes, remark, block) => await this.setFriendReq(seq, yes, remark, block, user_id)
        }
    }

    pickMember(group_id, user_id) {
        if (!this.getConfig[group_id]) {
            this.getGroupMemberList(group_id)
            this.getConfig[group_id] = true
        }
        const info = this.gml.get(Number(group_id))?.get?.(Number(user_id))
        const i = {
            ...info,
            self_id: this.uin,
            bot: this.bot,
            group_id: group_id,
            user_id: user_id,
        }
        return {
            ...i,
            info: {
                ...info,
                ...i
            },
            ...this.pickFriend(user_id),
            kick: async (message, block) => await this.setGroupKick(group_id, user_id, false, message),
            mute: async (duration) => await this.setGroupBan(group_id, user_id, duration),
            getInfo: async () => await this.getGroupMemberInfo(group_id, user_id),
            getAvatarUrl: () => `https://q1.qlogo.cn/g?b=qq&s=0&nk=${user_id}`
        }
    }

    pickUser(user_id) {
        return {
            ...this.pickFriend(user_id),
            setGroupInvite: async (group_id, seq, yes, block) => await this.setGroupInvite(group_id, seq, yes, block)
        }
    }

    async sendGroupMsg(group_id, message) {
        const data = {
            bot: this.bot,
            self_id: this.uin,
            group_id
        }
        const { msg: elements, log, message_id: id, rand, seq, time } = await makeSendMsg(data, message)
        if (id) return { message_id: id, rand, seq, time }
        if (elements.length == 0) {
            throw '[ws-plugin] 发送消息错误: message is empty'
        }
        const result = await this.bot.sendApi('POST', 'message/send', JSON.stringify({
            peer: {
                chatType: 2,
                peerUin: String(group_id)
            },
            elements
        }))
        if (result.error) {
            throw result.error
        } else {
            logger.info(`${logger.blue(`[${this.uin} => ${group_id}]`)} 发送群消息：${log}`)
        }
        const sendRet = {
            message_id: result.msgId,
            seq: Number(result.msgSeq),
            rand: Number(result.msgRandom),
            time: Number(result.msgTime),
            group_id: Number(group_id),
            onebot_id: Math.floor(Math.random() * Math.pow(2, 32)) | 0,
        }
        setMsg(sendRet)
        sendRet.md5 = elements.filter((i) => i.elementType === 2)
        return sendRet
    }

    async sendPrivateMsg(user_id, message, chatType = 1) {
        if ([1, 100].indexOf(chatType) == -1) chatType = 1
        const data = {
            bot: this.bot,
            self_id: this.uin,
            user_id
        }
        const { msg: elements, log, message_id: id, rand, seq, time } = await makeSendMsg(data, message)
        if (id) return { message_id: id, rand, seq, time }
        if (elements.length == 0) {
            throw '[ws-plugin] 发送消息错误: message is empty'
        }
        const result = await this.bot.sendApi('POST', 'message/send', JSON.stringify({
            peer: {
                chatType,
                peerUin: String(user_id)
            },
            elements
        }))
        if (result.error) {
            throw result.error
        } else {
            logger.info(`${logger.blue(`[${this.uin} => ${user_id}]`)} 发送好友消息：${log}`)
        }
        const sendRet = {
            message_id: result.msgId,
            seq: Number(result.msgSeq),
            rand: Number(result.msgRandom),
            user_id: Number(user_id),
            time: Number(result.msgTime),
            onebot_id: Math.floor(Math.random() * Math.pow(2, 32)) | 0,
        }
        setMsg(sendRet)
        sendRet.md5 = elements.filter((i) => i.elementType === 2)
        return sendRet
    }

    async getMsg(message_id) {
        const retult = await this.getChatHistory(message_id, 1)
        if (retult.length > 0) {
            return retult[0]
        } else {
            return null
        }
    }

    async deleteMsg(message_id) {
        const msg = await getMsg({ message_id })
        if (msg) {
            this.bot.sendApi('POST', 'message/recall', JSON.stringify({
                peer: {
                    chatType: msg.group_id ? 2 : 1,
                    peerUin: String(msg.group_id || msg.user_id),
                    guildId: null
                },
                msgIds: [msg.message_id]
            }))
        }
    }

    async getChatHistory(message_id, count, target, target_id) {
        let data = {}
        if (target === 'group') {
            if (!message_id) message_id = (await getMsg({ group_id: target_id }, [['seq', 'DESC']])).seq
            data = {
                seq: message_id,
                group_id: target_id,
            }
        } else if (target === 'friend') {
            if (!message_id) message_id = (await getMsg({ user_id: target_id }, [['time', 'DESC']])).time
            data = {
                time: message_id,
                user_id: target_id,
            }
        } else {
            data = {
                message_id,
            }
        }
        let msg = await getMsg(data)
        // time有可能有误差
        if (!msg && target == 'friend') {
            for (let i = -3; i < 4; i++) {
                data = {
                    time: message_id + i,
                    user_id: target_id,
                }
                msg = await getMsg(data)
                if (msg) break
            }
        }
        if (msg) {
            const result = await this.bot.sendApi('POST', 'message/getHistory', JSON.stringify({
                peer: {
                    chatType: msg.group_id ? 2 : 1,
                    peerUin: String(msg.group_id || msg.user_id),
                    guildId: null
                },
                offsetMsgId: msg.message_id,
                count: count || 20
            }))
            if (result.error) {
                throw result.error
            }
            if (result.msgList) {
                const msgList = []
                for (const i of result.msgList) {
                    const message = await makeMessage(this.uin, i)
                    if (message.bot) delete message.bot
                    msgList.push(message)
                }
                return msgList
            }
        }
        return []
    }

    async getFriendList() {
        for (const i of (await this.bot.sendApi('get', 'bot/friends')) || []) {
            this.fl.set(Number(i.uin), {
                ...i,
                bot_id: this.uin,
                user_id: i.uin,
                nickname: i.nick
            })
        }
        return this.fl
    }

    async getGroupList() {
        for (const i of (await this.bot.sendApi('get', 'bot/groups')) || []) {
            const data = {
                ...i,
                bot_id: this.uin,
                group_id: i.groupCode,
                group_name: i.groupName,
                max_member_count: i.maxMember,
                member_count: i.memberCount,
            }
            switch (i.memberRole) {
                case 3:
                    data.is_admin = true
                    break
                case 4:
                    data.is_owner = true
                    break
                default:
                    break;
            }
            this.gl.set(Number(i.groupCode), data)
            if (!this.gml.has(Number(i.groupCode))) {
                this.gml.set(Number(i.groupCode), new Map())
            }
        }
        return this.gl
    }

    async getGroupMemberList(group_id) {
        group_id = Number(group_id)
        const body = {
            group: group_id,
            size: 9999
        }
        if (!this.gml.has(group_id)) {
            this.gml.set(group_id, new Map())
        }
        let memberList = await this.bot.sendApi('POST', 'group/getMemberList', JSON.stringify(body))
        if (memberList.error) throw memberList.error
        // 如果是0就去数据库中找一下
        if (memberList.length === 0) {
            memberList = await findAll(group_id)
        }
        for (const i of memberList) {
            this.gml.get(group_id).set(Number(i.detail.uin), {
                ...i.detail,
                card: i.detail.cardName || i.detail.nick,
                nickname: i.detail.nick,
                group_id,
                user_id: i.detail.uin,
                role: roleMap[i.detail.role],
                shutup_time: i.detail.shutUpTime,
                sex: 'unknown'
            })
        }

        return this.gml.get(group_id)
    }

    async getGroupMemberInfo(group_id, user_id) {
        if (!this.getConfig[group_id]) {
            await this.getGroupMemberList(group_id)
            this.getConfig[group_id] = true
        }
        return this.gl.get(Number(group_id))?.get?.(Number(user_id)) || {}
    }

    async getGroupInfo(group_id) {
        return this.gl.get(Number(group_id))
    }

    async setGroupInvite(group_id, seq, yes = true, block = false) {
        const result = this.bot.sendApi('POST', 'group/invite', JSON.stringify({
            operateType: yes ? 1 : 2,
            group: Number(group_id),
            seq
        }))
        if (result.error) {
            throw result.error
        }
        if (yes) {
            this.getGroupList()
        }
        return true
    }

    async setGroupBan(group_id, user_id, duration) {
        const result = this.bot.sendApi('POST', 'group/muteMember', JSON.stringify({
            group: String(group_id),
            memList: [{
                uin: String(user_id),
                timeStamp: duration
            }]
        }))
        if (result.error) {
            throw result.error
        }
    }

    async setGroupWholeBan(group_id, enable = true) {
        const result = this.bot.sendApi('POST', 'group/muteEveryone', JSON.stringify({
            group: String(group_id),
            enable
        }))
        if (result.error) {
            throw result.error
        }
    }

    async setGroupKick(group_id, user_id, reject_add_request = false, message = '') {
        const result = this.bot.sendApi('POST', 'group/kick', JSON.stringify({
            uidList: [String(user_id)],
            group: String(group_id),
            refuseForever: reject_add_request,
            reason: message
        }))
        if (result.error) {
            throw result.error
        }
        return true
    }

    async setFriendReq(seq, yes = true, remark = "", block = false, user_id) {
        const result = this.bot.sendApi('post', 'friend/approval', JSON.stringify({
            uin: String(user_id),
            accept: yes
        }))
        if (result.error) {
            throw result.error
        }
        if (yes) {
            this.getFriendList()
        }
        return true
    }
}
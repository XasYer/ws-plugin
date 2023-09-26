import { makeSendMsg, makeMessage } from './message.js'
import { setMsgMap, getMsgMap } from '../msgMap.js'
import { roleMap } from './tool.js'

export class QQNTBot {
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
            self_id: this.self_id,
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
            getChatHistory: async (message_id, count) => await this.getChatHistory(message_id, count),
            getInfo: async () => await this.getGroupInfo(group_id),
            muteMember: async (user_id, duration) => await this.setGroupBan(group_id, user_id, duration),
            muteAll: async (enable) => await this.setGroupWholeBan(group_id, enable),
            kickMember: async (user_id, message, block) => await this.setGroupKick(group_id, user_id, false, message)
        }
    }

    pickFriend(user_id) {
        const i = {
            ...this.fl.get(Number(user_id)),
            self_id: this.self_id,
            bot: this.bot,
            user_id,
        }
        return {
            ...i,
            sendMsg: async msg => await this.sendPrivateMsg(user_id, msg),
            recallMsg: async message_id => await this.deleteMsg(message_id),
            sendFile: async file => await this.sendPrivateMsg(user_id, [{ type: 'file', file }]),
            getChatHistory: async (message_id, count) => await this.getChatHistory(message_id, count)
        }
    }

    pickMember(group_id, user_id) {
        if (!this.getConfig[group_id]) {
            this.getGroupMemberList(group_id)
            this.getConfig[group_id] = true
        }
        const info = this.gml.get(Number(group_id))?.get?.(Number(user_id))
        if (!info) return {}
        const i = {
            ...info,
            self_id: this.self_id,
            bot: this.bot,
            group_id: group_id,
            user_id: user_id,
        }
        return {
            ...i,
            info,
            ...this.pickFriend(user_id),
            kick: async (message, block) => await this.setGroupKick(group_id, user_id, false, message),
            mute: async (duration) => await this.setGroupBan(group_id, user_id, duration),
            getInfo: async () => await this.getGroupMemberInfo(group_id, user_id)
        }
    }

    pickUser(user_id) {
        return this.pickFriend(user_id)
    }

    async sendGroupMsg(group_id, message) {
        const data = {
            bot: this.bot,
            self_id: this.self_id,
            group_id
        }
        const { msg: elements, log, message_id: id, rand } = await makeSendMsg(data, message)
        if (id) return { message_id: id, rand }
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
            logger.info(`${logger.blue(`[${this.self_id} => ${group_id}]`)} 发送群消息：${log}`)
        }
        const message_id = `${result.peerUid}:${result.msgSeq}`
        setMsgMap(message_id, {
            // message_id: e.message_id,
            message_id: result.msgId,
            seq: message_id,
            rand: result.msgRandom,
            user_id: this.self_id,
            time: result.msgTime,
            chatType: 2,
            group_id
        })
        return { message_id, rand: result.msgRandom }
    }

    async sendPrivateMsg(user_id, message) {
        const data = {
            bot: this.bot,
            self_id: this.self_id,
            user_id
        }
        const { msg: elements, log, message_id: id, rand } = await makeSendMsg(data, message)
        if (id) return { message_id: id, rand }
        const result = await this.bot.sendApi('POST', 'message/send', JSON.stringify({
            peer: {
                chatType: 1,
                peerUin: String(user_id)
            },
            elements
        }))
        if (result.error) {
            throw result.error
        } else {
            logger.info(`${logger.blue(`[${this.self_id} => ${user_id}]`)} 发送好友消息：${log}`)
        }
        const message_id = `${user_id}:${result.msgSeq}`
        setMsgMap(message_id, {
            // message_id: e.message_id,
            message_id: result.msgId,
            seq: message_id,
            rand: message_id,
            user_id: user_id,
            time: result.msgTime,
            chatType: 1,
            sender: this.self_id
        })
        return { message_id, rand: result.msgRandom }
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
        const msg = await getMsgMap(message_id)
        if (msg) {
            this.bot.sendApi('POST', 'message/recall', JSON.stringify({
                peer: {
                    chatType: msg.chatType,
                    peerUin: String(msg.group_id || msg.user_id),
                    guildId: null
                },
                msgIds: [msg.message_id]
            }))
        }
    }

    async getChatHistory(message_id, count) {
        const msg = await getMsgMap(message_id)
        if (msg) {
            const result = await this.bot.sendApi('POST', 'message/getHistory', JSON.stringify({
                peer: {
                    chatType: msg.chatType,
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
                    const ret = await getMsgMap(`${msg.group_id || msg.user_id}:${i.msgSeq}`)
                    i.senderUin = ret.sender || ret.user_id
                    i.peerUin = msg.group_id || msg.user_id
                    const message = await makeMessage(this.self_id, i)
                    if (message.bot) delete message.bot
                    msgList.push(message)
                }
                return msgList
            }
        }
        return []
    }

    async getFriendList() {
        for (const i of (await this.bot.sendApi('get', 'bot/friends'))) {
            this.fl.set(Number(i.uin), {
                ...i,
                bot_id: this.self_id,
                user_id: i.uin,
                nickname: i.nick
            })
        }
        return this.fl
    }

    async getGroupList() {
        for (const i of (await this.bot.sendApi('get', 'bot/groups'))) {
            const data = {
                ...i,
                bot_id: this.self_id,
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
        const body = {
            group: Number(group_id),
            size: 9999
        }
        const memberList = await this.bot.sendApi('POST', 'group/getMemberList', JSON.stringify(body))
        if (memberList.error) throw memberList.error
        for (const i of memberList) {
            this.gml.get(Number(group_id)).set(Number(i.detail.uin), {
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
        return this.gml.get(Number(group_id))
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
}
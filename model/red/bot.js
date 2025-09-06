import { makeSendMsg, makeMessage } from './message.js'
import { setMsg, getMsg } from '../DataBase.js'
import { roleMap, upload } from './tool.js'
import { Config, Version } from '../../components/index.js'
import { findAll } from './memberList.js'

export class QQRedBot {
    constructor(bot) {
        this.bot = this
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
        // this.version = {
        //     id: "QQ",
        //     name: "chronocat"
        // }
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
        group_id = Number(group_id)
        if (!this.getConfig[group_id]) {
            this.getGroupMemberList(group_id)
            this.getConfig[group_id] = true
        }
        const i = {
            ...this.gl.get(group_id),
            self_id: this.uin,
            bot: this.bot,
            group_id
        }
        return {
            ...i,
            fs: {
                ...this.Gfs(group_id)
            },
            sendMsg: msg => this.sendGroupMsg(group_id, msg),
            pickMember: user_id => this.pickMember(group_id, user_id),
            getMemberMap: () => this.getGroupMemberList(group_id),
            recallMsg: message_id => this.deleteMsg(message_id),
            sendFile: file => this.sendGroupMsg(group_id, [{ type: 'file', file }]),
            getChatHistory: (seq, count) => this.getChatHistory(seq, count, 'group', group_id),
            getInfo: () => this.getGroupInfo(group_id),
            muteMember: (user_id, duration) => this.setGroupBan(group_id, user_id, duration),
            muteAll: enable => this.setGroupWholeBan(group_id, enable),
            kickMember: (user_id, message, block) => this.setGroupKick(group_id, user_id, false, message),
            makeForwardMsg: msg => { return { type: "node", data: msg } },
            setName: name => this.setGroupName(group_id, name),
            setRemark: remark => this.setGroupRemark(group_id, remark),
            setCard: (user_id, card) => this.setGroupCard(group_id, user_id, card),
            setAdmin: (user_id, enable) => this.setGroupAdmin(group_id, user_id, enable),
            invite: user_id => this.inviteFriend(group_id, user_id),
            quit: () => this.setGroupLeave(group_id),
            transfer: user_id => this.setGroupTransfer(group_id, user_id)
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
            sendMsg: msg => this.sendPrivateMsg(user_id, msg, chatType),
            recallMsg: message_id => this.deleteMsg(message_id),
            sendFile: file => this.sendPrivateMsg(user_id, [{ type: 'file', file }], chatType),
            getChatHistory: (time, count) => this.getChatHistory(time, count, 'friend', user_id),
            getFileUrl: fid => `http://127.0.0.1:${Version.isTrss ? Config.bot.port : Config.wsPort}/ws-plugin?file=${fid}`,
            makeForwardMsg: msg => { return { type: "node", data: msg } },
            setFriendReq: (seq, yes, remark, block) => this.setFriendReq(seq, yes, remark, block, user_id),
            thumbUp: times => this.sendLike(user_id, times),
            delete: block => this.deleteFriend(user_id, block),
            notify: enable => this.setFriendNotify(user_id, enable),
            block: enable => this.setFriendBlock(user_id, enable)
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
            kick: (message, block) => this.setGroupKick(group_id, user_id, false, message),
            mute: duration => this.setGroupBan(group_id, user_id, duration),
            getInfo: () => this.getGroupMemberInfo(group_id, user_id),
            getAvatarUrl: () => `https://q1.qlogo.cn/g?b=qq&s=0&nk=${user_id}`
        }
    }

    pickUser(user_id) {
        return {
            ...this.pickFriend(user_id),
            setGroupInvite: (group_id, seq, yes, block) => this.setGroupInvite(group_id, seq, yes, block),
            setGroupReq: (group_id, seq, approve, reason, block) => this.setGroupAddRequest(seq, approve, reason, block, group_id),
            setFriendReq: (seq, yes, remark, block) => this.setFriendReq(seq, yes, remark, block, user_id)
        }
    }

    Gfs(group_id) {
        const group = Number(group_id)
        return {
            gid: group,
            group_id: group,
            df: async () => {
                const result = await this.getApiData('POST', 'groupGfs/df', { group })
                return {
                    free: result.totalSpace - result.usedSpace,
                    total: Number(result.totalSpace),
                    used: Number(result.usedSpace)
                }
            },
            dir: async (folderId = '/', start = 0, limit = 100) => {
                const result = await this.getApiData('POST', 'groupGfs/dir', { group, folderId, start, limit })
                const files = []
                for (const i of result) {
                    const f = i.type == 1 ? i.fileInfo : i.folderInfo
                    const is_dir = i.type == 1 ? false : true
                    const info = {
                        create_time: f.createTime || f.modifyTime,
                        fid: f.fileId || f.folderId,
                        is_dir,
                        name: f.fileName || f.folderName,
                        pid: f.parentFolderId,
                        user_id: Number(f.uploaderUin || f.createUin)
                    }
                    if (is_dir) {
                        info.file_count = f.totalFileCount
                    } else {
                        info.busid = f.busId
                        info.download_times = f.downloadTimes
                        info.duration = 0
                        info.md5 = f.md5
                        info.sha1 = f.sha
                        info.size = f.dileSize
                    }
                    files.push(info)
                }
                return result
            },
            mkdir: async Name => {
                const result = await this.getApiData('POST', 'groupGfs/mkdir', { group, Name })
                const f = result.resultWithGroupItem.groupItem.folderInfo
                return {
                    create_time: f.createTime,
                    fid: f.folderId,
                    is_dir: true,
                    name: f.folderName,
                    pid: f.parentFolderId,
                    user_id: Number(f.createUin),
                    file_count: f.totalFileCount
                }
            },
            mv: (fileId, FolderId) => this.getApiData('POST', 'groupGfs/mv', { group, fileId, FolderId }),
            rename: async (fid, Name) => {
                const result = await this.getApiData('POST', 'groupGfs/rename', { group, fileId: fid, Name })
                if (result.error) {
                    await this.getApiData('POST', 'groupGfs/rename', { group, folderId: fid, Name })
                }
            },
            rm: async fid => {
                const result = await this.getApiData('POST', 'groupGfs/rm', { group, fileId: fid })
                if (result.error) {
                    await this.getApiData('POST', 'groupGfs/rm', { group, FolderId: fid })
                }
            }
        }
    }

    async sendGroupMsg(group_id, message) {
        const data = {
            bot: this.bot,
            self_id: this.uin,
            group_id
        }
        const { msg: elements, log, message_id: id, rand, seq, time, node } = await makeSendMsg(data, message)
        if (id) return { message_id: id, rand, seq, time }
        if (elements.length == 0) {
            throw '[ws-plugin] 发送消息错误: message is empty'
        }
        let result
        if (node) {
            let target = {
                chatType: 2,
                peerUin: String(group_id)
            }
            result = await this.getApiData('POST', 'message/unsafeSendForward', {
                msgElements: elements,
                srcContact: target,
                dstContact: target
            })
        } else {
            result = await this.getApiData('POST', 'message/send', {
                peer: {
                    chatType: 2,
                    peerUin: String(group_id)
                },
                elements
            })
        }
        logger.info(`${logger.blue(`[${this.uin} => ${group_id}]`)} 发送群消息：${log}`)
        const sendRet = {
            message_id: result.msgId,
            seq: Number(result.msgSeq),
            rand: Number(result.msgRandom),
            time: Number(result.msgTime),
            group_id: Number(group_id),
            onebot_id: Math.floor(Math.random() * Math.pow(2, 32)) | 0,
        }
        setMsg(sendRet)
        return sendRet
    }

    async sendPrivateMsg(user_id, message, chatType = 1) {
        if ([1, 100].indexOf(chatType) == -1) chatType = 1
        const data = {
            bot: this.bot,
            self_id: this.uin,
            user_id
        }
        const { msg: elements, log, message_id: id, rand, seq, time, node } = await makeSendMsg(data, message)
        if (id) return { message_id: id, rand, seq, time }
        if (elements.length == 0) {
            throw '[ws-plugin] 发送消息错误: message is empty'
        }
        let result
        if (node) {
            let target = {
                chatType,
                peerUin: String(user_id)
            }
            result = await this.getApiData('POST', 'message/unsafeSendForward', {
                msgElements: elements,
                srcContact: target,
                dstContact: target
            })
        } else {
            result = await this.getApiData('POST', 'message/send', {
                peer: {
                    chatType,
                    peerUin: String(user_id)
                },
                elements
            })
        }
        logger.info(`${logger.blue(`[${this.uin} => ${user_id}]`)} 发送好友消息：${log}`)
        const sendRet = {
            message_id: result.msgId,
            seq: Number(result.msgSeq),
            rand: Number(result.msgRandom),
            user_id: Number(user_id),
            time: Number(result.msgTime),
            onebot_id: Math.floor(Math.random() * Math.pow(2, 32)) | 0,
        }
        setMsg(sendRet)
        return sendRet
    }

    async inviteFriend(group_id, user_id) {
        await this.getApiData('POST', 'group/invite', {
            group: Number(group_id),
            uins: [String(user_id)]
        })
        return true
    }

    async deleteMsg(message_id) {
        // 尝试不同格式的message_id
        let msg = await getMsg({ message_id });
    
        // 如果找不到，尝试使用onebot_id
        if (!msg) {
            msg = await getMsg({ onebot_id: message_id });
        }
        
        // 继续尝试数字或字符串格式
        if (!msg) {
            msg = await getMsg({ message_id: Number(message_id) });
        }
        
        if (!msg) {
            msg = await getMsg({ message_id: String(message_id) });
        }
        // 找到消息后执行撤回操作
        if (msg) {
            try {
                await this.getApiData('POST', 'message/recall', {
                    peer: {
                        chatType: msg.group_id ? 2 : 1,
                        peerUin: String(msg.group_id || msg.user_id),
                        guildId: null
                    },
                    msgIds: [msg.message_id]
                });
                return true;
            } catch (error) {
                logger.error(`[ws-plugin] 撤回消息失败: ${error.message}`);
                return false;
            }
        } else {
            logger.warn(`[ws-plugin] 找不到消息ID: ${message_id}`);
            return false;
        }
    }

    async deleteFriend(user_id, block = true) {
        await this.getApiData('POST', 'friend/delete', {
            uin: Number(user_id),
            Block: block
        })
        await this.getFriendList()
        return true
    }

    async getMsg(message_id) {
        const retult = await this.getChatHistory(message_id, 1)
        if (retult.length > 0) {
            return retult[0]
        } else {
            return null
        }
    }

    async getSystemMsg() {
        // 只获取未处理的
        const result = await this.getApiData('POST', 'group/inviteList')
        const systemMsg = []
        // 邀请Bot入群
        for (const i of result?.[1] || []) {
            const group_id = Number(i.group.groupCode)
            systemMsg.push({
                post_type: "request",
                request_type: "group",
                sub_type: "invite",
                flag: i.seq,
                seq: i.seq,
                group_id,
                group_name: i.group.groupName,
                user_id: i.user2.uin || await this.getuin(i.user2.uid) || i.user2.uid,
                nickname: i.user2.nickName,
                approve: (yes = true) => this.setGroupInvite(group_id, i.seq, yes)
            })
        }
        // 群申请
        const groupRequestEvent = [...result?.[5] || [], ...result?.[7] || []]
        for (const i of groupRequestEvent) {
            const group_id = Number(i.group.groupCode)
            const event = {
                post_type: "request",
                request_type: "group",
                sub_type: "add",
                comment: i.postscript,
                tips: i.warningTips,
                flag: i.seq,
                seq: i.seq,
                group_id,
                group_name: i.group.groupName,
                user_id: i.user1.uin || await this.getuin(i.user1.uid) || i.user1.uid,
                nickname: i.user1.nickName,
                approve: (yes = true) => this.setGroupAddRequest(i.seq, yes, '', false, group_id)
            }
            if (i.type == 5) {
                event.inviter_id = i.user2.uin || await this.getuin(i.user2.uid) || i.user2.uid
            }
            systemMsg.push(event)
        }
        return systemMsg
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
            const result = await this.getApiData('POST', 'message/getHistory', {
                peer: {
                    chatType: msg.group_id ? 2 : 1,
                    peerUin: String(msg.group_id || msg.user_id),
                    guildId: null
                },
                offsetMsgId: msg.message_id,
                count: count || 20
            })
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
        this.fl.clear()
        for (const i of (await this.getApiData('get', 'bot/friends')) || []) {
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
        for (const i of (await this.getApiData('get', 'bot/groups')) || []) {
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
        let memberList = await this.getApiData('POST', 'group/getMemberList', body)
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

    async setAvatar(file) {
        const data = await upload(this.bot, file, 'image/png')
        if (data?.ntFilePath) {
            await this.getApiData('POST', 'bot/setAvatar', {
                path: data.ntFilePath
            })
            return true
        }
        return false
    }

    async setNickname(nickname) {
        await this.getApiData('POST', 'bot/setMiniProfile', {
            nick: nickname
        })
        return true
    }

    async setSignature(signature) {
        await this.getApiData('POST', 'bot/setMiniProfile', {
            longNick: signature
        })
        return true
    }

    async setBirthday(birthday) {
        if (typeof birthday === 'number') {
            birthday = String(birthday)
        }
        const numbers = birthday.match(/\d+/g);
        if (numbers) {
            birthday = numbers.join('')
        } else {
            return false
        }
        const year = Number(birthday.substring(0, 4) || 1999)
        const month = Number(birthday.substring(4, 6) || 1)
        const day = Number(birthday.substring(6, 8) || 1)
        await this.getApiData('POST', 'bot/setMiniProfile', {
            birthday: {
                year,
                month,
                day
            }
        })
        return true
    }

    async setGender(gender) {
        await this.getApiData('POST', 'bot/setMiniProfile', {
            sex: Number(gender) || 1
        })
        return true
    }

    async setOnlineStatus(status) {
        const code = {
            31: 30, // '离开'
            50: 50, // '忙碌'
            70: 70, // '请勿打扰'
            41: 40, // '隐身'
            11: 10, // '我在线上'
            60: 60, // 'Q我吧'
        }
        await this.getApiData('POST', 'bot/setOnlineStatus', {
            status: code[status] || status
        })
        return true
    }

    async setGroupInvite(group_id, seq, yes = true, block = false) {
        await this.getApiData('POST', 'group/approval', {
            operateType: yes ? 1 : 2,
            group: Number(group_id),
            seq
        })
        if (yes) {
            await this.getGroupList()
        }
        return true
    }

    async setGroupBan(group_id, user_id, duration) {
        this.getApiData('POST', 'group/muteMember', {
            group: String(group_id),
            memList: [{
                uin: String(user_id),
                timeStamp: duration
            }]
        })
    }

    async setGroupWholeBan(group_id, enable = true) {
        await this.getApiData('POST', 'group/muteEveryone', {
            group: String(group_id),
            enable
        })
    }

    async setGroupKick(group_id, user_id, reject_add_request = false, message = '') {
        await this.getApiData('POST', 'group/kick', {
            uidList: [String(user_id)],
            group: String(group_id),
            refuseForever: reject_add_request,
            reason: message
        })
        return true
    }

    async setGroupLeave(group_id) {
        group_id = Number(group_id)
        // 缓存没有这个群的话就先获取一遍
        if (!this.gl.has(group_id)) await this.getGroupList()
        // 还是没有的话就是没有这个群了
        if (!this.gl.has(group_id)) return false
        // 是群主就是解散,不是就退群
        const api = this.gl.get(group_id).is_owner ? 'destroy' : 'quit'
        await this.getApiData('POST', `group/${api}`, {
            group: group_id,
        })
        return true
    }

    async setGroupTransfer(group_id, user_id) {
        await this.getApiData('POST', 'group/transfer', {
            group: Number(group_id),
            uin: Number(user_id)
        })
        return true
    }

    async setGroupAddRequest(seq, approve = true, reason = '', block = false, group_id) {
        if (!group_id) {
            const result = await this.getSystemMsg()
            for (const i of result) {
                if (i.seq == seq) {
                    group_id = i.group.groupCode
                    break
                }
            }
            if (!group_id) {
                return false
            }
        }
        group_id = Number(group_id)
        await this.getApiData('POST', 'group/approval', {
            operateType: approve ? 1 : 2,
            group: group_id,
            seq: seq
        })
        return true
    }

    async setGroupName(group_id, name) {
        await this.getApiData('POST', 'group/setName', {
            group: Number(group_id),
            Name: name
        })
        return true
    }

    async setGroupRemark(group_id, remark) {
        await this.getApiData('POST', 'group/setRemark', {
            group: Number(group_id),
            Remark: remark
        })
        return true
    }

    async setGroupCard(group_id, user_id, card) {
        await this.getApiData('POST', 'group/setCard', {
            group: Number(group_id),
            uin: Number(user_id),
            Name: card
        })
        return true
    }

    async setGroupAdmin(group_id, user_id, enable = true) {
        await this.getApiData('POST', 'group/setAdmin', {
            group: Number(group_id),
            uin: Number(user_id),
            role: enable ? 3 : 2
        })
        return true
    }

    async setFriendReq(seq, yes = true, remark = "", block = false, user_id) {
        await this.getApiData('post', 'friend/approval', {
            uin: String(user_id),
            accept: yes
        })
        return true
    }

    async setFriendNotify(user_id, enable = true) {
        await this.getApiData('POST', 'group/setMsgNotify', {
            uin: Number(user_id),
            noDisturb: enable
        })
        return true
    }

    async setFriendBlock(user_id, enable = true) {
        await this.getApiData('POST', 'group/setBlock', {
            uin: Number(user_id),
            block: enable
        })
        return true
    }

    async sendLike(user_id, times = 1) {
        const result = await this.bot.sendApi('post', 'friend/doLike', JSON.stringify({
            uin: String(user_id),
            times
        }))
        if (result.error) {
            throw Error('非icqq无法进行点赞')
        }
        return { code: result.result, msg: result.errMsg }
    }

    async getuin(uid) {
        const result = await this.bot.sendApi('post', 'getuin', JSON.stringify({
            uid,
        }))
        if (result.error || result.errMsg) {
            return false
        }
        return Number(result)
    }

    async getApiData(method, api, body) {
        const result = await this.bot.sendApi(method, api, JSON.stringify(body))
        if (result.error) {
            throw result.error
        }
        return result
    }
}

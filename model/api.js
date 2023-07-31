import { makeSendMsg, makeForwardMsg } from './makeMsg.js'
import { getMsgMap, setMsgMap, getGuildLatestMsgId, getLatestMsg } from './msgMap.js'
import { msgToOneBotMsg } from './tool.js'
import { MsgToCQ } from './CQCode.js'
import { Version } from '../components/index.js'

async function getApiData(api, params = {}, name, self_id) {
    let sendRet = null
    let ResponseData = null
    let publicApi = {
        'send_msg': async (params) => {
            let { sendMsg, quote } = await makeSendMsg(params)
            if (params.message_type == 'group' || params.group_id) {
                sendRet = await Bot.pickGroup(params.group_id).sendMsg(sendMsg, quote)
            } else if (params.message_type == 'private' || params.user_id) {
                sendRet = await Bot.pickFriend(params.user_id).sendMsg(sendMsg, quote)
            }
            logger.mark(`[ws-plugin] 连接名字:${name} 处理完成`)
        },
        'send_guild_channel_msg': async params => {
            let { sendMsg } = await makeSendMsg(params)
            sendMsg.unshift({
                type: 'reply',
                data: {
                    id: getGuildLatestMsgId()
                }
            })
            await Bot[self_id].pickGroup(`qg_${params.guild_id}-${params.channel_id}`).sendMsg(sendMsg)
            logger.mark(`[ws-plugin] 连接名字:${name} 处理完成`)
        },
        'send_private_msg': async (params) => {
            let { sendMsg, quote } = await makeSendMsg(params)
            sendRet = await Bot.pickFriend(params.user_id).sendMsg(sendMsg, quote)
            logger.mark(`[ws-plugin] 连接名字:${name} 处理完成`)
        },
        'send_group_msg': async (params) => {
            let { sendMsg, quote } = await makeSendMsg(params)
            sendRet = await Bot.pickGroup(params.group_id).sendMsg(sendMsg, quote)
            logger.mark(`[ws-plugin] 连接名字:${name} 处理完成`)
        },
        'send_group_forward_msg': async (params) => {
            let forwardMsg = await makeForwardMsg(params)
            let forward_id
            if (typeof (forwardMsg.data) === 'object') {
                let detail = forwardMsg.data?.meta?.detail
                if (detail) forward_id = detail.resid
            } else {
                let match = forwardMsg.data.match(/m_resid="(.*?)"/);
                if (match) forward_id = match[1];
            }
            sendRet = await Bot.pickGroup(params.group_id).sendMsg(sendMsg)
            sendRet.forward_id = forward_id
            logger.mark(`[ws-plugin] 连接名字:${name} 处理完成`)
        },
        'send_private_forward_msg': async (params) => {
            let forwardMsg = await makeForwardMsg(params)
            let forward_id
            if (typeof (forwardMsg.data) === 'object') {
                let detail = forwardMsg.data?.meta?.detail
                if (detail) forward_id = detail.resid
            } else {
                let match = forwardMsg.data.match(/m_resid="(.*?)"/);
                if (match) forward_id = match[1];
            }
            sendRet = await Bot.pickFriend(params.group_id).sendMsg(sendMsg)
            sendRet.forward_id = forward_id
            logger.mark(`[ws-plugin] 连接名字:${name} 处理完成`)
        },
        'set_group_ban': async (params) => {
            ResponseData = await Bot.setGroupBan(params.group_id, params.user_id, params.duration)
        },
        'get_group_member_list': async (params) => {
            let list = await Bot.getGroupMemberList(params.group_id)
            list = Array.from(list.values())
            list.map(item => {
                item.shut_up_timestamp = item.shutup_time
            })
            ResponseData = list
        },
        'get_group_member_info': async (params) => {
            ResponseData = await Bot.getGroupMemberInfo(params.group_id, params.user_id);
            ResponseData.shut_up_timestamp = ResponseData.shutup_time
        },
        'get_stranger_info': async (params) => {
            ResponseData = await Bot.getStrangerInfo(params.user_id)
        },
        'delete_msg': async (params) => {
            let msg = await getMsgMap(params.message_id)
            if (msg) {
                await Bot.deleteMsg(msg.message_id)
            }
        },
        'delete_friend': async params => {
            ResponseData = await Bot.deleteFriend(params.user_id)
        },
        'get_msg': async (params) => {
            ResponseData = await getMsgMap(params.message_id)
            if (ResponseData) {
                ResponseData = await Bot.getMsg(ResponseData.message_id)
                ResponseData.real_id = ResponseData.seq
                ResponseData.message_id = ResponseData.rand
                ResponseData.message = msgToOneBotMsg(ResponseData.message)
            } else {
                throw { message: 'get_msg API error' }
            }
        },
        'get_forward_msg': async params => {
            let result = await Bot.getForwardMsg(params.message_id)
            let messages = []
            for (const item of result) {
                messages.push({
                    content: MsgToCQ(msgToOneBotMsg(item.message)),
                    sender: {
                        nickname: item.nickname,
                        user_id: item.user_id
                    },
                    time: item.time
                })
            }
            ResponseData = {
                messages
            }
        },
        'get_group_root_files': async (params) => {
            let list = await Bot.pickGroup(params.group_id).fs.ls()
            let files = []
            let folders = []
            let nickname = {}
            if (Array.isArray(list) && list.length > 0) {
                for (const item of list) {
                    let user_id = item.user_id
                    if (!nickname[user_id]) {
                        nickname[user_id] = (await Bot.getStrangerInfo(item.user_id)).nickname
                    }
                    if (item.is_dir) {
                        folders.push({
                            group_id: params.group_id,
                            folder_id: item.fid,
                            folder_name: item.name,
                            create_time: item.create_time,
                            creator: item.user_id,
                            creator_name: nickname[user_id],
                            total_file_count: item.file_count
                        })
                    } else {
                        files.push({
                            group_id: params.group_id,
                            file_id: item.fid,
                            file_name: item.name,
                            busid: item.busid,
                            file_size: item.size,
                            upload_time: item.create_time,
                            dead_time: item.duration,
                            modify_time: item.create_time,
                            download_times: item.download_times,
                            uploader: item.user_id,
                            uploader_name: nickname[user_id]
                        })
                    }
                }
            }
            ResponseData = {
                files,
                folders
            }
        },
        'get_group_files_by_folder': async params => {
            let list = await Bot.pickGroup(params.group_id).fs.ls(params.folder_id)
            let files = []
            let folders = []
            let nickname = {}
            if (Array.isArray(list) && list.length > 0) {
                for (const item of list) {
                    let user_id = item.user_id
                    if (!nickname[user_id]) {
                        nickname[user_id] = (await Bot.getStrangerInfo(item.user_id)).nickname
                    }
                    if (item.is_dir) {
                        folders.push({
                            group_id: params.group_id,
                            folder_id: item.fid,
                            folder_name: item.name,
                            create_time: item.create_time,
                            creator: item.user_id,
                            creator_name: nickname[user_id],
                            total_file_count: item.file_count
                        })
                    } else {
                        files.push({
                            group_id: params.group_id,
                            file_id: item.fid,
                            file_name: item.name,
                            busid: item.busid,
                            file_size: item.size,
                            upload_time: item.create_time,
                            dead_time: item.duration,
                            modify_time: item.create_time,
                            download_times: item.download_times,
                            uploader: item.user_id,
                            uploader_name: nickname[user_id]
                        })
                    }
                }
            }
            ResponseData = {
                files,
                folders
            }
        },
        'get_group_file_url': async params => {
            let file = await Bot.pickGroup(params.group_id).fs.download(params.file_id)
            ResponseData = {
                url: file.url
            }
        },
        'get_login_info': async params => {
            ResponseData = {
                user_id: Bot.uin,
                nickname: Bot.nickname
            }
        },
        'get_guild_service_profile': async params => {
            ResponseData = {
                avatar_url: Bot.pickFriend(Bot.uin).getAvatarUrl(),
                nickname: Bot.nickname,
                tiny_id: Bot.tiny_id
            }
        },
        '_set_model_show': async params => {
            //不会改
        },
        'get_online_clients': async params => {
            //不会获取
            ResponseData = {
                clients: []
            }
        },
        'get_status': async params => {
            ResponseData = {
                online: Bot.isOnline(),
                good: Bot.isOnline(),
                app_initialized: true,
                app_enabled: true,
                plugins_good: true,
                app_good: true,
                stat: {
                    packet_receivend: Bot.stat.recv_pkt_cnt,
                    packet_send: Bot.stat.sent_pkt_cnt,
                    packet_lost: Bot.stat.lost_pkt_cnt,
                    message_received: Bot.stat.recv_msg_cnt,
                    message_send: Bot.stat.sent_msg_cnt,
                    disconnect_times: 0,
                    lost_times: Bot.stat.lost_times,
                    last_message_time: getLatestMsg()?.time || 0
                }
            }
        },
        'get_version_info': async params => {
            ResponseData = {
                app_name: 'ws-plugin',
                app_version: Version.version,
                protocol_version: 'v11'
            }
        },
        'get_friend_list': async params => {
            let list = await Bot.getFriendList()
            ResponseData = Array.from(list.values())
        },
        'get_group_list': async params => {
            let list = await Bot.getGroupList()
            list = Array.from(list.values())
            list.map(item => {
                item.group_memo = item.group_name
                item.group_create_time = item.create_time
                item.group_level = item.grade
            })
        },
        'get_group_info': async params => {
            ResponseData = await Bot.getGroupInfo(params.group_id)
            ResponseData.group_memo = ResponseData.group_name
            ResponseData.group_create_time = ResponseData.create_time
            ResponseData.group_level = ResponseData.grade
        },
        'get_guild_list': async params => {
            ResponseData = await Bot.getGuildList()
        },

    }
    if (typeof publicApi[api] === 'function') {
        await publicApi[api](params)
        if (sendRet) {
            ResponseData = {
                ...sendRet,
                message_id: sendRet.rand,
            }
            await setMsgMap(sendRet.rand, sendRet)
        }
        return ResponseData
    } else {
        logger.warn(`未适配的api: ${api}`);
    }
}

export {
    getApiData
}
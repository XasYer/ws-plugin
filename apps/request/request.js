import { sendSocketList, Config, Version } from '../../components/index.js'

Bot.on('request', async e => {
    if (sendSocketList.length == 0) return false
    let other = {}
    switch (e.request_type) {
        case 'friend':
            other.request_type = 'friend'
            switch (e.sub_type) {
                case 'add':
                    if (!Config.friendAdd) return false
                    break;
                default:
                    return false
            }
            break;
        case 'group':
            other.request_type = 'group'
            other.group_id = e.group_id
            switch (e.sub_type) {
                case 'invite':
                    if (!Config.groupInvite) return false
                    other.sub_type = 'invite'
                    break;
                case 'add':
                    if (!Config.groupAdd) return false
                    other.sub_type = 'add'
                    break;

                default:
                    return false;
            }
            break;

        default:
            return false;
    }

    let msg = {
        time: e.time,
        self_id: e.self_id,
        post_type: 'request',
        flag: e.flag,
        user_id: e.user_id,
        comment: e.comment,
        ...other
    }
    msg = JSON.stringify(msg)
    sendSocketList.forEach(i => {
        if (i.status == 1) {
            switch (Number(i.type)) {
                case 1:
                case 2:
                case 6:
                    if (i.uin != e.self_id) return
                    i.ws.send(msg)
                    break;
                default:
                    break;
            }
        }
    })
})
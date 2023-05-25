//临时解决,后续想到什么办法了再改
const msgMap = new Map()
let keys = []

function getMsgMap(key) {
    let msg = msgMap.get(Number(key));
    let message = []
    if (!msg) {
        return null
    }
    if (!msg.message) {
        return msg
    }
    for (let i = 0; i < msg.message.length; i++) {
        switch (msg.message[i].type) {
            case 'at':
                message.push({
                    type: 'at',
                    data: {
                        qq: msg.message[i].qq
                    }
                })
                break;
            case 'text':
                message.push({
                    type: 'text',
                    data: {
                        text: msg.message[i].text
                    }
                })
                break
            case 'image':
                message.push({
                    type: 'image',
                    data: {
                        file: msg.message[i].file,
                        url: msg.message[i].url
                    }
                })
            default:
                break;
        }
    }
    msg.message = message
    return msg
}

/**
 * 把最近500条消息存起来,用于getMsg和deleteMsg
 * @param {*} key 
 * @param {*} value 
 */
function setMsgMap(key, value) {
    if (keys.length >= 500) {
        let firstKey = keys.shift();
        msgMap.delete(firstKey);
    }
    msgMap.set(key, value);
    keys.push(key);
}

function getLatestMsg() {
    let key = keys[keys.length - 1]
    let msg = getMsgMap(key)
    return msg
}

export {
    getMsgMap,
    setMsgMap,
    getLatestMsg
}
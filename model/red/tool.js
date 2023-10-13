import fs from 'fs'
import { createHash, randomUUID } from 'crypto'
import { resolve, join, dirname, basename } from 'path'
import fetch, { FormData, Blob } from 'node-fetch'
import { fileURLToPath } from 'url'
import { exec, spawn } from 'child_process'
import os from 'os'
import _ from 'lodash'
import { Stream } from "stream"
import YAML from 'yaml'
import { TMP_DIR } from '../tool.js'

const user = os.userInfo().username
let redPath = `C:/Users/${user}/.chronocat`
if (!fs.existsSync(redPath)) {
    redPath = `C:/Users/${user}/AppData/Roaming/BetterUniverse/QQNT`
}

const roleMap = {
    2: 'member',
    3: 'admin',
    4: 'owner'
}

async function uploadImg(bot, msg) {
    const file = await upload(bot, msg, 'image/png')
    if (!file.imageInfo) throw "获取图片信息失败,请检查图片状态"
    return {
        elementType: 2,
        picElement: {
            md5HexStr: file.md5,
            fileSize: file.fileSize,
            picHeight: file.imageInfo.height,
            picWidth: file.imageInfo.width,
            fileName: basename(file.ntFilePath),
            sourcePath: file.ntFilePath,
            picType: file.imageInfo.type === 'gif' ? 2000 : 1000
        }
    }
}

async function upload(bot, msg, contentType) {
    if (!msg) throw { noLog: true }
    let buffer
    if (msg instanceof Stream.Readable) {
        buffer = fs.readFileSync(msg.path)
        contentType = contentType.split('/')[0] + '/' + msg.path.substring(msg.path.lastIndexOf('.') + 1)
    } else if (msg.match(/^base64:\/\//)) {
        buffer = Buffer.from(msg.replace(/^base64:\/\//, ""), 'base64')
    } else if (msg.startsWith('http')) {
        const img = await fetch(msg)
        const type = img.headers.get('content-type');
        if (type) contentType = type
        const arrayBuffer = await img.arrayBuffer()
        buffer = Buffer.from(arrayBuffer)
    } else if (msg.startsWith('file:///')) {
        buffer = fs.readFileSync(msg.replace('file:///', ''))
        contentType = contentType.split('/')[0] + '/' + msg.substring(msg.lastIndexOf('.') + 1)
    } else {
        buffer = fs.readFileSync(msg)
        contentType = contentType.split('/')[0] + '/' + msg.substring(msg.lastIndexOf('.') + 1)
    }
    const blob = new Blob([buffer], { type: contentType })
    const formData = new FormData()
    formData.append('file', blob, 'ws-plugin.' + contentType.split('/')[1])
    const file = await bot.sendApi('POST', 'upload', formData)
    if (file.error) {
        throw file.error
    }
    file.contentType = contentType
    return file
}

async function uploadAudio(file) {
    let buffer
    if (file.match(/^base64:\/\//)) {
        buffer = Buffer.from(file.replace(/^base64:\/\//, ""), 'base64')
    } else if (file.startsWith('http')) {
        const http = await fetch(file)
        const arrayBuffer = await http.arrayBuffer()
        buffer = Buffer.from(arrayBuffer)
    } else if (file.startsWith('file:///')) {
        buffer = fs.readFileSync(file.replace('file:///', ''))
    }
    const head = buffer.subarray(0, 7).toString()
    let filePath
    let duration = 0
    if (!head.includes('SILK')) {
        const tmpPath = await saveTmp(buffer)
        duration = await getDuration(tmpPath)
        const res = await audioTrans(tmpPath)
        filePath = res.silkFile
        buffer = fs.readFileSync(filePath)
    } else {
        filePath = await saveTmp(buffer)
    }

    const hash = createHash('md5')
    hash.update(buffer.toString('binary'), 'binary')
    const md5 = hash.digest('hex')
    return {
        elementType: 4,
        pttElement: {
            md5HexStr: md5,
            fileSize: buffer.length,
            fileName: md5 + '.amr',
            filePath: filePath,
            // waveAmplitudes: [36, 28, 68, 28, 84, 28],
            waveAmplitudes: [
                99, 99, 99, 99, 99, 99, 99, 99, 99, 99, 99, 99, 99, 99, 99, 99, 99
            ],
            duration: duration
        }
    }
}

function audioTrans(tmpPath, samplingRate = '24000') {
    return new Promise((resolve, reject) => {
        const pcmFile = join(TMP_DIR, randomUUID({ disableEntropyCache: true }))
        exec(`ffmpeg -y -i "${tmpPath}" -ar ${samplingRate} -ac 1 -f s16le "${pcmFile}"`, async () => {
            fs.unlink(tmpPath, () => { })
            fs.access(pcmFile, fs.constants.F_OK, (err) => {
                if (err) {
                    reject('音频转码失败, 请确保你的 ffmpeg 已正确安装')
                }
            })

            const silkFile = join(TMP_DIR, randomUUID({ disableEntropyCache: true }))
            try {
                await pcmToSilk(pcmFile, silkFile, samplingRate)
            } catch (error) {
                reject('red发送语音暂不支持非win系统')
            }
            fs.unlink(pcmFile, () => { })

            resolve({
                silkFile
            })
        })
    })
}

function pcmToSilk(input, output, samplingRate) {
    return new Promise((resolve, reject) => {
        const args = ['-i', input, '-s', samplingRate, '-o', output]
        const __filename = fileURLToPath(import.meta.url);
        const __dirname = dirname(__filename);
        const child = spawn(join(__dirname, './cli.exe'), args)
        child.on('exit', () => {
            fs.access(output, fs.constants.F_OK, (err) => {
                if (err) {
                    reject('音频转码失败')
                }
            })
            // fs.stat(output, (err, stats) => {
            //     if (err) {
            //         console.error(err);
            //         return;
            //     }
            //     fs.truncate(output, stats.size - 1, err => {
            //         if (err) {
            //             console.error(err);
            //             return;
            //         }
            //     });
            // });
            resolve()
        })
    })
}

function getDuration(file) {
    return new Promise((resolve, reject) => {
        exec(`ffmpeg -i ${file}`, function (err, stdout, stderr) {
            const outStr = stderr.toString()
            const regDuration = /Duration\: ([0-9\:\.]+),/
            const rs = regDuration.exec(outStr)
            if (rs === null) {
                reject("获取音频时长失败, 请确保你的 ffmpeg 已正确安装")
            } else if (rs[1]) {
                const time = rs[1]
                const parts = time.split(":")
                const seconds = (+parts[0]) * 3600 + (+parts[1]) * 60 + (+parts[2])
                const round = seconds.toString().split('.')[0]
                resolve(+ round)
            }
        })
    })
}

async function saveTmp(data, ext = null) {
    ext = ext ? '.' + ext : ''
    const filename = randomUUID({ disableEntropyCache: true }) + ext
    const tmpPath = resolve(TMP_DIR, filename)
    fs.writeFileSync(tmpPath, data)
    return tmpPath
}

async function getNtPath(bot) {
    let dataPath = await redis.get('ws-plugin:qqnt:dataPath')
    if (!dataPath) {
        try {
            const buffer = fs.readFileSync('./plugins/ws-plugin/resources/common/cont/logo.png')
            const blob = new Blob([buffer], { type: 'image/png' })
            const formData = new FormData()
            formData.append('file', blob, '1.png')
            const file = await bot.sendApi('POST', 'upload', formData)
            fs.unlinkSync(file.ntFilePath)
            const index = file.ntFilePath.indexOf('nt_data');
            dataPath = file.ntFilePath.slice(0, index + 'nt_data'.length);
            await redis.set('ws-plugin:qqnt:dataPath', dataPath)
        } catch (error) {
            return null
        }
    }
    return dataPath
}

async function uploadVideo(bot, file) {
    let type = 'mp4'
    if (file.match(/^base64:\/\//)) {
        const buffer = Buffer.from(file.replace(/^base64:\/\//, ""), 'base64')
        file = join(TMP_DIR, randomUUID({ disableEntropyCache: true }) + '.' + type)
        fs.writeFileSync(file, buffer)
    } else {
        file = file.replace('file:///', '')
        type = file.substring(file.lastIndexOf('.') + 1)
        const Temp = join(TMP_DIR, randomUUID({ disableEntropyCache: true }) + '.' + type)
        fs.copyFileSync(file, Temp)
        file = Temp
    }
    const ntPath = await getNtPath(bot)
    if (!ntPath) return
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;
    const date = `${year}-${month.toString().padStart(2, '0')}`;
    const video = await getVideoInfo(file)

    let oriPath = `${ntPath}/Video`
    if (!fs.existsSync(oriPath)) fs.mkdirSync(oriPath)
    oriPath = `${oriPath}/${date}`
    if (!fs.existsSync(oriPath)) fs.mkdirSync(oriPath)
    oriPath = `${oriPath}/Ori`
    if (!fs.existsSync(oriPath)) fs.mkdirSync(oriPath)
    oriPath = `${oriPath}/${video.videoMd5}.${type}`

    let thumbPath = `${ntPath}/Video/${date}/Thumb`
    if (!fs.existsSync(thumbPath)) fs.mkdirSync(thumbPath)
    thumbPath = `${thumbPath}/${video.videoMd5}_0.png`

    fs.copyFileSync(file, oriPath)
    fs.unlinkSync(file)
    const thumb = await getThumbInfo(oriPath, thumbPath)
    return {
        elementType: 5,
        videoElement: {
            filePath: oriPath,
            fileName: video.videoMd5 + '.' + type,
            videoMd5: video.videoMd5,
            thumbMd5: thumb.thumbMd5,
            fileTime: video.fileTime,
            thumbSize: thumb.thumbSize,
            fileSize: video.fileSize,
            thumbWidth: thumb.thumbWidth,
            thumbHeight: thumb.thumbHeight
        }
    }
}

async function getVideoInfo(file) {
    const fileTime = await getVideoTime(file)
    const videoMd5 = await getVideoMd5(file)
    const fileSize = fs.readFileSync(file).length
    return {
        fileTime,
        videoMd5,
        fileSize
    }
}

function getVideoMd5(file) {
    return new Promise((resolve, reject) => {
        const stream = fs.createReadStream(file);
        const hash = createHash('md5');
        stream.on('data', chunk => {
            hash.update(chunk);
        });
        stream.on('end', () => {
            const md5 = hash.digest('hex');
            resolve(md5)
        });
    })
}

function getVideoTime(file) {
    return new Promise((resolve, reject) => {
        exec(`ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${file}"`, (error, stdout, stderr) => {
            if (error) {
                reject('获取视频长度失败, 请确保你的 ffmpeg 已正确安装')
            }
            const durationInSeconds = parseInt(stdout);
            resolve(durationInSeconds)
        });
    })
}

async function getThumbInfo(file, thumbPath) {

    const tempPath = join(TMP_DIR, randomUUID({ disableEntropyCache: true }) + '.jpg')

    const { thumbMd5, thumbSize } = await extractThumbnail(file, tempPath);

    const { thumbWidth, thumbHeight } = getImageSize(tempPath);

    fs.copyFileSync(tempPath, thumbPath)
    fs.unlinkSync(tempPath)

    return { thumbMd5, thumbWidth, thumbHeight, thumbSize };
}

function extractThumbnail(inputFile, outputFile) {
    return new Promise((resolve, reject) => {
        exec(`ffmpeg -i "${inputFile}" -ss 00:00:00.000 -vframes 1 -vf "scale=iw/3:ih/3" "${outputFile}"
        `, async () => {
            fs.access(outputFile, fs.constants.F_OK, (err) => {
                if (err) {
                    reject('获取视频封面失败, 请确保你的 ffmpeg 已正确安装')
                }
            })

            const buffer = fs.readFileSync(outputFile);
            const hash = createHash('md5');
            hash.update(buffer);
            resolve({
                thumbMd5: hash.digest('hex'),
                thumbSize: buffer.length
            })
        })
    })
}

function getImageSize(file) {
    const buffer = fs.readFileSync(file);
    const start = buffer.indexOf(Buffer.from([0xff, 0xc0]));
    const thumbHeight = buffer.readUInt16BE(start + 5);
    const thumbWidth = buffer.readUInt16BE(start + 7);
    return { thumbWidth, thumbHeight };
}

async function uploadFile(file) {
    let buffer, name, path = process.cwd() + '/plugins/ws-plugin/Temp/'
    if (file.startsWith('http')) {
        const http = await fetch(file)
        const arrayBuffer = await http.arrayBuffer()
        buffer = Buffer.from(arrayBuffer)
        name = file.substring(file.lastIndexOf('/') + 1)
        path = path + name
        fs.writeFileSync(path, buffer);
    } else if (file.startsWith('file:///')) {
        buffer = fs.readFileSync(file.replace('file:///', ''))
        name = file.substring(file.lastIndexOf('/') + 1)
        path = path + name
        fs.copyFileSync(file, path)
    } else if (Buffer.isBuffer(file)) {
        buffer = file
        name = 'buffer'
        path = path + name
        fs.writeFileSync(path, buffer);
    } else {
        buffer = fs.readFileSync(file)
        name = file.substring(file.lastIndexOf('/') + 1)
        path = path + name
        fs.copyFileSync(file, path)
    }
    const size = buffer.length
    const hash = createHash('md5');
    hash.update(buffer);
    const md5 = hash.digest('hex')
    return {
        elementType: 3,
        fileElement: {
            fileMd5: md5,
            fileName: name,
            filePath: path,
            fileSize: size,
        }
    }
}

function getToken() {
    let tokenPath
    try {
        if (os.platform() === 'win32') {
            tokenPath = `${redPath}/config/chronocat.yml`
            if (fs.existsSync(tokenPath)) {
                const data = YAML.parse(fs.readFileSync(tokenPath, 'utf-8'))
                for (const i of data?.servers || []) {
                    if (i.type === 'red') {
                        return i.token
                    }
                }
                logger.error('[ws-plugin] 请检查chronocat配置是否开启red服务')
                return false
            } else {
                tokenPath = `${redPath}/RED_PROTOCOL_TOKEN`
                return fs.readFileSync(tokenPath, 'utf-8')
            }
        } else {
            logger.error('[ws-plugin] 非Windows系统请自行获取Token')
            return false
        }
    } catch (error) {
        logger.error('[ws-plugin] QQNT自动获取Token失败,请检查是否已安装Chronocat并尝试手动获取')
        logger.error(error)
        return false
    }
}

export {
    uploadImg,
    uploadAudio,
    uploadVideo,
    uploadFile,
    getToken,
    getNtPath,
    roleMap,
    redPath
}
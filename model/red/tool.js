import fs from 'fs'
import { createHash, randomUUID } from 'crypto'
import { resolve, join, dirname, basename } from 'path'
import fetch, { FormData, Blob } from 'node-fetch'
import { exec, spawn, execSync } from 'child_process'
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
    } if (Buffer.isBuffer(msg)) {
        buffer = msg
    } else if (msg.match(/^base64:\/\//)) {
        buffer = Buffer.from(msg.replace(/^base64:\/\//, ""), 'base64')
    } else if (msg.startsWith('http')) {
        const img = await fetch(msg)
        const type = img.headers.get('content-type');
        if (type) contentType = type
        const arrayBuffer = await img.arrayBuffer()
        buffer = Buffer.from(arrayBuffer)
    } else if (msg.startsWith('file://')) {
        try {
            buffer = fs.readFileSync(msg.replace(/^file:\/\//, ''))
        } catch (error) {
            buffer = fs.readFileSync(msg.replace(/^file:\/\/\//, ''))
        }
        contentType = contentType.split('/')[0] + '/' + msg.substring(msg.lastIndexOf('.') + 1)
    } else if (/^.{32}\.image$/.test(msg)) {
        const img = await fetch(`https://gchat.qpic.cn/gchatpic_new/0/0-0-${msg.replace('.image', '').toUpperCase()}/0`)
        const type = img.headers.get('content-type');
        if (type) contentType = type
        const arrayBuffer = await img.arrayBuffer()
        buffer = Buffer.from(arrayBuffer)
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

async function uploadAudio(bot, file) {
    let voice
    if (file.match(/^base64:\/\//)) {
        voice = Buffer.from(file.replace(/^base64:\/\//, ""), 'base64')
    } else if (file.startsWith('http')) {
        const http = await fetch(file)
        const arrayBuffer = await http.arrayBuffer()
        voice = Buffer.from(arrayBuffer)
    } else if (file.startsWith('file://')) {
        try {
            voice = fs.readFileSync(file.replace(/^file:\/\//, ''))
        } catch (error) {
            voice = fs.readFileSync(file.replace(/^file:\/\/\//, ''))
        }
    } else {
        return false
    }
    const head = voice.subarray(0, 7)
    if (!head.includes('\x02#!SILK')) {
        const tmpPath = await saveTmp(voice)
        const pcm = await audioTransPcm(tmpPath)
        voice = Buffer.from(await silk.encode(pcm, 24000))
    }
    const duration = Math.round(silk.getDuration(voice) / 1000)
    const blob = new Blob([voice], { type: 'audio/amr' })
    const formData = new FormData()
    formData.append('file', blob, 'file.amr')
    const res = await bot.sendApi('POST', 'upload', formData)
    return {
        elementType: 4,
        pttElement: {
            md5HexStr: res.md5,
            fileSize: String(res.fileSize),
            fileName: basename(res.ntFilePath),
            filePath: res.ntFilePath,
            waveAmplitudes: [
                99, 99, 99, 99, 99, 99, 99, 99, 99, 99, 99, 99, 99, 99, 99, 99, 99, 99, 99, 99, 99, 99, 99, 99, 99, 99,
            ],
            duration,
            formatType: 1
        }
    }
}

function audioTransPcm(tmpPath, samplingRate = '24000') {
    return new Promise((resolve, reject) => {
        const pcmPath = join(TMP_DIR, randomUUID({ disableEntropyCache: true }))
        exec(`ffmpeg -y -i "${tmpPath}" -ar ${samplingRate} -ac 1 -f s16le "${pcmPath}"`, async () => {
            fs.unlink(tmpPath, () => { })
            try {
                const pcm = fs.readFileSync(pcmPath)
                resolve(pcm)
            } catch {
                reject('音频转码失败, 请确保 ffmpeg 已正确安装')
            } finally {
                fs.unlink(pcmPath, () => { })
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
    let dataPath
    try {
        const buffer = fs.readFileSync('./plugins/ws-plugin/resources/common/cont/logo.png')
        const blob = new Blob([buffer], { type: 'image/png' })
        const formData = new FormData()
        formData.append('file', blob, '1.png')
        const file = await bot.sendApi('POST', 'upload', formData)
        fs.unlinkSync(file.ntFilePath)
        const index = file.ntFilePath.indexOf('nt_data');
        dataPath = file.ntFilePath.slice(0, index + 'nt_data'.length);
    } catch (error) {
        return null
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
        file = file.replace(/file:\/{2,3}/, '')
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
    } else if (file.startsWith('file://')) {
        try {
            buffer = fs.readFileSync(file.replace(/^file:\/\//, ''))
        } catch (error) {
            buffer = fs.readFileSync(file.replace(/^file:\/\/\//, ''))
        }
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

async function getSilk() {
    let silk
    const version = JSON.parse(fs.readFileSync('./plugins/ws-plugin/package.json', 'utf-8'))?.dependencies['silk-wasm'].replace(/^[^\d]*/, '')
    try {
        silk = await import('silk-wasm')
    } catch (error) {
        const startTime = new Date();
        logger.warn('[ws-plugin] 未安装silk-wasm依赖,开始执行安装');
        execSync(`pnpm install --filter=ws-plugin`);
        const endTime = new Date();
        logger.mark(`[ws-plugin] 安装完成,耗时${endTime - startTime}ms,建议重启以应用更新`);
    }
    let installedVersion = execSync('cd "plugins/ws-plugin" && pnpm list silk-wasm', { encoding: 'utf8' });
    installedVersion = /silk-wasm (\d+\.\d+\.\d+)/.exec(installedVersion)?.[1]
    if (version != installedVersion) {
        const startTime = new Date();
        logger.warn(`[ws-plugin] silk-wasm依赖版本不一致,开始执行安装`);
        execSync(`pnpm install --filter=ws-plugin`);
        const endTime = new Date();
        logger.mark(`[ws-plugin] 安装完成,耗时${endTime - startTime}ms,建议重启以应用更新`);
    }
    try {
        silk = await import('silk-wasm')
    } catch (error) {
        logger.error('[ws-plugin] silk-wasm依赖导入失败,如果是初次安装请重启')
    }
    return silk
}
const silk = await getSilk()

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
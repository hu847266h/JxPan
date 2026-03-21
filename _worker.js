// Cloudflare Workers - 网盘解析脚本
// 支持: 阿里云盘(alipan.com) | 小飞机网盘(feijipan.com) | 蓝奏云优享版(ilanzou.com) | 蓝奏云(lanzou*.com) | 夸克网盘(quark.cn) | UC网盘(drive.uc.cn)  | 移动云盘(yun.139.com)


const cookieCache = {
    aliyun: { value: null, timestamp: 0 },
    quark: { value: null, timestamp: 0 },
    uc: { value: null, timestamp: 0 },
    mcloud: { value: null, timestamp: 0 }
};

// Cookie 有效期：24小时
const COOKIE_MAX_AGE = 24 * 60 * 60 * 1000;

// ============================== Cookie 管理类 ==============================
class CookieManager {
    constructor(type, envValue) {
        this.type = type;
        this.envValue = envValue;
    }

    getValidCookie() {
        const now = Date.now();
        const cached = cookieCache[this.type];
        
        
        if (cached.value && (now - cached.timestamp) < COOKIE_MAX_AGE) {
            const remaining = COOKIE_MAX_AGE - (now - cached.timestamp);
            const remainingMinutes = Math.floor(remaining / 60000);
            console.log(`[${this.type}] 使用缓存的 Cookie，剩余有效期: ${remainingMinutes}分钟`);
            return {
                value: cached.value,
                isCached: true,
                expired: false,
                remainingTime: remaining
            };
        }
        
        if (this.envValue) {
            cookieCache[this.type] = {
                value: this.envValue,
                timestamp: now
            };
            console.log(`[${this.type}] Cookie 已更新，新的24小时有效期开始计时`);
            return {
                value: this.envValue,
                isCached: false,
                expired: false,
                remainingTime: COOKIE_MAX_AGE
            };
        }
        
        return {
            value: null,
            isCached: false,
            expired: true,
            remainingTime: 0
        };
    }

    invalidate() {
        cookieCache[this.type] = { value: null, timestamp: 0 };
        console.log(`[${this.type}] Cookie 已被标记为失效`);
    }


    getStatus() {
        const cached = cookieCache[this.type];
        const now = Date.now();
        
        if (!this.envValue) {
            return {
                configured: false,
                valid: false,
                message: '未配置环境变量'
            };
        }
        
        if (!cached.value) {
            return {
                configured: true,
                valid: true,
                cached: false,
                message: '已配置，尚未使用（将在首次请求时激活24小时有效期）'
            };
        }
        
        const age = now - cached.timestamp;
        const remaining = COOKIE_MAX_AGE - age;
        
        if (remaining > 0) {
            const remainingMinutes = Math.floor(remaining / 60000);
            const remainingSeconds = Math.floor((remaining % 60000) / 1000);
            return {
                configured: true,
                valid: true,
                cached: true,
                age: Math.floor(age / 1000),
                remaining: remainingMinutes * 60 + remainingSeconds,
                message: `Cookie 有效，剩余时间: ${remainingMinutes}分${remainingSeconds}秒`
            };
        } else {
            return {
                configured: true,
                valid: false,
                cached: true,
                expired: true,
                age: Math.floor(age / 1000),
                message: 'Cookie 已过期（超过24小时），请重新配置'
            };
        }
    }
}

// ============================== cookie配置获取 ==============================
function getConfig(env) {
    const defaults = {
        // 通用配置
        cache: false,
        cacheexpired: 2000,
        foldercache: false,
        "auto-switch": true,
        mode: "pc",
        "redirect-url": false,
        
        // 阿里云盘
        aliyun: {
            enabled: true,
            authorization: "",
            userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
        },
        
        // 夸克网盘
        quark: {
            enabled: true,
            cookie: "",
            userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) quark-cloud-drive/2.5.20 Chrome/100.0.4896.160 Electron/18.3.5.4-b478491100 Safari/537.36 Channel/pckk_other_ch"
        },
        
        // UC网盘
        uc: {
            enabled: true,
            cookie: "",
            userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
        },
        
        // 移动云盘
        mcloud: {
            enabled: true,
            authorization: "",
            cookie: "",
            userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36 Edg/145.0.0.0"
        }
    };

    // 获取变量
    return {
        // 通用配置
        cache: env.CACHE === 'true' || defaults.cache,
        cacheexpired: parseInt(env.CACHE_EXPIRED) || defaults.cacheexpired,
        foldercache: env.FOLDER_CACHE === 'true' || defaults.foldercache,
        "auto-switch": env.AUTO_SWITCH !== 'false',
        mode: env.MODE || defaults.mode,
        "redirect-url": env.REDIRECT_URL === 'true' || defaults["redirect-url"],
        
        // 阿里云盘
        aliyun: {
            enabled: env.ALIYUN_ENABLED !== 'false',
            authorization: env.ALIYUN_AUTHORIZATION || defaults.aliyun.authorization,
            userAgent: env.ALIYUN_USER_AGENT || defaults.aliyun.userAgent
        },
        
        // 夸克网盘
        quark: {
            enabled: env.QK_ENABLED !== 'false',
            cookie: env.QK_COOKIE || defaults.quark.cookie,
            userAgent: env.QK_USER_AGENT || defaults.quark.userAgent
        },
        
        // UC网盘
        uc: {
            enabled: env.UC_ENABLED !== 'false',
            cookie: env.UC_COOKIE || defaults.uc.cookie,
            userAgent: env.UC_USER_AGENT || defaults.uc.userAgent
        },
        
        // 移动云盘
        mcloud: {
            enabled: env.MCLOUD_ENABLED !== 'false',
            authorization: env.MCLOUD_AUTHORIZATION || defaults.mcloud.authorization,
            cookie: env.MCLOUD_COOKIE || defaults.mcloud.cookie,
            userAgent: env.MCLOUD_USER_AGENT || defaults.mcloud.userAgent
        }
    };
}

// ============================== AES-128-ECB函数工具 ==============================
class AES128ECB {
    constructor(key) {
        const encoder = new TextEncoder();
        const keyBytes = encoder.encode(key);
        this.key = new Uint8Array(16);
        
        if (keyBytes.length >= 16) {
            this.key.set(keyBytes.slice(0, 16));
        } else {
            this.key.set(keyBytes);
            for (let i = keyBytes.length; i < 16; i++) {
                this.key[i] = 0;
            }
        }
        
        this.sBox = [
            0x63, 0x7c, 0x77, 0x7b, 0xf2, 0x6b, 0x6f, 0xc5, 0x30, 0x01, 0x67, 0x2b, 0xfe, 0xd7, 0xab, 0x76,
            0xca, 0x82, 0xc9, 0x7d, 0xfa, 0x59, 0x47, 0xf0, 0xad, 0xd4, 0xa2, 0xaf, 0x9c, 0xa4, 0x72, 0xc0,
            0xb7, 0xfd, 0x93, 0x26, 0x36, 0x3f, 0xf7, 0xcc, 0x34, 0xa5, 0xe5, 0xf1, 0x71, 0xd8, 0x31, 0x15,
            0x04, 0xc7, 0x23, 0xc3, 0x18, 0x96, 0x05, 0x9a, 0x07, 0x12, 0x80, 0xe2, 0xeb, 0x27, 0xb2, 0x75,
            0x09, 0x83, 0x2c, 0x1a, 0x1b, 0x6e, 0x5a, 0xa0, 0x52, 0x3b, 0xd6, 0xb3, 0x29, 0xe3, 0x2f, 0x84,
            0x53, 0xd1, 0x00, 0xed, 0x20, 0xfc, 0xb1, 0x5b, 0x6a, 0xcb, 0xbe, 0x39, 0x4a, 0x4c, 0x58, 0xcf,
            0xd0, 0xef, 0xaa, 0xfb, 0x43, 0x4d, 0x33, 0x85, 0x45, 0xf9, 0x02, 0x7f, 0x50, 0x3c, 0x9f, 0xa8,
            0x51, 0xa3, 0x40, 0x8f, 0x92, 0x9d, 0x38, 0xf5, 0xbc, 0xb6, 0xda, 0x21, 0x10, 0xff, 0xf3, 0xd2,
            0xcd, 0x0c, 0x13, 0xec, 0x5f, 0x97, 0x44, 0x17, 0xc4, 0xa7, 0x7e, 0x3d, 0x64, 0x5d, 0x19, 0x73,
            0x60, 0x81, 0x4f, 0xdc, 0x22, 0x2a, 0x90, 0x88, 0x46, 0xee, 0xb8, 0x14, 0xde, 0x5e, 0x0b, 0xdb,
            0xe0, 0x32, 0x3a, 0x0a, 0x49, 0x06, 0x24, 0x5c, 0xc2, 0xd3, 0xac, 0x62, 0x91, 0x95, 0xe4, 0x79,
            0xe7, 0xc8, 0x37, 0x6d, 0x8d, 0xd5, 0x4e, 0xa9, 0x6c, 0x56, 0xf4, 0xea, 0x65, 0x7a, 0xae, 0x08,
            0xba, 0x78, 0x25, 0x2e, 0x1c, 0xa6, 0xb4, 0xc6, 0xe8, 0xdd, 0x74, 0x1f, 0x4b, 0xbd, 0x8b, 0x8a,
            0x70, 0x3e, 0xb5, 0x66, 0x48, 0x03, 0xf6, 0x0e, 0x61, 0x35, 0x57, 0xb9, 0x86, 0xc1, 0x1d, 0x9e,
            0xe1, 0xf8, 0x98, 0x11, 0x69, 0xd9, 0x8e, 0x94, 0x9b, 0x1e, 0x87, 0xe9, 0xce, 0x55, 0x28, 0xdf,
            0x8c, 0xa1, 0x89, 0x0d, 0xbf, 0xe6, 0x42, 0x68, 0x41, 0x99, 0x2d, 0x0f, 0xb0, 0x54, 0xbb, 0x16
        ];
        
        this.invSBox = new Array(256);
        for (let i = 0; i < 256; i++) {
            this.invSBox[this.sBox[i]] = i;
        }
        
        this.rCon = [0x01, 0x02, 0x04, 0x08, 0x10, 0x20, 0x40, 0x80, 0x1b, 0x36];
    }

    subBytes(state) {
        for (let i = 0; i < 16; i++) {
            state[i] = this.sBox[state[i]];
        }
    }

    shiftRows(state) {
        const temp = [...state];
        state[1] = temp[5];
        state[5] = temp[9];
        state[9] = temp[13];
        state[13] = temp[1];
        state[2] = temp[10];
        state[6] = temp[14];
        state[10] = temp[2];
        state[14] = temp[6];
        state[3] = temp[15];
        state[7] = temp[3];
        state[11] = temp[7];
        state[15] = temp[11];
    }

    gmul(a, b) {
        let p = 0;
        for (let i = 0; i < 8; i++) {
            if ((b & 1) !== 0) {
                p ^= a;
            }
            const hiBitSet = (a & 0x80) !== 0;
            a <<= 1;
            if (hiBitSet) {
                a ^= 0x1b;
            }
            b >>= 1;
        }
        return p & 0xff;
    }

    mixColumns(state) {
        for (let i = 0; i < 4; i++) {
            const s0 = state[i * 4];
            const s1 = state[i * 4 + 1];
            const s2 = state[i * 4 + 2];
            const s3 = state[i * 4 + 3];

            state[i * 4] = this.gmul(0x02, s0) ^ this.gmul(0x03, s1) ^ s2 ^ s3;
            state[i * 4 + 1] = s0 ^ this.gmul(0x02, s1) ^ this.gmul(0x03, s2) ^ s3;
            state[i * 4 + 2] = s0 ^ s1 ^ this.gmul(0x02, s2) ^ this.gmul(0x03, s3);
            state[i * 4 + 3] = this.gmul(0x03, s0) ^ s1 ^ s2 ^ this.gmul(0x02, s3);
        }
    }

    addRoundKey(state, roundKey) {
        for (let i = 0; i < 16; i++) {
            state[i] ^= roundKey[i];
        }
    }

    keyExpansion() {
        const expandedKey = new Uint8Array(176);
        expandedKey.set(this.key);

        let bytesGenerated = 16;
        let rconIteration = 1;
        const temp = new Uint8Array(4);

        while (bytesGenerated < 176) {
            for (let i = 0; i < 4; i++) {
                temp[i] = expandedKey[bytesGenerated - 4 + i];
            }

            if (bytesGenerated % 16 === 0) {
                const t = temp[0];
                temp[0] = temp[1];
                temp[1] = temp[2];
                temp[2] = temp[3];
                temp[3] = t;

                for (let i = 0; i < 4; i++) {
                    temp[i] = this.sBox[temp[i]];
                }

                temp[0] ^= this.rCon[rconIteration - 1];
                rconIteration++;
            }

            for (let i = 0; i < 4; i++) {
                expandedKey[bytesGenerated] = expandedKey[bytesGenerated - 16] ^ temp[i];
                bytesGenerated++;
            }
        }

        return expandedKey;
    }

    encryptBlock(input) {
        const state = new Uint8Array(16);
        state.set(input);

        const expandedKey = this.keyExpansion();
        this.addRoundKey(state, expandedKey.slice(0, 16));

        for (let round = 1; round < 10; round++) {
            this.subBytes(state);
            this.shiftRows(state);
            this.mixColumns(state);
            this.addRoundKey(state, expandedKey.slice(round * 16, (round + 1) * 16));
        }

        this.subBytes(state);
        this.shiftRows(state);
        this.addRoundKey(state, expandedKey.slice(160, 176));

        return state;
    }

    pkcs7Pad(data) {
        const blockSize = 16;
        const padding = blockSize - (data.length % blockSize);
        const padded = new Uint8Array(data.length + padding);
        padded.set(data);
        for (let i = data.length; i < padded.length; i++) {
            padded[i] = padding;
        }
        return padded;
    }

    encryptHex(plaintext) {
        const encoder = new TextEncoder();
        const data = encoder.encode(plaintext);
        const padded = this.pkcs7Pad(data);
        
        let result = '';
        for (let i = 0; i < padded.length; i += 16) {
            const block = padded.slice(i, i + 16);
            const encrypted = this.encryptBlock(block);
            for (let j = 0; j < 16; j++) {
                result += encrypted[j].toString(16).padStart(2, '0');
            }
        }
        
        return result.toLowerCase();
    }
}

// ============================== 工具函数 ==============================
function generateUUID() {
    const chars = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ-_';
    let result = '';
    for (let i = 0; i < 21; i++) {
        result += chars[Math.floor(Math.random() * 64)];
    }
    return result;
}

function getTimestamp() {
    return Date.now();
}

function acwScV2Simple(arg1) {
    const posList = [15,35,29,24,33,16,1,38,10,9,19,31,40,27,22,23,25,13,6,11,39,18,20,8,14,21,32,26,2,30,7,4,17,5,3,28,34,37,12,36];
    const mask = '3000176000856006061501533003690027800375';
    const outPutList = new Array(40).fill('');
    
    for (let i = 0; i < arg1.length; i++) {
        const char = arg1[i];
        for (let j = 0; j < posList.length; j++) {
            if (posList[j] === i + 1) {
                outPutList[j] = char;
            }
        }
    }
    
    const arg2 = outPutList.join('');
    let result = '';
    const length = Math.min(arg2.length, mask.length);
    
    for (let i = 0; i < length; i += 2) {
        const strHex = arg2.substr(i, 2);
        const maskHex = mask.substr(i, 2);
        const xorResult = (parseInt(strHex, 16) ^ parseInt(maskHex, 16)).toString(16);
        result += xorResult.padStart(2, '0');
    }
    
    return result;
}

function formatFileSize(size) {
    try {
        size = parseInt(size);
        const units = ['B', 'KB', 'MB', 'GB', 'TB'];
        let unitIndex = 0;
        let fileSize = parseFloat(size);
        
        while (fileSize >= 1024 && unitIndex < units.length - 1) {
            fileSize /= 1024;
            unitIndex++;
        }
        
        return `${fileSize.toFixed(2)} ${units[unitIndex]}`;
    } catch {
        return "未知大小";
    }
}

function formatDuration(ms) {
    const minutes = Math.floor(ms / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);
    return `${minutes}分${seconds}秒`;
}

// ============================== 阿里云盘解析器 ==============================
class AliyunPanParser {
    constructor(config) {
        this.config = config;
        this.cookieManager = new CookieManager('aliyun', config.aliyun.authorization);
        this.userAgent = config.aliyun.userAgent;
        this.apiBase = 'https://api.aliyundrive.com';
        this.userDriveId = null;
        this.cachedTokens = {};
    }

    async parse(shareUrl, password = '') {
        try {
            if (!this.config.aliyun.enabled) {
                return { code: 503, msg: '阿里云盘解析已禁用', success: false, data: null };
            }

            const cookieStatus = this.cookieManager.getValidCookie();
            
            if (!cookieStatus.value) {
                return { 
                    code: 401, 
                    msg: '阿里云盘 Authorization Token 未配置 (ALIYUN_AUTHORIZATION)', 
                    success: false, 
                    data: null 
                };
            }

            if (cookieStatus.expired) {
                return {
                    code: 401,
                    msg: '阿里云盘 Authorization 已过期（超过2小时），请重新配置 ALIYUN_AUTHORIZATION',
                    success: false,
                    data: {
                        expired: true,
                        hint: 'Authorization 有效期为2小时，从配置完成时开始计时'
                    }
                };
            }

            this.authToken = cookieStatus.value;
            if (!this.authToken.startsWith('Bearer ')) {
                this.authToken = 'Bearer ' + this.authToken;
            }

            this.baseHeaders = {
                'User-Agent': this.userAgent,
                'Accept': 'application/json, text/plain, */*',
                'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
                'Content-Type': 'application/json;charset=UTF-8',
                'Origin': 'https://www.alipan.com',
                'Referer': 'https://www.alipan.com/',
                'X-Canary': 'client=windows,app=adrive,version=v6.0.0',
                'Authorization': this.authToken
            };

            const { shareId, extractedPwd } = this.extractShareInfo(shareUrl);
            if (!shareId) {
                return { code: 400, msg: '无法解析阿里云盘分享链接', success: false, data: null };
            }

            const pwd = password || extractedPwd;

            const shareInfo = await this.getShareInfo(shareId);
            if (!shareInfo) {
                return { code: 404, msg: '获取分享信息失败，链接可能已失效', success: false, data: null };
            }

            const shareToken = await this.getShareToken(shareId, pwd);
            if (!shareToken) {
                return { 
                    code: 401, 
                    msg: '获取访问令牌失败' + (shareInfo.share_pwd ? '，需要正确的分享密码' : '，Authorization可能已失效'), 
                    success: false, 
                    data: null 
                };
            }

            const files = await this.listShareFiles(shareId, shareToken);
            if (!files || files.length === 0) {
                return { code: 404, msg: '分享中没有文件，可能是Authorization失效或分享链接失效，请检查Authorization是否失效', success: false, data: null };
            }

            const fileList = files.filter(f => f.type === 'file');
            
            if (fileList.length === 0) {
                return { code: 404, msg: '没有可下载的文件（可能都是文件夹）', success: false, data: null };
            }

            const driveId = await this.getDriveId();
            if (!driveId) {
                this.cookieManager.invalidate();
                return { 
                    code: 401, 
                    msg: '获取用户信息失败，Authorization 可能已过期，请重新配置 ALIYUN_AUTHORIZATION', 
                    success: false, 
                    data: { expired: true }
                };
            }

            const results = [];
            for (const fileInfo of fileList) {
                const fileName = fileInfo.name || '未知文件';
                const fileId = fileInfo.file_id;
                
                const newFileId = await this.saveToMyDrive(shareId, fileId, shareToken);
                if (!newFileId) {
                    continue;
                }
                
                const downloadUrl = await this.getDownloadUrl(driveId, newFileId);
                if (downloadUrl) {
                    results.push({
                        file_id: fileId,
                        file_name: fileName,
                        file_size: formatFileSize(fileInfo.size || 0),
                        download_url: downloadUrl,
                        drive_id: driveId,
                        new_file_id: newFileId
                    });
                }
            }

            if (results.length === 0) {
                return { code: 502, msg: '获取下载链接失败，所有文件处理失败', success: false, data: null };
            }

            const isSingleFile = results.length === 1;
            const responseData = isSingleFile ? results[0] : {
                file_count: results.length,
                files: results
            };

            const remainingTime = cookieStatus.remainingTime;
            
            return {
                code: 200,
                msg: '解析成功',
                success: true,
                shareKey: 'al:' + shareId,
                cookie_status: {
                    valid: true,
                    remaining_time: formatDuration(remainingTime),
                    remaining_seconds: Math.floor(remainingTime / 1000)
                },
                data: responseData
            };

        } catch (e) {
            return { code: 500, msg: '解析失败: ' + e.message, success: false, data: null };
        }
    }

    extractShareInfo(shareUrl) {
        if (!shareUrl.startsWith('http://') && !shareUrl.startsWith('https://')) {
            shareUrl = 'https://' + shareUrl;
        }

        try {
            shareUrl = decodeURIComponent(shareUrl);
        } catch (e) {
        }

        const patterns = [
            /https?:\/\/(?:www\.)?alipan\.com\/s\/([a-zA-Z0-9]+)(?:\?.*pwd=([a-zA-Z0-9]+))?/i,
            /https?:\/\/(?:www\.)?aliyundrive\.com\/s\/([a-zA-Z0-9]+)(?:\?.*pwd=([a-zA-Z0-9]+))?/i,
            /\/s\/([a-zA-Z0-9]+)(?:\?.*pwd=([a-zA-Z0-9]+))?/i,
        ];

        for (const pattern of patterns) {
            const match = shareUrl.match(pattern);
            if (match) {
                return {
                    shareId: match[1],
                    extractedPwd: match[2] || null
                };
            }
        }

        return { shareId: null, extractedPwd: null };
    }

    async getShareInfo(shareId) {
        const url = `${this.apiBase}/adrive/v3/share_link/get_share_by_anonymous`;
        const data = { share_id: shareId };

        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    ...this.baseHeaders,
                    'Authorization': undefined
                },
                body: JSON.stringify(data)
            });

            if (response.status === 200) {
                return await response.json();
            }
        } catch (e) {
            console.error('获取分享信息失败:', e);
        }

        return null;
    }

    async getShareToken(shareId, password = '') {
        const cacheKey = `${shareId}_${password || 'no_pwd'}`;
        if (this.cachedTokens[cacheKey]) {
            return this.cachedTokens[cacheKey];
        }

        const url = `${this.apiBase}/v2/share_link/get_share_token`;
        const data = { share_id: shareId };
        if (password) {
            data.share_pwd = password;
        }

        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    ...this.baseHeaders,
                    'Authorization': undefined
                },
                body: JSON.stringify(data)
            });

            if (response.status === 200) {
                const result = await response.json();
                const shareToken = result.share_token;
                if (shareToken) {
                    this.cachedTokens[cacheKey] = shareToken;
                    return shareToken;
                }
            }
        } catch (e) {
            console.error('获取share_token失败:', e);
        }

        return null;
    }

    async listShareFiles(shareId, shareToken) {
        const url = `${this.apiBase}/adrive/v3/file/list`;
        const data = {
            share_id: shareId,
            parent_file_id: 'root',
            limit: 100,
            order_by: 'name',
            order_direction: 'ASC'
        };

        const headers = {
            ...this.baseHeaders,
            'X-Share-Token': shareToken
        };

        try {
            const response = await fetch(url, {
                method: 'POST',
                headers,
                body: JSON.stringify(data)
            });

            if (response.status === 200) {
                const result = await response.json();
                return result.items || [];
            }
        } catch (e) {
            console.error('获取文件列表失败:', e);
        }

        return [];
    }

    async getDriveId() {
        if (this.userDriveId) {
            return this.userDriveId;
        }

        const url = `${this.apiBase}/v2/user/get`;

        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: this.baseHeaders,
                body: JSON.stringify({})
            });

            if (response.status === 200) {
                const result = await response.json();
                
                for (const field of ['default_drive_id', 'drive_id', 'backup_drive_id']) {
                    if (result[field]) {
                        this.userDriveId = result[field];
                        break;
                    }
                }
                
                if (!this.userDriveId && result.user_id) {
                    this.userDriveId = result.user_id;
                }
            } else if (response.status === 401) {
                this.cookieManager.invalidate();
            }
        } catch (e) {
            console.error('获取drive_id失败:', e);
        }

        return this.userDriveId;
    }

    async saveToMyDrive(shareId, fileId, shareToken) {
        const driveId = await this.getDriveId();
        if (!driveId) {
            return null;
        }

        const url = `${this.apiBase}/adrive/v2/file/copy`;
        const data = {
            file_id: fileId,
            to_parent_file_id: 'root',
            to_drive_id: driveId,
            share_id: shareId,
            auto_rename: true
        };

        const headers = {
            ...this.baseHeaders,
            'X-Share-Token': shareToken
        };

        try {
            const response = await fetch(url, {
                method: 'POST',
                headers,
                body: JSON.stringify(data)
            });

            if (response.status === 200 || response.status === 201) {
                const result = await response.json();
                
                const keyPaths = [['file_id'], ['body', 'file_id'], ['data', 'file_id']];
                for (const keyPath of keyPaths) {
                    let temp = result;
                    for (const key of keyPath) {
                        if (temp && typeof temp === 'object' && key in temp) {
                            temp = temp[key];
                        } else {
                            temp = null;
                            break;
                        }
                    }
                    if (temp && typeof temp === 'string' && temp.length > 10) {
                        return temp;
                    }
                }
            } else if (response.status === 401) {
                this.cookieManager.invalidate();
            }
        } catch (e) {
            console.error('保存到网盘失败:', e);
        }

        return null;
    }

    async getDownloadUrl(driveId, fileId) {
        const url = `${this.apiBase}/v2/file/get_download_url`;
        const data = {
            drive_id: driveId,
            file_id: fileId
        };

        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: this.baseHeaders,
                body: JSON.stringify(data)
            });

            if (response.status === 200) {
                const result = await response.json();
                if (result.url) {
                    return result.url;
                } else if (result.code === 'AccessTokenInvalid') {
                    this.cookieManager.invalidate();
                }
            } else if (response.status === 401) {
                this.cookieManager.invalidate();
            }
        } catch (e) {
            console.error('获取下载链接失败:', e);
        }

        return null;
    }
}

// ============================== 夸克网盘解析器 ==============================
class QuarkParser {
    constructor(config) {
        this.config = config;
        this.cookieManager = new CookieManager('quark', config.quark.cookie);
        this.userAgent = config.quark.userAgent;
        this.baseHeaders = null;
        this.validCookie = null;
    }

    async parse(shareUrl, passcode = '') {
        try {
            if (!this.config.quark.enabled) {
                return { code: 503, msg: '夸克网盘解析已禁用', success: false, data: null };
            }

            const cookieStatus = this.cookieManager.getValidCookie();
            
            if (!cookieStatus.value) {
                return { 
                    code: 401, 
                    msg: '夸克网盘 Cookie 未配置 (QK_COOKIE)', 
                    success: false, 
                    data: null 
                };
            }

            if (cookieStatus.expired) {
                return {
                    code: 401,
                    msg: '夸克网盘 Cookie 已过期（超过2小时），请重新配置 QK_COOKIE',
                    success: false,
                    data: {
                        expired: true,
                        hint: 'Cookie 有效期为2小时，从配置完成时开始计时'
                    }
                };
            }

            this.validCookie = cookieStatus.value;

            this.baseHeaders = {
                'User-Agent': this.userAgent,
                'Content-Type': 'application/json',
                'Cookie': this.validCookie,
                'Referer': 'https://pan.quark.cn/',
                'Origin': 'https://pan.quark.cn',
                'Accept': 'application/json, text/plain, */*'
            };

            const pwdId = this.extractPwdId(shareUrl);
            if (!pwdId) {
                return { code: 400, msg: '无效的夸克网盘分享链接', success: false, data: null };
            }

            const stoken = await this.getShareToken(pwdId, passcode);
            if (!stoken) {
                return { 
                    code: 401, 
                    msg: '获取分享令牌失败，Cookie 可能已过期或无效', 
                    success: false, 
                    data: { expired: true }
                };
            }

            const fileList = await this.getShareDetail(pwdId, stoken);
            if (!fileList || fileList.length === 0) {
                return { code: 404, msg: '分享中没有文件，可能是Cookie失效或分享链接失效，请检查Cookie是否失效', success: false, data: null };
            }

            const files = fileList.filter(f => f.file === true || f.obj_category !== '');
            
            if (files.length === 0) {
                return { code: 404, msg: '没有可下载的文件（可能都是文件夹）', success: false, data: null };
            }

            const fids = files.map(f => f.fid);
            const downloadData = await this.getDownloadLinks(fids);
            
            if (!downloadData || downloadData.length === 0) {
                return { code: 502, msg: '获取下载链接失败', success: false, data: null };
            }

            const fileMap = {};
            files.forEach(f => {
                fileMap[f.fid] = f;
            });

            const results = [];
            for (const item of downloadData) {
                const fid = item.fid;
                const fileInfo = fileMap[fid];
                if (fileInfo) {
                    results.push({
                        file_id: fid,
                        file_name: fileInfo.file_name || '未知文件名',
                        file_size: formatFileSize(fileInfo.size || 0),
                        download_url: item.download_url || '',
                        fid: fileInfo.fid,
                        pdir_fid: fileInfo.pdir_fid
                    });
                }
            }

            const isSingleFile = results.length === 1;
            const responseData = isSingleFile ? results[0] : {
                file_count: results.length,
                files: results
            };

            const remainingTime = cookieStatus.remainingTime;

            return {
                code: 200,
                msg: '解析成功',
                success: true,
                shareKey: 'qk:' + pwdId,
                cookie_status: {
                    valid: true,
                    remaining_time: formatDuration(remainingTime),
                    remaining_seconds: Math.floor(remainingTime / 1000)
                },
                data: responseData
            };

        } catch (e) {
            return { code: 500, msg: '解析失败: ' + e.message, success: false, data: null };
        }
    }

    extractPwdId(url) {
        const match = url.match(/pan\.quark\.cn\/s\/([a-zA-Z0-9]+)/i);
        return match ? match[1] : null;
    }

    async getShareToken(pwdId, passcode = '') {
        const url = 'https://drive-pc.quark.cn/1/clouddrive/share/sharepage/token?pr=ucpro&fr=pc';
        
        const body = {
            pwd_id: pwdId,
            passcode: passcode
        };

        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: this.baseHeaders,
                body: JSON.stringify(body)
            });

            const result = await response.json();
            
            if (result.code === 31001 || result.code === 401) {
                this.cookieManager.invalidate();
                return null;
            }
            
            if (result.code === 0 && result.data && result.data.stoken) {
                return result.data.stoken;
            }
            
            return null;
        } catch (e) {
            console.error('获取 share token 失败:', e);
            return null;
        }
    }

    async getShareDetail(pwdId, stoken) {
        const params = new URLSearchParams({
            pr: 'ucpro',
            fr: 'pc',
            pwd_id: pwdId,
            stoken: stoken,
            pdir_fid: '0',
            force: '0',
            _page: '1',
            _size: '50',
            _sort: 'file_type:asc,updated_at:desc'
        });

        const url = `https://drive-pc.quark.cn/1/clouddrive/share/sharepage/detail?${params.toString()}`;

        try {
            const response = await fetch(url, {
                method: 'GET',
                headers: this.baseHeaders
            });

            const result = await response.json();
            
            if (result.code === 31001 || result.code === 401) {
                this.cookieManager.invalidate();
                return [];
            }
            
            if (result.code === 0 && result.data && Array.isArray(result.data.list)) {
                return result.data.list;
            }
            
            return [];
        } catch (e) {
            console.error('获取文件列表失败:', e);
            return [];
        }
    }

    async getDownloadLinks(fids) {
        const url = 'https://drive-pc.quark.cn/1/clouddrive/file/download?pr=ucpro&fr=pc';
        
        const batchSize = 15;
        const allResults = [];

        for (let i = 0; i < fids.length; i += batchSize) {
            const batch = fids.slice(i, i + batchSize);
            
            try {
                const response = await fetch(url, {
                    method: 'POST',
                    headers: this.baseHeaders,
                    body: JSON.stringify({ fids: batch })
                });

                const result = await response.json();
                
                if (result.code === 31001 || result.code === 401) {
                    this.cookieManager.invalidate();
                    throw new Error('Cookie 已失效，请重新配置');
                }
                
                if (result.code === 0 && Array.isArray(result.data)) {
                    allResults.push(...result.data);
                }
            } catch (e) {
                console.error(`获取第 ${Math.floor(i / batchSize) + 1} 批下载链接失败:`, e);
            }
        }

        return allResults;
    }

    getValidCookie() {
        return this.validCookie;
    }
}

// ============================== UC网盘解析器 ==============================
class UCParser {
    constructor(config) {
        this.config = config;
        this.cookieManager = new CookieManager('uc', config.uc.cookie);
        this.userAgent = config.uc.userAgent;
        this.apiBase = 'https://pc-api.uc.cn/1/clouddrive';
        this.baseHeaders = null;
    }

    async parse(shareUrl, passcode = '') {
        try {
            if (!this.config.uc.enabled) {
                return { code: 503, msg: 'UC网盘解析已禁用', success: false, data: null };
            }

            const cookieStatus = this.cookieManager.getValidCookie();
            
            if (!cookieStatus.value) {
                return { 
                    code: 401, 
                    msg: 'UC网盘 Cookie 未配置 (UC_COOKIE)', 
                    success: false, 
                    data: null 
                };
            }

            if (cookieStatus.expired) {
                return {
                    code: 401,
                    msg: 'UC网盘 Cookie 已过期（超过2小时），请重新配置 UC_COOKIE',
                    success: false,
                    data: {
                        expired: true,
                        hint: 'Cookie 有效期为2小时，从配置完成时开始计时'
                    }
                };
            }

            const cookies = this.parseCookieString(cookieStatus.value);
            const formattedCookie = this.formatCookieString(cookieStatus.value);
            
            if (!cookies.ctoken) {
                return {
                    code: 401,
                    msg: 'UC网盘 Cookie 缺少必要的 ctoken 字段',
                    success: false,
                    data: null
                };
            }

            this.baseHeaders = {
                'User-Agent': this.userAgent,
                'Accept': 'application/json, text/plain, */*',
                'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
                'Accept-Encoding': 'gzip, deflate, br',
                'Content-Type': 'application/json;charset=UTF-8',
                'Cookie': formattedCookie,
                'Origin': 'https://drive.uc.cn',
                'Referer': 'https://drive.uc.cn/',
                'Sec-Fetch-Dest': 'empty',
                'Sec-Fetch-Mode': 'cors',
                'Sec-Fetch-Site': 'same-site',
                'X-CToken': cookies.ctoken
            };

            const shareKey = this.extractShareKey(shareUrl);
            if (!shareKey) {
                return { code: 400, msg: '无效的UC网盘分享链接', success: false, data: null };
            }

            const stoken = await this.getShareToken(shareKey, passcode, cookies);
            if (!stoken) {
                return { 
                    code: 401, 
                    msg: '获取分享令牌失败，Cookie 可能已过期或无效', 
                    success: false, 
                    data: { expired: true }
                };
            }

            const fileInfo = await this.getShareDetail(shareKey, passcode, stoken, cookies);
            if (!fileInfo) {
                return { code: 404, msg: '分享中没有文件，可能是Cookie失效或分享链接失效', success: false, data: null };
            }

            const downloadUrl = await this.getDownloadUrl(fileInfo, shareKey, stoken, cookies);
            
            if (!downloadUrl) {
                return { code: 502, msg: '获取下载链接失败', success: false, data: null };
            }

            const remainingTime = cookieStatus.remainingTime;

            return {
                code: 200,
                msg: '解析成功',
                success: true,
                shareKey: 'uc:' + shareKey,
                cookie_status: {
                    valid: true,
                    remaining_time: formatDuration(remainingTime),
                    remaining_seconds: Math.floor(remainingTime / 1000)
                },
                data: {
                    file_id: fileInfo.fid,
                    file_name: fileInfo.file_name,
                    file_size: formatFileSize(fileInfo.file_size || 0),
                    download_url: downloadUrl
                }
            };

        } catch (e) {
            return { code: 500, msg: '解析失败: ' + e.message, success: false, data: null };
        }
    }

    parseCookieString(cookieString) {
        const cookies = {};
        if (!cookieString) return cookies;
        
        if (cookieString.trim().startsWith('{')) {
            try {
                return JSON.parse(cookieString);
            } catch (e) {
            }
        }
        
        cookieString.split(';').forEach(item => {
            const [key, value] = item.trim().split('=');
            if (key && value !== undefined) {
                cookies[key.trim()] = value.trim();
            }
        });
        
        return cookies;
    }

    formatCookieString(cookieString) {
        if (!cookieString) return '';
        
        if (cookieString.trim().startsWith('{')) {
            try {
                const cookieObj = JSON.parse(cookieString);
                return Object.entries(cookieObj)
                    .map(([key, value]) => `${key}=${value}`)
                    .join('; ');
            } catch (e) {
                return cookieString;
            }
        }
        
        return cookieString;
    }

    extractShareKey(url) {
        const patterns = [
            /https?:\/\/fast\.uc\.cn\/s\/([a-zA-Z0-9]+)(?:\?.*)?/i,
            /https?:\/\/drive\.uc\.cn\/s\/([a-zA-Z0-9]+)(?:\?.*)?/i,
        ];
        
        for (const pattern of patterns) {
            const match = url.match(pattern);
            if (match) {
                return match[1];
            }
        }
        
        if (/^[a-zA-Z0-9]+$/.test(url)) {
            return url;
        }
        
        return null;
    }

    async getShareToken(shareKey, passcode, cookies) {
        const url = `${this.apiBase}/share/sharepage/token`;
        
        const params = new URLSearchParams({
            entry: 'ft',
            fr: 'pc',
            pr: 'UCBrowser'
        });

        const body = {
            share_for_transfer: true,
            pwd_id: shareKey,
            passcode: passcode || ''
        };

        try {
            const response = await fetch(`${url}?${params.toString()}`, {
                method: 'POST',
                headers: this.baseHeaders,
                body: JSON.stringify(body)
            });

            const result = await response.json();
            
            if (result.code === 14001 || result.code === 401) {
                this.cookieManager.invalidate();
                return null;
            }
            
            if (result.code === 0 && result.data && result.data.stoken) {
                return result.data.stoken;
            }
            
            return null;
        } catch (e) {
            console.error('获取 share token 失败:', e);
            return null;
        }
    }

    async getShareDetail(shareKey, passcode, stoken, cookies) {
        const url = `${this.apiBase}/transfer_share/detail`;
        
        const params = new URLSearchParams({
            pwd_id: shareKey,
            passcode: passcode || '',
            stoken: stoken,
            entry: 'ft',
            fr: 'pc',
            pr: 'UCBrowser'
        });

        try {
            const response = await fetch(`${url}?${params.toString()}`, {
                method: 'GET',
                headers: this.baseHeaders
            });

            const result = await response.json();
            
            if (result.code === 14001 || result.code === 401) {
                this.cookieManager.invalidate();
                return null;
            }
            
            if (result.code === 0 && result.data && Array.isArray(result.data.list) && result.data.list.length > 0) {
                const info = result.data.list[0];
                return {
                    fid: info.fid,
                    file_name: info.file_name || '未知文件',
                    file_size: info.size || 0,
                    share_fid_token: info.share_fid_token
                };
            }
            
            return null;
        } catch (e) {
            console.error('获取文件详情失败:', e);
            return null;
        }
    }

    async getDownloadUrl(fileInfo, shareKey, stoken, cookies) {
        const url = `${this.apiBase}/file/download`;
        
        const params = new URLSearchParams({
            entry: 'ft',
            fr: 'pc',
            pr: 'UCBrowser'
        });

        const body = {
            fids: [fileInfo.fid],
            pwd_id: shareKey,
            stoken: stoken,
            fids_token: [fileInfo.share_fid_token]
        };

        try {
            const response = await fetch(`${url}?${params.toString()}`, {
                method: 'POST',
                headers: this.baseHeaders,
                body: JSON.stringify(body)
            });

            const result = await response.json();
            
            if (result.code === 14001 || result.code === 401) {
                this.cookieManager.invalidate();
                return null;
            }
            
            if (result.code === 0 && result.data && Array.isArray(result.data) && result.data.length > 0) {
                return result.data[0].download_url;
            }
            
            return null;
        } catch (e) {
            console.error('获取下载链接失败:', e);
            return null;
        }
    }

    getValidCookie() {
        const cookieStatus = this.cookieManager.getValidCookie();
        return cookieStatus.value;
    }
}

// ============================== 小飞机解析器 ==============================
class FeijipanParser {
    constructor(shareLinkInfo) {
        this.shareLinkInfo = shareLinkInfo;
        this.uuid = generateUUID();
        this.aes = new AES128ECB('dingHao-disk-app');
    }

    async encrypt2hex(source) {
        return this.aes.encryptHex(String(source));
    }

    async parse() {
        const shareId = this.shareLinkInfo.shareKey;
        const ts = getTimestamp();
        const tsEncode = await this.encrypt2hex(String(ts));

        const headers = {
            'Accept': 'application/json, text/plain, */*',
            'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
            'Origin': 'https://www.feijix.com',
            'Referer': 'https://www.feijix.com/',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'
        };

        const vipUrl = `https://api.feejii.com/ws/buy/vip/list?devType=6&devModel=Chrome&uuid=${this.uuid}&extra=2&timestamp=${tsEncode}`;
        try {
            await fetch(vipUrl, { method: 'POST', headers });
        } catch (e) {}

        let apiUrl = `https://api.feejii.com/ws/recommend/list?devType=6&devModel=Chrome&uuid=${this.uuid}&extra=2&timestamp=${tsEncode}&shareId=${shareId}&type=0&offset=1&limit=60`;
        if (this.shareLinkInfo.sharePassword) {
            apiUrl += `&code=${this.shareLinkInfo.sharePassword}`;
        }

        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: headers
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }

        const resJson = await response.json();

        if (!resJson || resJson.code !== 200) {
            throw new Error(resJson?.msg || '请求失败');
        }

        if (!resJson.list || !resJson.list[0] || !resJson.list[0].fileList) {
            throw new Error('文件列表为空');
        }

        const fileInfo = resJson.list[0];
        const fileList = fileInfo.fileList[0];
        const fileId = fileInfo.fileIds;
        const fileName = fileList.fileName || fileInfo.fileName || '未知文件';
        const fileSize = fileList.fileSize || fileInfo.fileSize || '';

        if (fileList.fileType === 2) {
            return {
                download_url: null,
                file_id: fileId,
                file_name: fileName,
                file_size: fileSize,
                is_folder: true,
                folder_id: fileList.folderId
            };
        }

        const userId = fileInfo.userId;
        const nowTs2 = getTimestamp();
        const tsEncode2 = await this.encrypt2hex(String(nowTs2));
        const userIdStr = userId !== null ? String(userId) : 'null';
        
        const fidEncode = await this.encrypt2hex(`${fileId}|${userIdStr}`);
        const auth = await this.encrypt2hex(`${fileId}|${nowTs2}`);

        const redirectUrl = `https://api.feejii.com/ws/file/redirect?downloadId=${fidEncode}&enable=1&devType=6&uuid=${this.uuid}&timestamp=${tsEncode2}&auth=${auth}&shareId=${shareId}`;

        const redirectResponse = await fetch(redirectUrl, {
            method: 'GET',
            headers: headers,
            redirect: 'manual'
        });

        const downloadUrl = redirectResponse.headers.get('Location');
        if (!downloadUrl) {
            throw new Error('未获取到下载链接');
        }

        return {
            download_url: downloadUrl,
            file_id: fileId,
            file_name: fileName,
            file_size: fileSize,
            is_folder: false
        };
    }

    extractShareKey(url) {
        const patterns = [
            /share\.feijipan\.com\/#\/s\/([a-zA-Z0-9]+)/,
            /share\.feijipan\.com\/s\/([a-zA-Z0-9]+)/,
            /feijipan\.com\/s\/([a-zA-Z0-9]+)/
        ];

        for (const pattern of patterns) {
            const match = url.match(pattern);
            if (match) return match[1];
        }

        if (/^[a-zA-Z0-9]+$/.test(url)) {
            return url;
        }

        throw new Error('无法从链接中提取分享ID');
    }
}

// ============================== 蓝奏云优享版解析器 ==============================
class IlanzouParser {
    constructor() {
        this.aesKey = 'lanZouY-disk-app';
        this.aes = new AES128ECB(this.aesKey);
    }

    async parse(url, pwd = '') {
        try {
            const shareId = this.extractShareId(url);
            if (!shareId) {
                return { code: 400, msg: '无效的分享链接', success: false, data: null };
            }

            const uuid = generateUUID();
            const timestamp = getTimestamp();
            const encryptedTimestamp = this.aes.encryptHex(String(timestamp));

            const apiUrl = this.buildApiUrl(shareId, pwd, uuid, encryptedTimestamp);
            const fileInfo = await this.getFileInfo(apiUrl, uuid, pwd);

            if (fileInfo.error) {
                return { code: 400, msg: fileInfo.msg, success: false, data: null };
            }

            if (fileInfo.need_password) {
                return pwd ? 
                    { code: 400, msg: '密码错误', success: false, data: null } : 
                    { code: 201, msg: '请输入密码', success: false, data: null };
            }

            const fileId = fileInfo.fileIds || fileInfo.fileId || fileInfo.id || '';
            const fileName = fileInfo.fileName || fileInfo.name || '';
            const fileSize = fileInfo.fileSize || fileInfo.size || '';

            if (!fileId) {
                return { code: 400, msg: '文件信息获取失败', success: false, data: null };
            }

            if (!fileName && !fileSize && !pwd) {
                return { code: 201, msg: '请输入密码', success: false, data: null };
            }

            const downloadUrl = await this.getDownloadUrl(fileInfo, uuid);

            if (!downloadUrl) {
                return { code: 400, msg: '获取下载链接失败', success: false, data: null };
            }

            return {
                code: 200,
                msg: '解析成功',
                success: true,
                shareKey: 'iz:' + shareId,
                data: {
                    file_id: fileId,
                    file_name: fileName || this.extractFilenameFromUrl(downloadUrl),
                    file_size: fileSize,
                    download_url: downloadUrl
                }
            };

        } catch (e) {
            return { code: 500, msg: '解析失败: ' + e.message, success: false, data: null };
        }
    }

    extractShareId(url) {
        url = url.trim();
        const match = url.match(/ilanzou\.com\/s\/([a-zA-Z0-9]+)/);
        if (match) return match[1];

        const parts = url.replace(/\/+$/, '').split('/');
        let lastPart = parts[parts.length - 1] || '';
        const queryIndex = lastPart.indexOf('?');
        if (queryIndex !== -1) {
            lastPart = lastPart.substring(0, queryIndex);
        }
        return lastPart;
    }

    buildApiUrl(shareId, pwd, uuid, encryptedTimestamp) {
        const params = new URLSearchParams({
            devType: '6',
            devModel: 'Chrome',
            uuid: uuid,
            extra: '2',
            timestamp: encryptedTimestamp,
            shareId: shareId,
            type: '0',
            offset: '1',
            limit: '60'
        });

        if (pwd) {
            params.append('code', pwd);
        }

        return `https://api.ilanzou.com/unproved/recommend/list?${params.toString()}`;
    }

    async getFileInfo(apiUrl, uuid, providedPwd = '') {
        const headers = {
            'Accept': 'application/json, text/plain, */*',
            'Referer': 'https://www.ilanzou.com/',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36'
        };

        try {
            const response = await fetch(apiUrl, { headers });
            const data = await response.json();

            if (data.msg && data.msg !== '成功') {
                const errorMsg = data.msg;
                if (errorMsg.includes('密码') || errorMsg.includes('提取码')) {
                    return { need_password: true, msg: errorMsg };
                }
                return { error: true, msg: errorMsg };
            }

            if (!data.list || data.list.length === 0) {
                return { error: true, msg: '未找到文件信息' };
            }

            let item = data.list[0];
            if (item.fileList && Array.isArray(item.fileList) && item.fileList.length > 0) {
                Object.assign(item, item.fileList[0]);
            }

            return item;
        } catch (e) {
            return { error: true, msg: '请求失败: ' + e.message };
        }
    }

    extractFilenameFromUrl(downloadUrl) {
        try {
            const url = new URL(downloadUrl);
            const filename = url.searchParams.get('filename');
            return filename ? decodeURIComponent(filename) : '';
        } catch (e) {
            return '';
        }
    }

    async getDownloadUrl(fileInfo, uuid) {
        const fileIds = String(fileInfo.fileIds || fileInfo.fileId || fileInfo.id || '');
        if (!fileIds) return '';

        const timestamp = getTimestamp();
        const encryptedTimestamp = this.aes.encryptHex(String(timestamp));

        const auth = this.aes.encryptHex(`${fileIds}|${timestamp}`);
        const downloadId = this.aes.encryptHex(`${fileIds}|`);

        const redirectUrl = `https://api.ilanzou.com/unproved/file/redirect?` + new URLSearchParams({
            downloadId: downloadId,
            enable: '1',
            devType: '6',
            uuid: uuid,
            timestamp: encryptedTimestamp,
            auth: auth
        }).toString();

        try {
            const response = await fetch(redirectUrl, {
                headers: {
                    'Referer': 'https://www.ilanzou.com/',
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                },
                redirect: 'manual'
            });

            const location = response.headers.get('Location');
            if (location) return location;

            const text = await response.text();
            const match = text.match(/https?:\/\/[^\s"']+/i);
            return match ? match[0] : '';
        } catch (e) {
            return '';
        }
    }
}

// ============================== 蓝奏云解析器 ==============================
class LanzouParser {
    constructor(config) {
        this.mobileUA = 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Mobile Safari/537.36';
        this.desktopUA = 'Mozilla/5.0 (Windows NT 6.1; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/87.0.4280.88 Safari/537.36';
        this.apiDomain = 'www.lanzoui.com';
        this.autoSwitch = config["auto-switch"];
        this.mode = config.mode;
    }

    async parse(url, pwd = '') {
        try {
            const id = this.extractId(url);
            if (!id) {
                return { code: 400, msg: '无效的分享链接', data: null };
            }

            let result;
            if (this.mode === "mobile") {
                result = await this.mobileMode(id, pwd);
                if (this.autoSwitch && result.code !== 200 && result.code !== 401) {
                    result = await this.pcMode(id, pwd);
                }
            } else {
                result = await this.pcMode(id, pwd);
                if (this.autoSwitch && result.code !== 200 && result.code !== 401) {
                    result = await this.mobileMode(id, pwd);
                }
            }

            return result;

        } catch (e) {
            return { code: 500, msg: '解析失败: ' + e.message, data: null };
        }
    }

    extractId(url) {
        const match = url.match(/(?:lanzou[a-z]{0,2}\.com)\/(?:tp\/)?([a-zA-Z0-9_\-]+)/i);
        return match ? match[1].split('?')[0] : null;
    }

    async pcMode(id, pwd) {
        const headers = { 'User-Agent': this.desktopUA };
        
        let data = await this.request(`https://${this.apiDomain}/${id}`, 'GET', null, headers, 'data');
        if (!data) return this.createResponse(500, "获取失败", null);
        
        data = data.replace(/<!--[\s\S]*?-->/g, '');
        
        const jsMatch = data.match(/<script[^>]*>([\s\S]*?)<\/script>/gi);
        let js = jsMatch ? jsMatch.map(m => m.replace(/<script[^>]*>|<\/script>/gi, '')).join('\n').trim() : "";
        
        const errorMatch = data.match(/<\/div><\/div>(.+)<\/div>/);
        const error = errorMatch ? errorMatch[1].replace(/<[^>]+>/g, '') : "获取失败";
        
        if (js.includes("/filemoreajax.php")) {
            return await this.handleFolder(data, js, id, pwd);
        }
        
        const iframeMatch = data.match(/<iframe[^>]*src="(.+?)"/);
        if (iframeMatch) {
            const data2 = await this.request(`https://${this.apiDomain}${iframeMatch[1]}`, 'GET', null, headers, 'data');
            const jsurlMatch = data2.match(/https?:\/\/waf\.woozooo\.com\/pc\/.+?\.js/);
            js = jsurlMatch ? await this.request(jsurlMatch[0], 'GET', null, headers, 'data') : data2;
        }
        
        if (!js) return this.createResponse(501, error, null);
        
        const fileinfoMatch = data.match(/<meta\s+name=["']description["']\s+content=["']([^"]*?)["']/);
        const fileinfo = fileinfoMatch ? fileinfoMatch[1] : "";
        
        const info = {};
        
        const namePatterns = [
            /<div class="n_box_3fn"[^>]*>([^<]+)<\/div>/,
            /<div style="font[^>]*>([^<]+)<\/div>/,
            /class="b">.*?<span>([^<]+)</
        ];
        for (const pattern of namePatterns) {
            const match = data.match(pattern);
            if (match) {
                info.name = this.htmlspecialcharsDecode(match[1]);
                break;
            }
        }
        
        const sizeMatch1 = fileinfo.match(/(?:文件)?大小：([^|]+?)(?:\||$)/);
        if (sizeMatch1) info.size = sizeMatch1[1].trim();
        
        if (!info.size) {
            const sizeMatch2 = data.match(/<div class="n_filesize">大小：(.+?)<\/div>/);
            if (sizeMatch2) info.size = sizeMatch2[1];
        }
        
        if (!info.size) {
            const sizeMatch3 = data.match(/文件大小：<\/span>([^<]+)</);
            if (sizeMatch3) info.size = sizeMatch3[1];
        }
        
        const userMatch1 = data.match(/<span class="user-name">([^<]+)<\/span>/);
        if (userMatch1) info.user = userMatch1[1];
        
        if (!info.user) {
            const userMatch2 = data.match(/<font[^>]*>([^<]+)<\/font>/);
            if (userMatch2) info.user = userMatch2[1];
        }
        
        const timeMatch1 = data.match(/<span class="n_file_infos">([^<]+)<\/span>\s*<span class="n_file_infos">/);
        if (timeMatch1) info.time = timeMatch1[1];
        
        if (!info.time) {
            const timeMatch2 = data.match(/<span class="p7">上传时间：<\/span>([^<]+)<br>/);
            if (timeMatch2) info.time = timeMatch2[1];
        }
        
        const descMatch1 = fileinfo.match(/\|(.+)$/);
        if (descMatch1) info.desc = this.htmlspecialcharsDecode(descMatch1[1].trim());
        
        if (!info.desc) {
            const descMatch2 = data.match(/<div class="n_box_des">([\s\S]+?)<\/div>/);
            if (descMatch2) info.desc = this.htmlspecialcharsDecode(descMatch2[1].replace(/<br\s*\/?>\s*/gi, '\n').replace(/<[^>]+>/g, '').trim());
        }
        
        if (!info.desc) {
            const descMatch3 = data.match(/文件描述：<\/span><br>\s*([^<]+)/);
            if (descMatch3) info.desc = this.htmlspecialcharsDecode(descMatch3[1].trim());
        }
        
        if (!info.desc) info.desc = "";
        
        const iconMatch = data.match(/https?:\/\/image\.woozooo\.com\/image\/ico\/.+?(?=")/);
        info.icon = iconMatch ? iconMatch[0] : null;
        
        const avatarMatch = data.match(/https?:\/\/image\.woozooo\.com\/image\/userimg\/.+?(?=\))/);
        info.avatar = avatarMatch ? avatarMatch[0] : null;
        
        return await this.getUrl(js, info, error, pwd, id);
    }

    async mobileMode(id, pwd) {
        const headers = { 'User-Agent': this.mobileUA };
        
        let data = await this.request(`https://${this.apiDomain}/${id}`, 'GET', null, headers, 'data');
        if (!data) return this.createResponse(500, "获取失败", null);
        
        data = data.replace(/<!--[\s\S]*?-->/g, '');
        
        const jsMatch = data.match(/<script[^>]*>([\s\S]*?)<\/script>/gi);
        let js = jsMatch ? jsMatch.map(m => m.replace(/<script[^>]*>|<\/script>/gi, '')).join('\n').trim() : "";
        
        if (js.includes("/filemoreajax.php")) {
            return await this.handleFolder(data, js, id, pwd);
        }
        
        let data2 = null;
        let datar = data;
        
        let url = null;
        const urlMatch = js.match(/\?[^'"\s]+/);
        if (urlMatch && urlMatch[0].startsWith('?')) {
            url = urlMatch[0];
        } else {
            let hasMatch = false;
            let id2 = null;
            
            const jstpMatch = data.match(/https?:\/\/waf\.woozooo\.com\/tp\/.+?\.js/);
            if (jstpMatch) {
                const tempData = await this.request(jstpMatch[0], 'GET', null, headers, 'data');
                const id2Match = tempData.match(/tp\/([\w?&=]+)/);
                if (id2Match) {
                    id2 = id2Match[1];
                    hasMatch = true;
                }
            }
            
            if (!hasMatch) {
                const id2Match = data.match(/tp\/([\w?&=]+)/);
                if (id2Match) {
                    id2 = id2Match[1];
                    hasMatch = true;
                }
            }
            
            if (!hasMatch) {
                const redirectInfo = await this.request(`https://${this.apiDomain}/${id}`, 'GET', null, { 'User-Agent': 'MicroMessenger' }, 'info');
                if (redirectInfo.redirect_url) {
                    const secondInfo = await this.request(redirectInfo.redirect_url, 'GET', null, headers, 'info');
                    if (secondInfo.redirect_url) {
                        const id2Match = secondInfo.redirect_url.match(/\.com\/([\w?&=]+)/);
                        if (id2Match) {
                            id2 = id2Match[1];
                            hasMatch = true;
                        }
                    }
                }
            }
            
            if (hasMatch && id2) {
                data2 = await this.request(`https://${this.apiDomain}/tp/${id2}`, 'GET', null, headers, 'data');
                if (data2) {
                    data2 = data2.replace(/<!--[\s\S]*?-->/g, '');
                    datar = data2;
                    const js2Match = data2.match(/<script[^>]*>([\s\S]*?)<\/script>/gi);
                    const js2 = js2Match ? js2Match.map(m => m.replace(/<script[^>]*>|<\/script>/gi, '')).join('\n').trim() : null;
                    if (js2) {
                        const url2Match = js2.match(/\?[^'"\s]+/);
                        if (url2Match && url2Match[0].startsWith('?')) url = url2Match[0];
                    }
                }
            }
        }
        
        const errorMatch = data.match(/<\/div><\/div>(.+)<\/div>/);
        const error = errorMatch ? errorMatch[1].replace(/<[^>]+>/g, '') : "获取失败";
        
        if (!js) return this.createResponse(501, error, null);
        
        const fileinfoMatch = data.match(/<meta\s+name=["']description["']\s+content=["']([^"]*?)["']/);
        const fileinfo = fileinfoMatch ? fileinfoMatch[1] : "";
        
        const info = {};
        
        if (data2) {
            const titleMatch = data2.match(/<title>(.+)<\/title>/);
            if (titleMatch) info.name = this.htmlspecialcharsDecode(titleMatch[1]);
            
            if (!info.name) {
                const mdMatch = data2.match(/<div class="md">(.+?)\s*<span class="mtt">/);
                if (mdMatch) info.name = this.htmlspecialcharsDecode(mdMatch[1]);
            }
        }
        
        if (!info.name) {
            const nameMatch = data.match(/<div class="(?:md|appname)">(.+?)\s*</);
            if (nameMatch) info.name = this.htmlspecialcharsDecode(nameMatch[1]);
        }
        
        const sizeMatch1 = fileinfo.match(/(?:文件)?大小：([^|]+?)(?:\||$)/);
        if (sizeMatch1) info.size = sizeMatch1[1].trim();
        
        if (!info.size) {
            const sizeMatch2 = data.match(/>下载\s*\(\s*(.+?)\s*\)<\/a>/);
            if (sizeMatch2) info.size = sizeMatch2[1];
        }
        
        if (!info.size && data2) {
            const sizeMatch3 = data2.match(/mtt">\(\s*(.+?)\s*\)/);
            if (sizeMatch3) info.size = sizeMatch3[1];
        }
        
        const userMatch1 = data.match(/分享者?:<\/span>(.+?)(?:\s|<)/);
        if (userMatch1) info.user = userMatch1[1].trim();
        
        if (!info.user) {
            const userMatch2 = data.match(/<div class="user-name">(.+?)</);
            if (userMatch2) info.user = userMatch2[1];
        }
        
        if (!info.user && data2) {
            const userMatch3 = data2.match(/(?:发布|分享)者:<\/span>(.+?)(?:\s|<span)/);
            if (userMatch3) info.user = userMatch3[1].trim();
        }
        
        const timePatterns = [
            /<span class="mt2"><\/span>(.+?)<span class="mt2">/,
            /<span class="appinfotime">(.+?)</
        ];
        for (const pattern of timePatterns) {
            const match = data.match(pattern);
            if (match) {
                info.time = match[1].trim();
                break;
            }
        }
        
        if (!info.time && data2) {
            const timeMatch = data2.match(/<span class="mt2">时间:<\/span>(.+?)<span class="mt2">/);
            if (timeMatch) info.time = timeMatch[1].trim();
        }
        
        const descMatch1 = fileinfo.match(/\|(.+)$/);
        if (descMatch1) info.desc = this.htmlspecialcharsDecode(descMatch1[1].trim());
        
        if (!info.desc) {
            const descMatch2 = data.match(/<div class="appdes">([\s\S]+?)<\/div>/);
            if (descMatch2) info.desc = this.htmlspecialcharsDecode(descMatch2[1].replace(/<br\s*\/?>\s*/gi, '\n').replace(/<[^>]+>/g, '').trim());
        }
        
        if (!info.desc && data2) {
            const descMatch3 = data2.match(/<div class="mdo">([\s\S]+?)<\/div>/);
            if (descMatch3 && !descMatch3[1].includes("<span>")) {
                info.desc = this.htmlspecialcharsDecode(descMatch3[1].replace(/<br\s*\/?>\s*/gi, '\n').replace(/<[^>]+>/g, '').trim());
            }
        }
        
        if (!info.desc) info.desc = "";
        
        const iconMatch = data.match(/https?:\/\/image\.woozooo\.com\/image\/ico\/.+?(?=\))/);
        info.icon = iconMatch ? iconMatch[0] : null;
        
        const avatarMatch = data.match(/https?:\/\/image\.woozooo\.com\/image\/userimg\/.+?(?=\))/);
        info.avatar = avatarMatch ? avatarMatch[0] : null;
        
        if (url) {
            const domMatch = datar.match(/https?:\/\/.+?(?=['"])/);
            info.url = domMatch ? domMatch[0] + url : null;
        } else {
            const appitemMatch = js.match(/appitem\s*=\s*'(.+?)';/);
            if (appitemMatch) info.url = appitemMatch[1];
        }
        
        const fileidMatch = datar.match(/\?f=(\d+)/);
        const fileid = fileidMatch ? parseInt(fileidMatch[1]) : null;
        info.fid = fileid;
        
        const shareKey = id.match(/([a-zA-Z0-9]+)$/)?.[1] || id;
        const globalShareKey = "lz:" + shareKey;
        
        if (info.url) {
            return await this.getDirectLink(info, globalShareKey);
        } else {
            const appMatch = js.match(/appitem\s*=\s*'(.+?)';/);
            if (appMatch) {
                info.url = appMatch[1];
                return await this.getDirectLink(info, globalShareKey);
            } else {
                return await this.getUrl(js, info, error, pwd, id);
            }
        }
    }

    async getUrl(js, info, error, pwd, id) {
        const cleanedData = js.replace(/\/\/.*|\/\*[\s\S]*?\*\//g, '');
        
        const fileIdMatch = cleanedData.match(/file=(\d+)/);
        const fileid = fileIdMatch ? parseInt(fileIdMatch[1]) : null;
        info.fid = fileid;
        
        if (cleanedData.includes("document.getElementById('pwd').value;") && !pwd) {
            info.download_url = null;
            
            const shareKey = id.match(/([a-zA-Z0-9]+)$/)?.[1] || id;
            const globalShareKey = "lz:" + shareKey;
            
            return this.createResponse(401, "请输入密码", info, globalShareKey);
        }
        
        let sign = null;
        
        const signMatch1 = cleanedData.match(/'sign':'(\w+)'/);
        if (signMatch1) {
            sign = signMatch1[1];
        }
        
        if (!sign) {
            const signVarMatch = cleanedData.match(/'sign':(\w+),/);
            if (signVarMatch) {
                const varName = signVarMatch[1];
                const varPattern = new RegExp(`${varName}\\s*=\\s*'(.*?)'`, 'g');
                const matches = [...cleanedData.matchAll(varPattern)];
                if (matches.length > 0) {
                    const values = matches.map(m => m[1]).filter(Boolean);
                    if (values.length > 0) {
                        sign = values.reduce((a, b) => a.length < b.length ? a : b);
                    }
                }
            }
        }
        
        if (!sign) {
            const cMatches = cleanedData.match(/'(\w+?_c)'/g);
            if (cMatches) {
                const values = cMatches.map(m => m.replace(/'/g, ''));
                if (values.length > 0) {
                    sign = values.reduce((a, b) => a.length < b.length ? a : b);
                }
            }
        }
        
        if (!sign) {
            const longMatches = cleanedData.match(/'([\w]{50,})'/g);
            if (longMatches) {
                const values = longMatches.map(m => m.replace(/'/g, ''));
                if (values.length > 0) {
                    sign = values.reduce((a, b) => a.length > b.length ? a : b);
                }
            }
        }
        
        if (!sign) {
            return this.createResponse(501, error || "获取失败", null);
        }
        
        const websignMatch = cleanedData.match(/'([0-9])'/);
        const websign = websignMatch ? websignMatch[1] : "";
        
        const websignkeyMatch = cleanedData.match(/'([a-zA-Z0-9]{4})'/);
        const websignkey = websignkeyMatch ? websignkeyMatch[1] : "";
        
        const postData = {
            action: 'downprocess',
            sign: sign,
            p: pwd,
            websign: websign,
            websignkey: websignkey
        };
        
        const ajaxResponse = await this.request(
            `https://${this.apiDomain}/ajaxm.php?file=${fileid}`,
            'POST',
            postData,
            { 'User-Agent': this.desktopUA },
            'data'
        );
        
        let json;
        try {
            json = JSON.parse(ajaxResponse);
        } catch (e) {
            json = { zt: 0 };
        }
        
        if (json.zt === 1) {
            if (json.inf) info.name = json.inf;
            
            const shareKey = id.match(/([a-zA-Z0-9]+)$/)?.[1] || id;
            const globalShareKey = "lz:" + shareKey;
            
            info.url = json.dom + '/file/' + json.url;
            return await this.getDirectLink(info, globalShareKey);
        } else {
            info.download_url = null;
            
            const shareKey = id.match(/([a-zA-Z0-9]+)$/)?.[1] || id;
            const globalShareKey = "lz:" + shareKey;
            
            return this.createResponse(502, json.inf || "获取失败", info, globalShareKey);
        }
    }

    async getDirectLink(info, globalShareKey) {
        const headers = {
            'User-Agent': this.desktopUA,
            'Cookie': 'down_ip=1'
        };
        
        let requestData = await this.request(info.url, 'GET', null, headers, 'all');
        let url = requestData.info.redirect_url;
        
        const argMatch = requestData.data.match(/arg1='(.+?)'/);
        if (argMatch) {
            headers.Cookie += `; acw_sc__v2=${acwScV2Simple(argMatch[1])}`;
            const newRequest = await this.request(info.url, 'GET', null, headers, 'info');
            url = newRequest.redirect_url;
        }
        
        if (!url) {
            headers['User-Agent'] = this.mobileUA;
            const mobileRequest = await this.request(info.url, 'GET', null, headers, 'all');
            
            if (mobileRequest.data) {
                const aMatch = mobileRequest.data.match(/<a\s+href="(.+?)"/);
                if (aMatch) {
                    url = aMatch[1];
                } else {
                    url = mobileRequest.info.redirect_url;
                    if (url && url.startsWith('itms-services://')) {
                        const plistMatch = url.match(/&url=(.+)/);
                        if (plistMatch) {
                            const plistData = await this.request(plistMatch[1], 'GET', null, { 'User-Agent': this.mobileUA }, 'data');
                            const cdataMatch = plistData.match(/<!\[CDATA\[(.+)\]\]>/);
                            if (cdataMatch) url = cdataMatch[1];
                        }
                    }
                }
            }
        }
        
        if (!url) {
            return this.createResponse(201, "获取链接失败", info, globalShareKey);
        }
        
        info.download_url = url;
        
        if (!info.time) {
            const timeMatch = url.match(/(?!(0000))\d{4}\/(?:0[1-9]|1[0-2])\/(?:0[1-9]|[12]\d|3[01])/);
            if (timeMatch) {
                info.time = timeMatch[0].replace(/\//g, '-');
            }
        }
        
        const timestamp = Date.now();
        const expiresTimestamp = timestamp + (24 * 60 * 60 * 1000);
        const expiresDate = new Date(expiresTimestamp).toISOString().replace('T', ' ').split('.')[0];
        info.expires = expiresDate;
        info.expiration = expiresTimestamp;
        
        const standardInfo = {
            file_id: info.fid || null,
            file_name: info.name || null,
            file_size: info.size || null,
            download_url: info.download_url || null,
            expires: info.expires || null,
            expiration: info.expiration || null
        };
        
        return this.createResponse(200, "成功", standardInfo, globalShareKey);
    }

    async handleFolder(data, js, id, pwd, page = 1) {
        const arrMatch = js.match(/data\s*:\s*\{([\s\S]*?)\},/);
        if (!arrMatch) {
            return this.createResponse(501, "获取失败", null);
        }
        
        const parameter = {};
        const lines = arrMatch[1].split('\n');
        
        for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed) continue;
            
            const kvMatch = trimmed.match(/^'([^']+)':\s*(?:(\d+)|'([^']*)'),?$/);
            if (kvMatch) {
                const key = kvMatch[1];
                const value = kvMatch[2] !== undefined ? parseInt(kvMatch[2]) : kvMatch[3];
                parameter[key] = value;
            }
        }
        
        const info = {
            fid: parseInt(parameter.fid) || 0,
            uid: parseInt(parameter.uid) || 0
        };
        
        const titleVarMatch = js.match(/document\.title\s*=\s*([^;]+);/);
        if (titleVarMatch) {
            const varName = titleVarMatch[1].trim();
            const nameMatch = js.match(new RegExp(`${varName}\\s*=\\s*'(.*?)'`));
            if (nameMatch) {
                info.name = this.htmlspecialcharsDecode(nameMatch[1]);
            }
        }
        
        if (!info.name) {
            const namePatterns = [
                /class="b">([^<]+)</,
                /user-title">([^<]+)</,
                /<title>([^-]+)-\s*蓝奏云/
            ];
            for (const pattern of namePatterns) {
                const match = data.match(pattern) || js.match(pattern);
                if (match) {
                    info.name = this.htmlspecialcharsDecode(match[1].trim());
                    break;
                }
            }
        }
        
        const descPatterns = [
            /说<\/span>([\s\S]*?)<\/div>/,
            /id="filename">([\s\S]*?)<\/div>/,
            /user-radio-0"><\/div>([\s\S]*?)<\/div>/
        ];
        
        for (const pattern of descPatterns) {
            const match = data.match(pattern);
            if (match && match[1]) {
                info.desc = match[1].replace(/<[^>]+>/g, '');
                info.desc = this.htmlspecialcharsDecode(info.desc.trim());
                break;
            }
        }
        if (!info.desc) info.desc = '';
        
        const folderSplit = data.split(/<div class="pc-folderlink">|<div class="mbx mbxfolder">/);
        info.folder = [];
        if (folderSplit.length > 1) {
            for (let i = 1; i < folderSplit.length; i++) {
                const f = folderSplit[i];
                const fiMatch = f.match(/href="\/([^"]+)"/);
                if (fiMatch) {
                    const fnMatch = f.match(/filename">([^<]+)</) || f.match(new RegExp(`href="/${fiMatch[1]}">([^<]+)<`));
                    const fdMatch = f.match(/(?:filesize|pc-folderlinkdes)">([\s\S]*?)</);
                    info.folder.push({
                        id: fiMatch[1],
                        name: fnMatch ? this.htmlspecialcharsDecode(fnMatch[1]) : null,
                        desc: fdMatch ? this.htmlspecialcharsDecode(fdMatch[1].replace(/<[^>]+>/g, '')) : null
                    });
                }
            }
        }
        
        parameter.pg = page;
        parameter.pwd = pwd;
        
        if (js.includes("document.getElementById('pwd').value;") && !pwd) {
            info.list = null;
            
            const shareKey = id.match(/([a-zA-Z0-9]+)$/)?.[1] || id;
            const globalShareKey = "lz:" + shareKey;
            
            return this.createResponse(401, "请输入密码", info, globalShareKey);
        }
        
        if (page === 2) {
            parameter.pg = 0;
        }
        
        return await this.getFolderFiles(info, parameter, id);
    }

    async getFolderFiles(info, parameter, id) {
        const headers = { 'User-Agent': this.desktopUA };
        
        const postData = new URLSearchParams(parameter).toString();
        const response = await this.request(`https://${this.apiDomain}/filemoreajax.php`, 'POST', postData, {
            ...headers,
            'Content-Type': 'application/x-www-form-urlencoded'
        }, 'data');
        
        let json;
        try {
            json = JSON.parse(response);
        } catch (e) {
            json = { zt: 0, info: "解析失败" };
        }
        
        const shareKey = id.match(/([a-zA-Z0-9]+)$/)?.[1] || id;
        const globalShareKey = "lz:" + shareKey;
        
        if (Array.isArray(json.text)) {
            info.list = [];
            for (const v of json.text) {
                if (v.id !== "-1") {
                    info.list.push({
                        id: v.id,
                        ad: !!v.t,
                        name: this.htmlspecialcharsDecode(v.name_all),
                        size: v.size,
                        time: v.time,
                        icon: v.p_ico ? `https://image.woozooo.com/image/ico/${v.ico}?x-oss-process=image/auto-orient,1/resize,m_fill,w_100,h_100/format,png` : null
                    });
                }
            }
            info.have_page = json.text.length >= 50;
            
            return this.createResponse(200, "成功", info, globalShareKey);
        } else if (json.zt === 2) {
            info.list = [];
            info.have_page = false;
            
            return this.createResponse(200, "没有文件", info, globalShareKey);
        } else {
            info.list = null;
            info.have_page = false;
            
            return this.createResponse(502, json.info || "获取失败", info, globalShareKey);
        }
    }

    async request(url, method = 'GET', postdata = null, headers = {}, responseType = 'all') {
        const defaultHeaders = {
            'Referer': `https://${this.apiDomain}/`,
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.9',
            'Accept-Language': 'zh-CN;q=0.9,zh-HK;q=0.8,zh-TW;q=0.7',
            'Cache-Control': 'max-age=0',
            'X-Forwarded-For': '0.0.0.0'
        };
        
        const allHeaders = { ...defaultHeaders, ...headers };
        
        const fetchOptions = {
            method: method.toUpperCase(),
            headers: allHeaders,
            redirect: 'manual'
        };
        
        if (postdata && method.toUpperCase() === 'POST') {
            fetchOptions.body = typeof postdata === 'string' ? postdata : new URLSearchParams(postdata).toString();
            allHeaders['Content-Type'] = 'application/x-www-form-urlencoded';
        }
        
        const response = await fetch(url, fetchOptions);
        
        const result = {
            data: null,
            info: {
                url: response.url,
                status: response.status,
                redirect_url: response.headers.get('location')
            }
        };
        
        if (responseType !== 'info') {
            result.data = await response.text();
        }
        
        if (responseType === 'data') return result.data;
        if (responseType === 'info') return result.info;
        return result;
    }

    createResponse(code, msg, data, globalShareKey = null) {
        const success = [200, 201, 401].includes(code);
        
        const responseData = {
            code: code,
            msg: msg,
            success: success,
            data: data
        };
        
        if (code === 200 && globalShareKey) {
            responseData.shareKey = globalShareKey;
        }
        
        return responseData;
    }

    htmlspecialcharsDecode(text) {
        if (!text) return text;
        const entities = {
            '&amp;': '&',
            '&lt;': '<',
            '&gt;': '>',
            '&quot;': '"',
            '&#039;': "'",
            '&apos;': "'",
            '&#39;': "'"
        };
        return text.replace(/&amp;|&lt;|&gt;|&quot;|&#039;|&apos;|&#39;/g, match => entities[match] || match);
    }
}

// ============================== 响应处理工具 ==============================

async function proxyDownload(downloadUrl, headers, filename) {
    try {
        let currentUrl = downloadUrl;
        let response;
        
        for (let i = 0; i < 3; i++) {
            response = await fetch(currentUrl, {
                method: 'GET',
                headers: headers,
                redirect: 'manual'
            });
            
            if (response.status >= 300 && response.status < 400) {
                const location = response.headers.get('Location');
                if (location) {
                    currentUrl = location;
                    continue;
                }
            }
            break;
        }
        
        if (!response || !response.ok) {
            const status = response ? response.status : '未知';
            return new Response(`下载失败: HTTP ${status}`, {
                status: 502,
                headers: { 'Access-Control-Allow-Origin': '*' }
            });
        }

        const contentType = response.headers.get('content-type') || 'application/octet-stream';
        const contentLength = response.headers.get('content-length');
        const responseHeaders = new Headers({
            'Content-Type': contentType,
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Expose-Headers': 'Content-Disposition, Content-Length',
        });

        if (filename) {
            const encodedFilename = encodeURIComponent(filename);
            responseHeaders.set('Content-Disposition', `attachment; filename="${encodedFilename}"; filename*=UTF-8''${encodedFilename}`);
        }

        if (contentLength) {
            responseHeaders.set('Content-Length', contentLength);
        }

        return new Response(response.body, {
            status: 200,
            headers: responseHeaders
        });

    } catch (error) {
        return new Response(`代理下载失败: ${error.message}`, {
            status: 500,
            headers: { 'Access-Control-Allow-Origin': '*' }
        });
    }
}


function getAliyunDownloadHeaders(config, authorization) {
    const headers = {
        'Referer': 'https://www.alipan.com/',
        'User-Agent': config.aliyun.userAgent,
        'Accept': '*/*',
        'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
        'Accept-Encoding': 'identity',
        'Connection': 'keep-alive',
    };
    
    if (authorization) {
        headers['Authorization'] = authorization.startsWith('Bearer ') ? authorization : 'Bearer ' + authorization;
    }
    
    return headers;
}

function getQuarkDownloadHeaders(config, cookie) {
    return {
        'User-Agent': config.quark.userAgent,
        'Cookie': cookie,
        'Referer': 'https://pan.quark.cn/',
        'Origin': 'https://pan.quark.cn',
        'Accept': '*/*',
        'Accept-Language': 'zh-CN,zh;q=0.9',
        'Accept-Encoding': 'identity',
        'Connection': 'keep-alive',
    };
}


function getUCDownloadHeaders(config, cookie) {
    const cookies = parseCookieString(cookie);
    const headers = {
        'User-Agent': config.uc.userAgent,
        'Accept': '*/*',
        'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
        'Accept-Encoding': 'gzip, deflate, br',
        'Connection': 'keep-alive',
        'Referer': 'https://drive.uc.cn/',
        'Origin': 'https://drive.uc.cn',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'same-origin',
        'Sec-Fetch-User': '?1',
        'Upgrade-Insecure-Requests': '1',
    };
    
    if (cookies.ctoken) {
        headers['X-CToken'] = cookies.ctoken;
    }
    
    if (cookie) {
        headers['Cookie'] = cookie;
    }
    
    return headers;
}

function getMcloudDownloadHeaders(config, authorization) {
    const headers = {
        'User-Agent': config.mcloud.userAgent || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36 Edg/145.0.0.0',
        'Accept': '*/*',
        'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
        'Accept-Encoding': 'gzip, deflate, br',
        'Connection': 'keep-alive',
        'Referer': 'https://yun.139.com/',
        'Origin': 'https://yun.139.com',
    };
    
    if (authorization) {
        headers['Authorization'] = authorization;
    }
    
    return headers;
}


function parseCookieString(cookieString) {
    const cookies = {};
    if (!cookieString) return cookies;
  
    if (cookieString.trim().startsWith('{')) {
        try {
            return JSON.parse(cookieString);
        } catch (e) {
        }
    }
    
    cookieString.split(';').forEach(item => {
        const [key, value] = item.trim().split('=');
        if (key && value !== undefined) {
            cookies[key.trim()] = value.trim();
        }
    });
    
    return cookies;
}

// ============================== 移动云盘解析器 ==============================
class MobileCloudParser {
    constructor(config) {
        this.config = config;
        const mcloudConfig = config.mcloud || {};
        this.cookieManager = new CookieManager('mcloud', mcloudConfig.authorization);
        this.userAgent = mcloudConfig.userAgent || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36 Edg/145.0.0.0';
        this.clientId = '10702';
        this.version = '7.13.3';
        this.deviceId = '522b6107d153211263b13afa2b041bf5';
        this.account = null;
        this.authorization = null;
        this.mcloudSkey = null;
        this.aesKey = 'PVGDwmcvfs1uV3d1';
        this.loginAesKey = 'nYUIM27FoBVCosa5';
        this.getOutLinkInfoEndpoint = 'https://share-kd-njs.yun.139.com/yun-share/richlifeApp/devapp/IOutLink/getOutLinkInfoV6';
        this.dlFromOutLinkEndpoint = 'https://share-kd-njs.yun.139.com/yun-share/richlifeApp/devapp/IOutLink/dlFromOutLinkV3';
    }

    extractAccountFromAuth(authorization) {
        if (!authorization) {
            return null;
        }
        
        try {
            let authStr = authorization.trim();
            if (authStr.toLowerCase().startsWith('basic ')) {
                authStr = authStr.substring(6);
            }
            
            const decoded = atob(authStr);
            console.log(`[*] Authorization解码后: ${decoded}`);
            
            const parts = decoded.split('|');
            if (parts.length >= 1) {
                const firstPart = parts[0];
                const subParts = firstPart.split(':');
                if (subParts.length >= 2) {
                    const account = subParts[1];
                    console.log(`[*] 从Authorization中提取到账号: ${account}`);
                    return account;
                }
            }
            
            console.log(`[!] 无法从Authorization中提取账号`);
            return null;
        } catch (e) {
            console.log(`[!] 解析 authorization 失败: ${e}`);
            return null;
        }
    }

    generateRandomString(length) {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        let result = '';
        for (let i = 0; i < length; i++) {
            result += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return result;
    }

    async parse(shareUrl, pwd = '') {
        try {
            if (!this.config.mcloud.enabled) {
                return { code: 503, msg: '移动云盘解析已禁用', success: false, data: null };
            }

            let authorization = this.config.mcloud.authorization;
            console.log('[MobileCloudParser] config.mcloud.authorization:', authorization ? '已设置' : '未设置');
            
            if (!authorization) {
                const cookieStatus = this.cookieManager.getValidCookie();
                if (!cookieStatus.value) {
                    return {
                        code: 401,
                        msg: '移动云盘 Authorization 未配置，请检查 MCLOUD_AUTHORIZATION 环境变量',
                        success: false,
                        data: null
                    };
                }
                if (cookieStatus.expired) {
                    return {
                        code: 401,
                        msg: '移动云盘 Authorization 已过期（超过24小时），请重新配置 MCLOUD_AUTHORIZATION',
                        success: false,
                        data: {
                            expired: true,
                            hint: 'Authorization 有效期为2小时，从配置完成时开始计时'
                        }
                    };
                }
                authorization = cookieStatus.value;
            }

            this.authorization = authorization;
            this.account = this.extractAccountFromAuth(this.authorization);
            
            let cookieStatus = { remainingTime: 86400000 };
            let decodedUrl = shareUrl;
            console.log('[*] 原始shareUrl:', shareUrl);
            console.log('[*] shareUrl是否包含%:', shareUrl.includes('%'));

            try {
                if (shareUrl.includes('%')) {
                    decodedUrl = decodeURIComponent(shareUrl);
                    console.log('[*] URL已解码:', decodedUrl);
                } else {
                    console.log('[*] URL未编码，使用原始URL');
                }
            } catch (e) {
                console.log('[*] URL解码失败，使用原始URL:', e);
            }

            const shareInfo = this.extractShareInfo(decodedUrl);
            if (!shareInfo.linkId) {
                const url = new URL(decodedUrl);
                const linkId = url.searchParams.get('linkId');
                if (linkId) {
                    return this.parse(`https://yun.139.com/shareweb/#/w/i/${linkId}`, pwd);
                }
                return { code: 400, msg: '无效的移动云盘分享链接', success: false, data: null };
            }

            console.log('[*] 分享ID:', shareInfo.linkId);
            console.log('[*] Account:', this.account);

            console.log('[*] 开始获取文件信息...');
            const files = await this.getShareFiles(shareInfo.linkId, pwd);
            console.log('[*] 获取到的文件数量:', files ? files.length : 0);
            console.log('[*] 文件列表:', JSON.stringify(files, null, 2));
            if (!files || files.length === 0) {
                if (pwd && pwd.trim() !== '') {
                    return { code: 401, msg: '分享密码错误，请检查密码是否正确', success: false, data: null };
                } else {
                    return { code: 403, msg: '该分享需要密码，请提供分享密码', success: false, data: null };
                }
            }

            const results = [];
            for (const file of files) {
                const fileId = file.coID || file.contentID || file.id || file.fileId;
                const fileName = file.coName || file.contentName || file.name || file.fileName;
                const fileSize = file.coSize || file.contentSize || file.size || file.fileSize || 0;
                const isDirectory = file.coType === 1 || file.isDir === 1;
                const filePath = file.path;
                
                // 获取下载链接
                let downloadUrl = null;
                if (!isDirectory && filePath) {
                    console.log('[*] 正在获取文件', fileName, '的下载链接...');
                    downloadUrl = await this.getDownloadUrl(shareInfo.linkId, filePath);
                }
                
                results.push({
                    file_id: fileId,
                    file_name: fileName,
                    file_size: formatFileSize(fileSize),
                    is_directory: isDirectory,
                    download_url: downloadUrl,
                    path: filePath
                });
            }

            const isSingleFile = results.length === 1;
            const responseData = isSingleFile ? results[0] : {
                file_count: results.length,
                files: results
            };

            const remainingTime = cookieStatus.remainingTime;
            
            return {
                code: 200,
                msg: '解析成功',
                success: true,
                cookie_status: {
                    valid: true,
                    remaining_time: formatDuration(remainingTime),
                    remaining_seconds: Math.floor(remainingTime / 1000)
                },
                data: responseData
            };

        } catch (e) {
            return { code: 500, msg: '解析失败: ' + e.message, data: null };
        }
    }

    extractShareInfo(url) {
        url = url.trim();
        const patterns = [
            /https?:\/\/(?:yun|caiyun)\.139\.com\/shareweb\/#\/w\/i\/([a-zA-Z0-9]+)/i,
            /https?:\/\/(?:yun|caiyun)\.139\.com\/shareweb\/\?linkId=([a-zA-Z0-9]+)/i,
            /https?:\/\/(?:yun|caiyun)\.139\.com\/link\/\?linkId=([a-zA-Z0-9]+)/i,
            /\/w\/i\/([a-zA-Z0-9]+)/i,
            /linkId=([a-zA-Z0-9]+)/i
        ];

        for (const pattern of patterns) {
            const match = url.match(pattern);
            if (match) {
                return {
                    linkId: match[1]
                };
            }
        }

        return { linkId: null };
    }

    buildHeaders() {
        return {
            'Accept': 'application/json, text/plain, */*',
            'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
            'Cache-Control': 'no-cache',
            'Caller': 'web',
            'Cms-Device': 'default',
            'Content-Type': 'application/json;charset=UTF-8',
            'Dnt': '1',
            'Hcy-Cool-Flag': '1',
            'Inner-Hcy-Router-Https': '1',
            'Mcloud-Channel': '1000101',
            'Mcloud-Client': this.clientId,
            'Mcloud-Route': '001',
            'Mcloud-Version': this.version,
            'Origin': 'https://yun.139.com',
            'Pragma': 'no-cache',
            'Priority': 'u=1, i',
            'Referer': 'https://yun.139.com/',
            'Sec-Ch-Ua': '"Not)A;Brand";v="99", "Microsoft Edge";v="127", "Chromium";v="127"',
            'Sec-Ch-Ua-Mobile': '?0',
            'Sec-Ch-Ua-Platform': 'Windows',
            'Sec-Fetch-Dest': 'empty',
            'Sec-Fetch-Mode': 'cors',
            'Sec-Fetch-Site': 'same-site',
            'User-Agent': this.userAgent,
            'X-Deviceinfo': `||3|12.27.0|edge||${this.deviceId}||windows 10|922X974|zh-CN|||`,
            'X-Huawei-Channelsrc': '10213406',
            'X-Inner-Ntwk': '2',
            'X-M4c-Caller': 'PC',
            'X-M4c-Src': '10002',
            'X-Svctype': '1',
            'X-Yun-Api-Version': 'v1',
            'X-Yun-App-Channel': '10213406',
            'X-Yun-Channel-Source': '10213406',
            'X-Yun-Client-Info': `||9|${this.version}|edge||${this.deviceId}||windows 10||zh-CN|||ZWRnZQ==||`,
            'X-Yun-Module-Type': '100',
            'X-Yun-Svc-Type': '1',
            'authorization': this.authorization
        };
    }

    async makeHeaders(bodyDict = null, skey = '', contentLength = null) {
        return this.buildHeaders();
    }

    async generateSign(bodyDict) {
        const timestamp = new Date().toISOString().replace('T', ' ').substring(0, 19);
        const nonce = this.generateRandomString(16);
        let s = '';
        if (bodyDict) {
            s = JSON.stringify(bodyDict, null, 0);
            s = encodeURIComponent(s).replace(/[!'()*]/g, (c) => {
                return '%' + c.charCodeAt(0).toString(16);
            });
            s = s.split('').sort().join('');
        }
        const b64 = btoa(unescape(encodeURIComponent(s)));
        const r = await this.md5(b64);
        const c = await this.md5(`${timestamp}:${nonce}`);
        const sign = await this.md5(r + c).then(result => result.toUpperCase());
        return `${timestamp},${nonce},${sign}`;
    }

    async md5(str) {
        const encoder = new TextEncoder();
        const data = encoder.encode(str);
        const hashBuffer = await crypto.subtle.digest('MD5', data);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
        return hashHex;
    }

    async encryptAES(plaintext, key) {
        try {
            const iv = crypto.getRandomValues(new Uint8Array(16));
            
            const keyBytes = new TextEncoder().encode(key);
            const cryptoKey = await crypto.subtle.importKey(
                'raw',
                keyBytes,
                { name: 'AES-CBC' },
                false,
                ['encrypt']
            );
            
            const padded = this.pkcs5Pad(plaintext);
            const dataBytes = new TextEncoder().encode(padded);
            
            const encrypted = await crypto.subtle.encrypt(
                { name: 'AES-CBC', iv: iv },
                cryptoKey,
                dataBytes
            );
            
            const result = new Uint8Array(iv.length + encrypted.byteLength);
            result.set(iv, 0);
            result.set(new Uint8Array(encrypted), iv.length);
            
            return btoa(String.fromCharCode(...result));
        } catch (e) {
            console.log('[!] AES加密失败:', e);
            return plaintext;
        }
    }
    
    async decryptAES(encryptedData, key) {
        try {
            const decoded = atob(encryptedData);
            const decodedBytes = new Uint8Array(decoded.length);
            for (let i = 0; i < decoded.length; i++) {
                decodedBytes[i] = decoded.charCodeAt(i);
            }
            
            const iv = decodedBytes.slice(0, 16);
            const encrypted = decodedBytes.slice(16);
            const keyBytes = new TextEncoder().encode(key);
            const cryptoKey = await crypto.subtle.importKey(
                'raw',
                keyBytes,
                { name: 'AES-CBC' },
                false,
                ['decrypt']
            );
            
            const decrypted = await crypto.subtle.decrypt(
                { name: 'AES-CBC', iv: iv },
                cryptoKey,
                encrypted
            );
            
            try {
                const decryptedStr = new TextDecoder().decode(decrypted);
                
                return this.pkcs5Unpad(decryptedStr);
            } catch (e) {
                console.log('[!] 转换解密结果为字符串失败:', e);
                return null;
            }
        } catch (e) {
            console.log('[!] AES解密失败:', e);
            return null;
        }
    }
    
    async encrypt139(plaintext) {
        return await this.encryptAES(plaintext, this.aesKey);
    }
    
    async decrypt139(encryptedData) {
        return await this.decryptAES(encryptedData, this.aesKey);
    }
    
    pkcs5Pad(data) {
        const blockSize = 16;
        const paddingLen = blockSize - (data.length % blockSize);
        const padding = String.fromCharCode(paddingLen).repeat(paddingLen);
        return data + padding;
    }
    
    pkcs5Unpad(data) {
        if (!data || data.length === 0) return data;
        const paddingLen = data.charCodeAt(data.length - 1);
        if (paddingLen > 16) return data;
        return data.substring(0, data.length - paddingLen);
    }

    async rsaEncrypt(pubKeyStr, plaintext) {
        console.log('[*] 执行 RSA 加密...');
        
        try {
            
            let pemKey = pubKeyStr;
            
            if (!pemKey.includes('-----BEGIN PUBLIC KEY-----')) {
                pemKey = `-----BEGIN PUBLIC KEY-----\n${pemKey}\n-----END PUBLIC KEY-----`;
            }
            
            const pemHeader = "-----BEGIN PUBLIC KEY-----";
            const pemFooter = "-----END PUBLIC KEY-----";
            const pemContents = pemKey.substring(pemHeader.length, pemKey.length - pemFooter.length);
            const pemContentsTrimmed = pemContents.replace(/\s/g, '');
            const binaryDerString = atob(pemContentsTrimmed);
            const binaryDer = new Uint8Array(binaryDerString.length);
            for (let i = 0; i < binaryDerString.length; i++) {
                binaryDer[i] = binaryDerString.charCodeAt(i);
            }
            
            const publicKey = await crypto.subtle.importKey(
                "spki",
                binaryDer,
                {
                    name: "RSAES-PKCS1-v1_5",
                    hash: "SHA-1"
                },
                false,
                ["encrypt"]
            );
            
            const encoder = new TextEncoder();
            const data = encoder.encode(plaintext);
            const encrypted = await crypto.subtle.encrypt(
                {
                    name: "RSAES-PKCS1-v1_5"
                },
                publicKey,
                data
            );
            
            const encryptedArray = new Uint8Array(encrypted);
            const encryptedBase64 = btoa(String.fromCharCode(...encryptedArray));
            
            console.log('[*] RSA 加密成功');
            return encryptedBase64;
            
        } catch (e) {
            console.log(`[!] RSA 加密失败: ${e}`);
            return this.generateRandomString(100);
        }
    }

    async getShareFiles(linkId, pwd = '') {
        try {
            if (!this.account) {
                console.log('[!] 无法获取手机号，请检查Authorization配置');
                return [];
            }
            
            console.log('[*] API端点:', this.getOutLinkInfoEndpoint);
            
            const bodyTemplate = '{"getOutLinkInfoReq":{"account":"{account}","linkID":"{key}","passwd":"{pwd}","caSrt":0,"coSrt":0,"srtDr":1,"bNum":1,"pCaID":"root","eNum":200},"commonAccountInfo":{"account":"{account}","accountType":1}}';
            const bodyStr = bodyTemplate
                .replace(/{account}/g, this.account)
                .replace(/{key}/g, linkId)
                .replace(/{pwd}/g, pwd);
            
            console.log('[*] 加密前请求体:', bodyStr);
            const encryptedBody = await this.encrypt139(bodyStr);
            console.log('[*] 加密后请求体:', encryptedBody.substring(0, 100) + '...');
            const headers = this.buildHeaders();
            
            // 发送请求
            const resp = await fetch(this.getOutLinkInfoEndpoint, {
                method: 'POST',
                headers: headers,
                body: encryptedBody
            });
            
            console.log('[*] 响应状态:', resp.status);
            
            if (resp.status !== 200) {
                console.log('[!] 获取文件信息失败: HTTP', resp.status);
                return [];
            }
            
            const encryptedResponse = await resp.text();
            if (!encryptedResponse) {
                console.log('[!] 响应内容为空');
                return [];
            }
            
            console.log('[*] 加密响应:', encryptedResponse.substring(0, 100) + '...');
            
            // 解密响应
            const decryptedResponse = await this.decrypt139(encryptedResponse);
            if (!decryptedResponse) {
                console.log('[!] 解密响应失败');
                return [];
            }
            
            console.log('[*] 解密后响应:', decryptedResponse.substring(0, 500));
            
            // 解析JSON
            const result = JSON.parse(decryptedResponse);
            console.log('[*] 响应:', JSON.stringify(result, null, 2));
            
            // 检查响应是否成功
            if (result.success) {
                const data = result.data || {};
                const fileList = data.coLst || [];
                
                if (data.needPwd === true || data.needPwd === 1) {
                    console.log('[!] 该分享需要密码，但未提供密码或密码错误');
                    return [];
                }
                
                if (data.pwdError === true || data.pwdError === 1) {
                    console.log('[!] 分享密码错误');
                    return [];
                }
                
                console.log('[*] 成功获取到', fileList.length, '个文件');
                return fileList;
            } else {
                const desc = result.desc || result.msg || '';
                console.log('[!] API返回错误:', desc);
                
                if (desc.includes('密码') || desc.includes('pwd') || desc.includes('password')) {
                    console.log('[!] 密码验证失败');
                    return [];
                }
            }
            
            return [];
        } catch (e) {
            console.log('[!] 获取文件信息异常:', e);
            return [];
        }
    }

    async getDownloadUrl(linkId, filePath) {
        try {
            if (!this.account) {
                console.log('[!] 无法获取手机号，请检查Authorization配置');
                return null;
            }
            
            if (!filePath) {
                console.log('[!] 文件路径为空');
                return null;
            }
            
            console.log('[*] 获取下载链接API端点:', this.dlFromOutLinkEndpoint);
            
            const bodyTemplate = '{"dlFromOutLinkReqV3":{"account":"{account}","linkID":"{key}","coIDLst":{"item":["{item}"]}},"commonAccountInfo":{"account":"{account}","accountType":1}}';
            const bodyStr = bodyTemplate
                .replace(/{account}/g, this.account)
                .replace(/{key}/g, linkId)
                .replace(/{item}/g, filePath);
            
            console.log('[*] 下载链接请求体:', bodyStr);
            
            // 加密请求体
            const encryptedBody = await this.encrypt139(bodyStr);
            
            // 构建请求头
            const headers = this.buildHeaders();
            
            // 发送请求
            const resp = await fetch(this.dlFromOutLinkEndpoint, {
                method: 'POST',
                headers: headers,
                body: encryptedBody
            });
            
            console.log('[*] 下载链接响应状态:', resp.status);
            
            if (resp.status !== 200) {
                console.log('[!] 获取下载链接失败: HTTP', resp.status);
                return null;
            }
            
            const encryptedResponse = await resp.text();
            if (!encryptedResponse) {
                console.log('[!] 下载链接响应为空');
                return null;
            }
            
            const decryptedResponse = await this.decrypt139(encryptedResponse);
            if (!decryptedResponse) {
                console.log('[!] 解密下载链接响应失败');
                return null;
            }
            
            console.log('[*] 解密后下载链接响应:', decryptedResponse.substring(0, 500));
            const result = JSON.parse(decryptedResponse);
            
            if (result.success) {
                const data = result.data || {};
                const downloadUrl = data.redrUrl || data.downloadUrl || data.url;
                if (downloadUrl) {
                    console.log('[*] 成功获取下载链接:', downloadUrl.substring(0, 100) + '...');
                    return downloadUrl;
                } else {
                    console.log('[!] 响应中未找到下载链接:', result);
                }
            } else {
                console.log('[!] API返回错误:', result.desc || result.msg);
            }
            
            return null;
        } catch (e) {
            console.log('[!] 获取下载链接异常:', e);
            return null;
        }
    }
}

function handleResponse(result, type, configRedirect, config, isAliyun = false, isQuark = false, quarkCookie = null, isUC = false, ucCookie = null, isMcloud = false, mcloudAuthorization = null, aliyunAuthorization = null) {
    let shouldRedirect = false;
    
    if (type === 'down') {
        shouldRedirect = true;
    } else if (type === 'json') {
        shouldRedirect = false;
    } else {
        shouldRedirect = configRedirect;
    }
    
    const hasDownloadUrl = result.code === 200 && 
                          result.data && 
                          !result.data.files &&
                          result.data.download_url && 
                          !result.data.is_folder &&
                          !result.data.list;
    
    if (!shouldRedirect || !hasDownloadUrl) {
        const corsHeaders = {
            'Content-Type': 'application/json; charset=utf-8',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With'
        };
        
        return new Response(JSON.stringify(result, null, 2), {
            headers: corsHeaders
        });
    }

    const downloadUrl = result.data.download_url;
    const filename = result.data.file_name || 'download';

    if (isAliyun) {
        const headers = getAliyunDownloadHeaders(config, aliyunAuthorization);
        return proxyDownload(downloadUrl, headers, filename);
    } else if (isQuark) {
        const headers = getQuarkDownloadHeaders(config, quarkCookie);
        return proxyDownload(downloadUrl, headers, filename);
    } else if (isUC) {
        const headers = getUCDownloadHeaders(config, ucCookie);
        return proxyDownload(downloadUrl, headers, filename);
    } else if (isMcloud) {
        const headers = getMcloudDownloadHeaders(config, mcloudAuthorization);
        return proxyDownload(downloadUrl, headers, filename);
    } else {
        return new Response(null, {
            status: 302,
            headers: {
                'Location': downloadUrl,
                'Access-Control-Allow-Origin': '*',
                'Cache-Control': 'no-cache'
            }
        });
    }
}

// ============================== HTML页面 ==============================
function index() {
    return '<!DOCTYPE html>\n' +
        '<html lang="zh-CN">\n' +
        '<head>\n' +
        '    <meta charset="UTF-8">\n' +
        '    <meta name="viewport" content="width=device-width, initial-scale=1.0">\n' +
        '    <title>网盘解析工具</title>\n' +
        '    <script src="https://cdn.tailwindcss.com"></script>\n' +
        '    <link href="https://cdn.jsdelivr.net/npm/font-awesome@4.7.0/css/font-awesome.min.css" rel="stylesheet">\n' +
        '    <script>\n' +
        '        tailwind.config = {\n' +
        '            theme: {\n' +
        '                extend: {\n' +
        '                    colors: {\n' +
        '                        primary: "#3b82f6",\n' +
        '                        secondary: "#64748b",\n' +
        '                        success: "#10b981",\n' +
        '                        warning: "#f59e0b",\n' +
        '                        danger: "#ef4444",\n' +
        '                        dark: "#1e293b",\n' +
        '                        light: "#f8fafc"\n' +
        '                    },\n' +
        '                    fontFamily: {\n' +
        '                        sans: ["Inter", "system-ui", "sans-serif"],\n' +
        '                    },\n' +
        '                }\n' +
        '            }\n' +
        '        }\n' +
        '    </script>\n' +
        '    <style type="text/tailwindcss">\n' +
        '        @layer utilities {\n' +
        '            .content-auto {\n' +
        '                content-visibility: auto;\n' +
        '            }\n' +
        '            .form-focus {\n' +
        '                @apply focus:ring-2 focus:ring-primary focus:border-primary focus:outline-none;\n' +
        '            }\n' +
        '            .btn {\n' +
        '                @apply px-4 py-2 rounded-md font-medium transition-all duration-200;\n' +
        '            }\n' +
        '            .btn-primary {\n' +
        '                @apply bg-primary text-white hover:bg-primary/90 focus:ring-2 focus:ring-primary/50;\n' +
        '            }\n' +
        '            .btn-outline {\n' +
        '                @apply border border-gray-300 hover:bg-gray-50 focus:ring-2 focus:ring-primary/50;\n' +
        '            }\n' +
        '            .card {\n' +
        '                @apply bg-white rounded-lg shadow-md p-6 transition-all duration-300 hover:shadow-lg;\n' +
        '            }\n' +
        '            .input-group {\n' +
        '                @apply mb-4;\n' +
        '            }\n' +
        '            .input-label {\n' +
        '                @apply block text-sm font-medium text-gray-700 mb-1;\n' +
        '            }\n' +
        '            .input-field {\n' +
        '                @apply w-full px-3 py-2 border border-gray-300 rounded-md form-focus;\n' +
        '            }\n' +
        '            .textarea-field {\n' +
        '                @apply w-full px-3 py-2 border border-gray-300 rounded-md form-focus min-h-[100px];\n' +
        '            }\n' +
        '            .toggle-checkbox:checked {\n' +
        '                @apply right-0 border-green-400;\n' +
        '            }\n' +
        '            .toggle-checkbox:checked + .toggle-label {\n' +
        '                @apply bg-green-400;\n' +
        '            }\n' +
        '        }\n' +
        '    </style>\n' +
        '</head>\n' +
        '<body class="bg-gray-50 min-h-screen">\n' +
        '    <div class="container mx-auto px-4 py-8 max-w-4xl">\n' +
        '        <!-- 头部 -->\n' +
        '        <header class="text-center mb-8">\n' +
        '            <h1 class="text-3xl font-bold text-dark mb-2">网盘解析工具</h1>\n' +
        '            <p class="text-secondary">支持阿里云盘、夸克网盘、UC网盘、移动云盘等多种网盘</p>\n' +
        '        </header>\n' +
        '\n' +
        '        <!-- 主内容 -->\n' +
        '        <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">\n' +
        '            <!-- 左侧：解析表单 -->\n' +
        '            <div class="lg:col-span-2">\n' +
        '                <div class="card">\n' +
        '                    <h2 class="text-xl font-semibold mb-4 flex items-center">\n' +
        '                        <i class="fa fa-link mr-2 text-primary"></i> 解析设置\n' +
        '                    </h2>\n' +
        '                    \n' +
        '                    <form id="parseForm" class="space-y-4">\n' +
        '                        <!-- 分享链接 -->\n' +
        '                        <div class="input-group">\n' +
        '                            <label for="shareUrl" class="input-label">分享链接</label>\n' +
        '                            <input type="text" id="shareUrl" name="url" class="input-field" placeholder="请输入网盘分享链接" required>\n' +
        '                        </div>\n' +
        '\n' +
        '                        <!-- 分享密码 -->\n' +
        '                        <div class="input-group">\n' +
        '                            <label for="sharePassword" class="input-label">分享密码（如果有）</label>\n' +
        '                            <input type="text" id="sharePassword" name="pwd" class="input-field" placeholder="请输入分享密码">\n' +
        '                        </div>\n' +
        '\n' +
        '                        <!-- 解析按钮 -->\n' +
        '                        <div class="pt-2">\n' +
        '                            <button type="button" id="parseButton" onclick="parseLink()" class="btn btn-primary w-full flex items-center justify-center">\n' +
        '                                <i class="fa fa-search mr-2"></i> 开始解析\n' +
        '                            </button>\n' +
        '                        </div>\n' +
        '                    </form>\n' +
        '                </div>\n' +
        '\n' +
        '                <!-- 解析结果 -->\n' +
        '                <div class="card mt-6">\n' +
        '                    <h2 class="text-xl font-semibold mb-4 flex items-center">\n' +
        '                        <i class="fa fa-results mr-2 text-primary"></i> 解析结果\n' +
        '                    </h2>\n' +
        '                    <div id="result" class="min-h-[200px] bg-gray-50 rounded-md p-4">\n' +
        '                        <p class="text-secondary text-center py-8">解析结果将显示在这里</p>\n' +
        '                    </div>\n' +
        '                </div>\n' +
        '            </div>\n' +
        '\n' +
        '            <!-- 右侧：网盘配置 -->\n' +
        '            <div class="lg:col-span-1">\n' +
        '                <div class="card" style="max-height: 600px; overflow-y: auto;">\n' +
        '                    <h2 class="text-xl font-semibold mb-4 flex items-center">\n' +
        '                        <i class="fa fa-cog mr-2 text-primary"></i> 网盘配置\n' +
        '                    </h2>\n' +
        '                    \n' +
        '                    <!-- 阿里云盘 -->\n' +
        '                    <div class="mb-6">\n' +
        '                        <div class="mb-2">\n' +
        '                            <h3 class="font-medium text-gray-700">阿里云盘</h3>\n' +
        '                        </div>\n' +
        '                        <div class="input-group">\n' +
        '                            <label for="aliyunAuth" class="input-label text-sm">Authorization</label>\n' +
        '                            <textarea id="aliyunAuth" class="textarea-field" placeholder="请输入阿里云盘Authorization"></textarea>\n' +
        '                        </div>\n' +
        '                    </div>\n' +
        '\n' +
        '                    <!-- 夸克网盘 -->\n' +
        '                    <div class="mb-6">\n' +
        '                        <div class="mb-2">\n' +
        '                            <h3 class="font-medium text-gray-700">夸克网盘</h3>\n' +
        '                        </div>\n' +
        '                        <div class="input-group">\n' +
        '                            <label for="quarkCookie" class="input-label text-sm">Cookie</label>\n' +
        '                            <textarea id="quarkCookie" class="textarea-field" placeholder="请输入夸克网盘Cookie"></textarea>\n' +
        '                        </div>\n' +
        '                    </div>\n' +
        '\n' +
        '                    <!-- UC网盘 -->\n' +
        '                    <div class="mb-6">\n' +
        '                        <div class="mb-2">\n' +
        '                            <h3 class="font-medium text-gray-700">UC网盘</h3>\n' +
        '                        </div>\n' +
        '                        <div class="input-group">\n' +
        '                            <label for="ucCookie" class="input-label text-sm">Cookie</label>\n' +
        '                            <textarea id="ucCookie" class="textarea-field" placeholder="请输入UC网盘Cookie"></textarea>\n' +
        '                        </div>\n' +
        '                    </div>\n' +
        '\n' +
        '                    <!-- 移动云盘 -->\n' +
        '                    <div class="mb-6">\n' +
        '                        <div class="mb-2">\n' +
        '                            <h3 class="font-medium text-gray-700">移动云盘</h3>\n' +
        '                        </div>\n' +
        '                        <div class="input-group">\n' +
        '                            <label for="mcloudAuth" class="input-label text-sm">Authorization</label>\n' +
        '                            <textarea id="mcloudAuth" class="textarea-field" placeholder="请输入移动云盘Authorization"></textarea>\n' +
        '                        </div>\n' +
        '                        <div class="input-group">\n' +
        '                            <label for="mcloudCookie" class="input-label text-sm">Cookie</label>\n' +
        '                            <textarea id="mcloudCookie" class="textarea-field" placeholder="请输入移动云盘Cookie"></textarea>\n' +
        '                        </div>\n' +
        '                    </div>\n' +
        '\n' +
        '                    <!-- 保存配置按钮 -->\n' +
        '                    <button id="saveConfig" class="btn btn-outline w-full flex items-center justify-center">\n' +
        '                        <i class="fa fa-save mr-2"></i> 保存配置\n' +
        '                    </button>\n' +
        '                </div>\n' +
        '            </div>\n' +
        '        </div>\n' +
        '\n' +
        '        <!-- 底部 -->\n' +
        '        <footer class="mt-8 text-center text-secondary text-sm">\n' +
        '            <p>© 2024 网盘解析工具 | 支持多种网盘解析</p>\n' +
        '        </footer>\n' +
        '    </div>\n' +
        '\n' +
        '    <!-- 脚本 -->\n' +
        '    <script>\n' +
        '        // 页面加载时从本地存储加载配置\n' +
        '        document.addEventListener("DOMContentLoaded", function() {\n' +
        '            console.log("DOMContentLoaded事件触发");\n' +
        '            loadConfig();\n' +
        '            setupEventListeners();\n' +
        '        });\n' +
        '\n' +
        '        // 设置事件监听器\n' +
        '        function setupEventListeners() {\n' +
        '            console.log("setupEventListeners函数被调用");\n' +
        '            // 解析按钮点击事件\n' +
        '            const parseButton = document.getElementById("parseButton");\n' +
        '            console.log("parseButton元素:", parseButton);\n' +
        '            if (parseButton) {\n' +
        '                parseButton.addEventListener("click", function(e) {\n' +
        '                    console.log("按钮点击事件触发");\n' +
        '                    e.preventDefault();\n' +
        '                    parseLink();\n' +
        '                });\n' +
        '            }\n' +
        '\n' +
        '            // 保存配置按钮\n' +
        '            document.getElementById("saveConfig").addEventListener("click", saveConfig);\n' +
        '        }\n' +
        '\n' +
        '        // 从本地存储加载配置\n' +
        '        function loadConfig() {\n' +
        '            const config = JSON.parse(localStorage.getItem("netdiskConfig") || "{}");\n' +
        '            \n' +
        '            // 阿里云盘\n' +
        '            document.getElementById("aliyunAuth").value = config.aliyun?.authorization || "";\n' +
        '            \n' +
        '            // 夸克网盘\n' +
        '            document.getElementById("quarkCookie").value = config.quark?.cookie || "";\n' +
        '            \n' +
        '            // UC网盘\n' +
        '            document.getElementById("ucCookie").value = config.uc?.cookie || "";\n' +
        '            \n' +
        '            // 移动云盘\n' +
        '            document.getElementById("mcloudAuth").value = config.mcloud?.authorization || "";\n' +
        '            document.getElementById("mcloudCookie").value = config.mcloud?.cookie || "";\n' +
        '        }\n' +
        '\n' +
        '        // 保存配置到本地存储\n' +
        '        function saveConfig() {\n' +
        '            const config = {\n' +
        '                aliyun: {\n' +
        '                    enabled: true,\n' +
        '                    authorization: document.getElementById("aliyunAuth").value\n' +
        '                },\n' +
        '                quark: {\n' +
        '                    enabled: true,\n' +
        '                    cookie: document.getElementById("quarkCookie").value\n' +
        '                },\n' +
        '                uc: {\n' +
        '                    enabled: true,\n' +
        '                    cookie: document.getElementById("ucCookie").value\n' +
        '                },\n' +
        '                mcloud: {\n' +
        '                    enabled: true,\n' +
        '                    authorization: document.getElementById("mcloudAuth").value,\n' +
        '                    cookie: document.getElementById("mcloudCookie").value\n' +
        '                }\n' +
        '            };\n' +
        '            \n' +
        '            localStorage.setItem("netdiskConfig", JSON.stringify(config));\n' +
        '            \n' +
        '            // 显示保存成功提示\n' +
        '            showNotification("配置保存成功！", "success");\n' +
        '        }\n' +
        '\n' +
        '        // 解析链接\n' +
        '        function parseLink() {\n' +
        '            console.log("parseLink函数被调用");\n' +
        '            const shareUrl = document.getElementById("shareUrl").value;\n' +
        '            const sharePassword = document.getElementById("sharePassword").value;\n' +
        '            console.log("shareUrl:", shareUrl, "sharePassword:", sharePassword);\n' +
        '            \n' +
        '            if (!shareUrl) {\n' +
        '                showNotification("请输入分享链接", "error");\n' +
        '                return;\n' +
        '            }\n' +
        '            \n' +
        '            // 显示加载状态\n' +
        '            const resultDiv = document.getElementById("result");\n' +
        '            resultDiv.innerHTML = \'<div class="flex justify-center items-center py-8"><i class="fa fa-spinner fa-spin text-primary text-2xl"></i><span class="ml-2 text-gray-600">解析中...</span></div>\';\n' +
        '            \n' +
        '            // 获取配置\n' +
        '            const config = JSON.parse(localStorage.getItem("netdiskConfig") || "{}");\n' +
        '            console.log("[前端] 当前配置:", config);\n' +
        '            \n' +
        '            // 根据链接类型获取对应的Authorization\n' +
        '            let auth = "";\n' +
        '            if (shareUrl.includes("yun.139.com") || shareUrl.includes("caiyun.139.com")) {\n' +
        '                auth = config.mcloud?.authorization || "";\n' +
        '                console.log("[前端] 移动云盘Authorization:", auth ? "已设置" : "未设置");\n' +
        '            } else if (shareUrl.includes("alipan.com") || shareUrl.includes("aliyundrive.com")) {\n' +
        '                auth = config.aliyun?.authorization || "";\n' +
        '                console.log("[前端] 阿里云盘Authorization:", auth ? "已设置" : "未设置");\n' +
        '            }\n' +
        '            \n' +
        '            // 构建请求URL\n' +
        '            let requestUrl = "/?url=" + encodeURIComponent(shareUrl) + "&pwd=" + encodeURIComponent(sharePassword) + "&type=json";\n' +
        '            if (auth) {\n' +
        '                requestUrl += "&auth=" + encodeURIComponent(auth);\n' +
        '                console.log("[前端] 已添加auth参数到请求");\n' +
        '            } else {\n' +
        '                console.log("[前端] 警告: 未设置Authorization");\n' +
        '            }\n' +
        '            \n' +
        '            // 调用解析脚本\n' +
        '            fetch(requestUrl)\n' +
        '                .then(response => {\n' +
        '                    if (!response.ok) {\n' +
        '                        throw new Error("HTTP error " + response.status);\n' +
        '                    }\n' +
        '                    return response.json();\n' +
        '                })\n' +
        '                .then(result => {\n' +
        '                    // 显示解析结果\n' +
        '                    displayResult(result);\n' +
        '                })\n' +
        '                .catch(error => {\n' +
        '                    // 显示错误信息\n' +
        '                    const html = \'<div class="bg-red-50 p-4 rounded-md border border-red-100"><div class="flex items-center mb-2"><i class="fa fa-exclamation-circle text-danger mr-2"></i><h4 class="font-medium text-danger">请求失败</h4></div><p class="text-gray-600">\' + error.message + \'</p><p class="text-gray-500 text-sm mt-2">请确保解析脚本已正确部署并运行</p></div>\';\n' +
        '                    resultDiv.innerHTML = html;\n' +
        '                });\n' +
        '        }\n' +
        '\n' +
        '        // 显示解析结果\n' +
        '        function displayResult(result) {\n' +
        '            const resultDiv = document.getElementById("result");\n' +
        '            \n' +
        '            if (result.success) {\n' +
        '                // 存储当前结果用于下载\n' +
        '                window.currentParseResult = result;\n' +
        '                \n' +
        '                if (result.data.files) {\n' +
        '                    // 多文件结果\n' +
        '                    let html = \'<div class="space-y-4">\';\n' +
        '                    html += \'<p class="text-success font-medium">解析成功，共找到 \' + result.data.file_count + \' 个文件</p>\';\n' +
        '                    \n' +
        '                    // 显示JSON结果\n' +
        '                    html += \'<div class="bg-gray-900 text-green-400 p-4 rounded-md overflow-x-auto"><pre class="text-sm">\' + JSON.stringify(result, null, 2) + \'</pre></div>\';\n' +
        '                    \n' +
        '                    // 下载按钮\n' +
        '                    html += \'<button onclick="downloadCurrentFile()" class="btn btn-primary w-full flex items-center justify-center mt-4"><i class="fa fa-download mr-2"></i> 下载此文件</button>\';\n' +
        '                    \n' +
        '                    resultDiv.innerHTML = html;\n' +
        '                } else {\n' +
        '                    // 单文件结果\n' +
        '                    let html = \'<div class="space-y-4">\';\n' +
        '                    \n' +
        '                    // 显示JSON结果\n' +
        '                    html += \'<div class="bg-gray-900 text-green-400 p-4 rounded-md overflow-x-auto"><pre class="text-sm">\' + JSON.stringify(result, null, 2) + \'</pre></div>\';\n' +
        '                    \n' +
        '                    // 下载按钮\n' +
        '                    html += \'<button onclick="downloadCurrentFile()" class="btn btn-primary w-full flex items-center justify-center"><i class="fa fa-download mr-2"></i> 下载此文件</button>\';\n' +
        '                    \n' +
        '                    html += \'</div>\';\n' +
        '                    resultDiv.innerHTML = html;\n' +
        '                }\n' +
        '            } else {\n' +
        '                // 解析失败 - 显示JSON格式的错误信息\n' +
        '                let html = \'<div class="bg-red-50 p-4 rounded-md border border-red-100 mb-4"><div class="flex items-center mb-2"><i class="fa fa-exclamation-circle text-danger mr-2"></i><h4 class="font-medium text-danger">解析失败</h4></div><p class="text-gray-600">\' + result.msg + \'</p></div>\';\n' +
        '                html += \'<div class="bg-gray-900 text-red-400 p-4 rounded-md overflow-x-auto"><pre class="text-sm">\' + JSON.stringify(result, null, 2) + \'</pre></div>\';\n' +
        '                resultDiv.innerHTML = html;\n' +
        '            }\n' +
        '        }\n' +
        '        \n' +
        '        // 下载当前解析的文件\n' +
        '        function downloadCurrentFile() {\n' +
        '            if (!window.currentParseResult || !window.currentParseResult.success) {\n' +
        '                showNotification("没有可用的下载链接", "error");\n' +
        '                return;\n' +
        '            }\n' +
        '            \n' +
        '            const result = window.currentParseResult;\n' +
        '            const shareUrl = document.getElementById("shareUrl").value;\n' +
        '            const sharePassword = document.getElementById("sharePassword").value;\n' +
        '            \n' +
        '            // 获取认证信息\n' +
        '            let auth = "";\n' +
        '            if (/yun\\.139\\.com|caiyun\\.139\\.com/i.test(shareUrl)) {\n' +
        '                auth = document.getElementById("mcloudAuth").value;\n' +
        '            } else if (/alipan\\.com|aliyundrive\\.com/i.test(shareUrl)) {\n' +
        '                auth = document.getElementById("aliyunAuth").value;\n' +
        '            } else if (/pan\\.quark\\.cn/i.test(shareUrl)) {\n' +
        '                auth = document.getElementById("quarkCookie").value;\n' +
        '            } else if (/uc\\.cn|fast\\.uc\\.cn|drive\\.uc\\.cn/i.test(shareUrl)) {\n' +
        '                auth = document.getElementById("ucCookie").value;\n' +
        '            }\n' +
        '            \n' +
        '            // 构建下载URL\n' +
        '            let downloadUrl = window.location.origin + window.location.pathname + "?url=" + encodeURIComponent(shareUrl) + "&type=down";\n' +
        '            if (sharePassword) {\n' +
        '                downloadUrl += "&pwd=" + encodeURIComponent(sharePassword);\n' +
        '            }\n' +
        '            if (auth) {\n' +
        '                downloadUrl += "&auth=" + encodeURIComponent(auth);\n' +
        '            }\n' +
        '            \n' +
        '            // 打开下载链接\n' +
        '            window.open(downloadUrl, "_blank");\n' +
        '        }\n' +
        '\n' +
        '        // 显示通知\n' +
        '        function showNotification(message, type = "info") {\n' +
        '            // 创建通知元素\n' +
        '            const notification = document.createElement("div");\n' +
        '            notification.className = "fixed top-4 right-4 px-4 py-3 rounded-md shadow-lg z-50 transition-all duration-300 transform translate-y-0 opacity-100";\n' +
        '            \n' +
        '            // 设置通知样式\n' +
        '            if (type === "success") {\n' +
        '                notification.className += " bg-success text-white";\n' +
        '                notification.innerHTML = \'<i class="fa fa-check-circle mr-2"></i>\' + message;\n' +
        '            } else if (type === "error") {\n' +
        '                notification.className += " bg-danger text-white";\n' +
        '                notification.innerHTML = \'<i class="fa fa-exclamation-circle mr-2"></i>\' + message;\n' +
        '            } else {\n' +
        '                notification.className += " bg-primary text-white";\n' +
        '                notification.innerHTML = \'<i class="fa fa-info-circle mr-2"></i>\' + message;\n' +
        '            }\n' +
        '            \n' +
        '            // 添加到页面\n' +
        '            document.body.appendChild(notification);\n' +
        '            \n' +
        '            // 3秒后移除通知\n' +
        '            setTimeout(() => {\n' +
        '                notification.classList.add("translate-y-[-100%]", "opacity-0");\n' +
        '                setTimeout(() => {\n' +
        '                    document.body.removeChild(notification);\n' +
        '                }, 300);\n' +
        '            }, 3000);\n' +
        '        }\n' +
        '    </script>\n' +
        '</body>\n' +
        '</html>';
}

// ============================== 主入口 ==============================
export default {
    async fetch(request, env, ctx) {
        const url = new URL(request.url);
        
        const CONFIG = getConfig(env);
        
        // CORS
        if (request.method === 'OPTIONS') {
            return new Response(null, {
                status: 204,
                headers: {
                    'Access-Control-Allow-Origin': '*',
                    'Access-Control-Allow-Methods': 'GET, POST, HEAD, OPTIONS',
                    'Access-Control-Allow-Headers': '*',
                    'Access-Control-Max-Age': '2592000',
                    'Allow': 'GET, POST, HEAD'
                }
            });
        }
        
        if (!['GET', 'POST', 'HEAD'].includes(request.method)) {
            return new Response("Method Not Allowed", {
                status: 405,
                headers: { 'Access-Control-Allow-Origin': '*' }
            });
        }

        const targetUrl = url.searchParams.get('url');
        const pwd = url.searchParams.get('pwd') || '';
        const type = url.searchParams.get('type') || '';
        const authParam = url.searchParams.get('auth') || '';

        // 参数检查
        if (!targetUrl) {
            // 没有提供URL参数，返回HTML页面
            return new Response(index(), {
                headers: {
                    'Content-Type': 'text/html; charset=utf-8',
                    'Access-Control-Allow-Origin': '*'
                }
            });
        }

        let result;
        let isAliyun = false;
        let isQuark = false;
        let isUC = false;
        let quarkCookie = null;
        let ucCookie = null;
        let quarkParser = null;
        let ucParser = null;
        let isMcloud = false;
        let mcloudAuthorization = null;
        
        if (authParam) {
            console.log('[后端] 从请求参数获取到auth，优先使用');
            if (/yun\.139\.com|caiyun\.139\.com/i.test(targetUrl)) {
                CONFIG.mcloud.authorization = authParam;
                console.log('[后端] 已设置移动云盘authorization（优先级：前端配置）');
            } else if (/alipan\.com|aliyundrive\.com/i.test(targetUrl)) {
                CONFIG.aliyun.authorization = authParam;
                console.log('[后端] 已设置阿里云盘authorization（优先级：前端配置）');
            } else if (/pan\.quark\.cn/i.test(targetUrl)) {
                CONFIG.quark.cookie = authParam;
                console.log('[后端] 已设置夸克网盘cookie（优先级：前端配置）');
            } else if (/uc\.cn|fast\.uc\.cn|drive\.uc\.cn/i.test(targetUrl)) {
                CONFIG.uc.cookie = authParam;
                console.log('[后端] 已设置UC网盘cookie（优先级：前端配置）');
            }
        } else {
            console.log('[后端] 请求参数中没有auth，使用环境变量或默认值（优先级：环境变量 > 默认值）');
        }

        try {
            if (/alipan\.com|aliyundrive\.com/i.test(targetUrl)) {
                isAliyun = true;
                const parser = new AliyunPanParser(CONFIG);
                result = await parser.parse(targetUrl, pwd);
                
            } else if (/feijipan\.com/i.test(targetUrl)) {
                const parser = new FeijipanParser({});
                const shareKey = parser.extractShareKey(targetUrl);
                const parser2 = new FeijipanParser({ 
                    shareKey: shareKey, 
                    sharePassword: pwd 
                });
                const data = await parser2.parse();
                
                result = {
                    code: 200,
                    msg: '解析成功',
                    success: true,
                    shareKey: 'fp:' + shareKey,
                    data: data
                };

            } else if (/ilanzou\.com/i.test(targetUrl)) {
                const parser = new IlanzouParser();
                result = await parser.parse(targetUrl, pwd);
                
                if (result.code === 200) {
                    result.msg = '解析成功';
                }
                
            } else if (/(lanzou[a-z]{0,2}\.com)/i.test(targetUrl)) {
                const parser = new LanzouParser(CONFIG);
                result = await parser.parse(targetUrl, pwd);
                
            } else if (/pan\.quark\.cn/i.test(targetUrl)) {
                isQuark = true;
                quarkParser = new QuarkParser(CONFIG);
                result = await quarkParser.parse(targetUrl, pwd);
                
                if (quarkParser) {
                    quarkCookie = quarkParser.getValidCookie();
                }

                if (!quarkCookie && CONFIG.quark.cookie) {
                    quarkCookie = CONFIG.quark.cookie;
                }
                
            } else if (/uc\.cn/i.test(targetUrl) || /fast\.uc\.cn/i.test(targetUrl) || /drive\.uc\.cn/i.test(targetUrl)) {
                isUC = true;
                ucParser = new UCParser(CONFIG);
                result = await ucParser.parse(targetUrl, pwd);
                
                if (ucParser) {
                    ucCookie = ucParser.getValidCookie();
                }

                if (!ucCookie && CONFIG.uc.cookie) {
                    ucCookie = CONFIG.uc.cookie;
                }
                
            } else if (/yun\.139\.com|caiyun\.139\.com/i.test(targetUrl)) {
                isMcloud = true;
                const mobileCloudParser = new MobileCloudParser(CONFIG);
                result = await mobileCloudParser.parse(targetUrl, pwd);

                if (CONFIG.mcloud && CONFIG.mcloud.authorization) {
                    mcloudAuthorization = CONFIG.mcloud.authorization;
                }

                if (result.code === 400) {
                    const linkId = url.searchParams.get('linkId');
                    if (linkId) {
                        const fullUrl = `https://yun.139.com/shareweb/#/w/i/${linkId}`;
                        result = await mobileCloudParser.parse(fullUrl, pwd);
                    }
                }
                
            } else {
                result = { 
                    code: 400, 
                    msg: '不支持的链接格式', 
                    success: false,
                    data: null 
                };
            }

        } catch (e) {
            result = { 
                code: 500, 
                msg: '解析失败: ' + e.message, 
                success: false,
                data: null 
            };
        }

        return handleResponse(result, type, CONFIG["redirect-url"], CONFIG, isAliyun, isQuark, quarkCookie, isUC, ucCookie, isMcloud, mcloudAuthorization, CONFIG.aliyun ? CONFIG.aliyun.authorization : null);
    }
};

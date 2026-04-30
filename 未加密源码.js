﻿// Cloudflare Workers - 网盘解析脚本
// 支持: 阿里云盘(alipan.com) | 小飞机网盘(feijipan.com) | 蓝奏云优享版(ilanzou.com) | 蓝奏云(lanzou*.com) | 夸克网盘(quark.cn) | UC网盘(drive.uc.cn) | 光鸭云盘(guangyapan.com)



const cookieCache = {
    aliyun: { value: null, timestamp: 0 },
    quark: { value: null, timestamp: 0 },
    uc: { value: null, timestamp: 0 },
    guangya: { value: null, timestamp: 0 }
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
            userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36 Edg/127.0.0.0"
        },
        
        // 光鸭云盘
        guangya: {
            enabled: true,
            loginInfo: "",
            userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
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
        },
        
        // 光鸭云盘
        guangya: {
            enabled: env.GY_ENABLED !== 'false',
            loginInfo: env.GY_Login || defaults.guangya.loginInfo,
            userAgent: env.GY_USER_AGENT || defaults.guangya.userAgent
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

    decryptBlock(input) {
        const state = new Uint8Array(16);
        state.set(input);

        const expandedKey = this.keyExpansion();
        this.addRoundKey(state, expandedKey.slice(160, 176));

        for (let round = 9; round > 0; round--) {
            this.invShiftRows(state);
            this.invSubBytes(state);
            this.addRoundKey(state, expandedKey.slice(round * 16, (round + 1) * 16));
            this.invMixColumns(state);
        }

        this.invShiftRows(state);
        this.invSubBytes(state);
        this.addRoundKey(state, expandedKey.slice(0, 16));

        return state;
    }

    invSubBytes(state) {
        for (let i = 0; i < 16; i++) {
            state[i] = this.invSBox[state[i]];
        }
    }

    invShiftRows(state) {
        const temp = [...state];
        state[1] = temp[13];
        state[5] = temp[1];
        state[9] = temp[5];
        state[13] = temp[9];
        state[2] = temp[10];
        state[6] = temp[14];
        state[10] = temp[2];
        state[14] = temp[6];
        state[3] = temp[7];
        state[7] = temp[11];
        state[11] = temp[15];
        state[15] = temp[3];
    }

    invMixColumns(state) {
        for (let i = 0; i < 4; i++) {
            const s0 = state[i * 4];
            const s1 = state[i * 4 + 1];
            const s2 = state[i * 4 + 2];
            const s3 = state[i * 4 + 3];

            state[i * 4] = this.gmul(0x0e, s0) ^ this.gmul(0x0b, s1) ^ this.gmul(0x0d, s2) ^ this.gmul(0x09, s3);
            state[i * 4 + 1] = this.gmul(0x09, s0) ^ this.gmul(0x0e, s1) ^ this.gmul(0x0b, s2) ^ this.gmul(0x0d, s3);
            state[i * 4 + 2] = this.gmul(0x0d, s0) ^ this.gmul(0x09, s1) ^ this.gmul(0x0e, s2) ^ this.gmul(0x0b, s3);
            state[i * 4 + 3] = this.gmul(0x0b, s0) ^ this.gmul(0x0d, s1) ^ this.gmul(0x09, s2) ^ this.gmul(0x0e, s3);
        }
    }

    pkcs7Unpad(data) {
        const padding = data[data.length - 1];
        return data.slice(0, data.length - padding);
    }

    decryptHex(ciphertext) {
        const data = new Uint8Array(ciphertext.length / 2);
        for (let i = 0; i < ciphertext.length; i += 2) {
            data[i / 2] = parseInt(ciphertext.substr(i, 2), 16);
        }

        let result = new Uint8Array(0);
        for (let i = 0; i < data.length; i += 16) {
            const block = data.slice(i, i + 16);
            const decrypted = this.decryptBlock(block);
            result = new Uint8Array([...result, ...decrypted]);
        }

        const unpadded = this.pkcs7Unpad(result);
        const decoder = new TextDecoder();
        return decoder.decode(unpadded);
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

function generateRefreshToken() {
    const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    const randomStr = (length) => {
        let result = '';
        for (let i = 0; i < length; i++) {
            result += chars[Math.floor(Math.random() * chars.length)];
        }
        return result;
    };
    return 'gy.' + randomStr(24) + '_' + randomStr(32);
}

function getTimestamp() {
    return Date.now();
}

// ============================== 光鸭云盘解析器 ==============================
class GuangyaPanParser {
    constructor(config) {
        this.config = config;
        this.cookieManager = new CookieManager('guangya', config.guangya.loginInfo);
        this.userAgent = config.guangya.userAgent;
        this.apiBase = 'https://api.guangyapan.com';
        this.loginInfo = null;
    }

    async parse(shareUrl, password = '', env = null) {
        try {
            if (!this.config.guangya.enabled) {
                return { code: 503, msg: '光鸭云盘解析已禁用', success: false, data: null };
            }

            let loginInfoStatus = null;
            let source = null;
            
            if (env && (env.jxpan || env.jx)) {
                console.log('[光鸭] 优先尝试从存储默认配置获取登录信息...');
                const storedLoginInfo = await storeGet(env, 'gy_login_default');
                if (storedLoginInfo) {
                    try {
                        const decryptedLoginInfo = typeof storedLoginInfo === 'string' ? decryptFromKV(storedLoginInfo) : storedLoginInfo;
                        if (decryptedLoginInfo && decryptedLoginInfo.access_token) {
                            console.log('[光鸭] 从存储默认配置获取到登录信息');
                            loginInfoStatus = {
                                value: decryptedLoginInfo,
                                isCached: false,
                                expired: false,
                                remainingTime: 24 * 60 * 60 * 1000
                            };
                            source = 'kv_default';
                        }
                    } catch (e) {
                        console.log('[光鸭] 解密KV默认配置失败:', e);
                    }
                }
            }
            
            if (!loginInfoStatus || !loginInfoStatus.value) {
                loginInfoStatus = this.cookieManager.getValidCookie();
                if (loginInfoStatus.value) {
                    source = 'env_var';
                    console.log('[光鸭] 使用环境变量配置');
                }
            }
            
            if (!loginInfoStatus || !loginInfoStatus.value) {
                return { 
                    code: 401, 
                    msg: '光鸭云盘登录信息未配置', 
                    success: false, 
                    data: null 
                };
            }

            if (source === 'env_var' && loginInfoStatus.expired) {
                if (env && (env.jxpan || env.jx)) {
                    console.log('[光鸭] 环境变量已过期，尝试从存储默认配置获取...');
                    const storedLoginInfo = await storeGet(env, 'gy_login_default');
                    if (storedLoginInfo) {
                        try {
                            const decryptedLoginInfo = typeof storedLoginInfo === 'string' ? decryptFromKV(storedLoginInfo) : storedLoginInfo;
                            if (decryptedLoginInfo && decryptedLoginInfo.access_token) {
                                console.log('[光鸭] 从存储默认配置获取到登录信息');
                                loginInfoStatus = {
                                    value: decryptedLoginInfo,
                                    isCached: false,
                                    expired: false,
                                    remainingTime: 24 * 60 * 60 * 1000
                                };
                                source = 'kv_default';
                            }
                        } catch (e) {
                            console.log('[光鸭] 解密KV默认配置失败:', e);
                        }
                    }
                }
                
                if ((source === 'env_var' && loginInfoStatus.expired) || !loginInfoStatus.value) {
                    return {
                        code: 401,
                        msg: '光鸭云盘登录信息已过期（超过24小时），请重新配置',
                        success: false,
                        data: {
                            expired: true,
                            hint: '登录信息有效期为24小时，从配置完成时开始计时'
                        }
                    };
                }
            }

            try {
                if (typeof loginInfoStatus.value === 'string') {
                    this.loginInfo = JSON.parse(loginInfoStatus.value);
                } else {
                    this.loginInfo = loginInfoStatus.value;
                }
            } catch (e) {
                return { code: 400, msg: '光鸭云盘登录信息格式错误', success: false, data: null };
            }

            console.log('[光鸭] 登录信息来源:', source);
            console.log('[光鸭] 登录信息:', JSON.stringify(this.loginInfo));
            console.log('[光鸭] access_token长度:', this.loginInfo.access_token ? this.loginInfo.access_token.length : 'null');

            if (!this.loginInfo.access_token) {
                return { code: 400, msg: '光鸭云盘登录信息缺少access_token', success: false, data: null };
            }

            this.baseHeaders = {
                'User-Agent': this.userAgent,
                'Accept': 'application/json, text/plain, */*',
                'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
                'Content-Type': 'application/json;charset=UTF-8',
                'Origin': 'https://www.guangyapan.com',
                'Referer': 'https://www.guangyapan.com/',
                'Authorization': `Bearer ${this.loginInfo.access_token}`
            };

            console.log('[光鸭] 构建的请求头:', JSON.stringify(this.baseHeaders));

            const { shareId, extractedCode } = this.extractShareInfo(shareUrl);
            if (!shareId) {
                return { code: 400, msg: '无法解析光鸭云盘分享链接', success: false, data: null };
            }

            const code = password || extractedCode;

            const accessToken = await this.getShareAccessToken(shareId, code);
            if (!accessToken) {
                return { 
                    code: 401, 
                    msg: '获取分享访问令牌失败' + (code ? '，提取码可能错误' : '，请检查登录信息是否有效'), 
                    success: false, 
                    data: null 
                };
            }

            const files = await this.listShareFiles(accessToken);
            if (!files || files.length === 0) {
                return { code: 404, msg: '分享中没有文件，可能是登录信息失效或分享链接失效', success: false, data: null };
            }

            const results = [];
            for (const file of files) {
                const fileName = file.fileName || '未知文件';
                const fileId = file.fileId;
                const fileSize = file.fileSize || 0;
                
                let downloadUrl = null;
                
                console.log('[光鸭] 直接使用登录信息获取下载链接，文件ID:', fileId);
                try {
                    downloadUrl = await this.getDownloadUrl(fileId);
                    console.log('[光鸭] 使用登录token获取下载链接结果:', downloadUrl ? '成功' : '失败');
                } catch (e) {
                    console.error('[光鸭] 使用登录token获取下载链接失败:', e);
                }
                
                if (downloadUrl) {
                    results.push({
                        file_id: fileId,
                        file_name: fileName,
                        file_size: formatFileSize(fileSize),
                        download_url: downloadUrl
                    });
                }
            }

            if (results.length === 0) {
                return { code: 502, msg: '获取下载链接失败，所有文件处理失败，可能是登录数据失效，请重新配置', success: false, data: null };
            }

            const isSingleFile = results.length === 1;
            const responseData = isSingleFile ? results[0] : {
                file_count: results.length,
                files: results
            };

            const remainingTime = loginInfoStatus.remainingTime;
            
            return {
                code: 200,
                msg: '解析成功',
                success: true,
                shareKey: 'gy:' + shareId,
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
            /https?:\/\/(?:www\.)?guangyapan\.com\/s\/([^?]+)(?:\?.*code=([^&]+))?/i,
            /\/s\/([^?]+)(?:\?.*code=([^&]+))?/i,
        ];

        for (const pattern of patterns) {
            const match = shareUrl.match(pattern);
            if (match) {
                return {
                    shareId: match[1],
                    extractedCode: match[2] || null
                };
            }
        }

        return { shareId: null, extractedCode: null };
    }

    async getShareAccessToken(shareId, code = '') {
        const url = `${this.apiBase}/nd.bizuserres.s/v1/get_share_access_token`;
        const data = { shareId: shareId, code: code };

        console.log('[光鸭] 获取分享访问令牌，请求数据:', JSON.stringify(data));

        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'accept': 'application/json, text/plain, */*',
                    'content-type': 'application/json',
                    'origin': 'https://www.guangyapan.com',
                    'referer': 'https://www.guangyapan.com/',
                    'user-agent': this.userAgent
                },
                body: JSON.stringify(data)
            });

            console.log('[光鸭] 响应状态:', response.status);
            const responseText = await response.text();
            console.log('[光鸭] 响应内容:', responseText);

            if (response.status === 200) {
                try {
                    const result = JSON.parse(responseText);
                    if (result.msg === 'success' && result.data) {
                        return result.data.accessToken;
                    }
                } catch (parseError) {
                    console.error('[光鸭] JSON解析失败:', parseError);
                }
            }
        } catch (e) {
            console.error('获取分享访问令牌失败:', e);
        }

        return null;
    }

    async listShareFiles(accessToken) {
        const url = `${this.apiBase}/nd.bizuserres.s/v1/get_share_page_files_list`;
        const data = {
            accessToken: accessToken,
            parentId: '',
            page: 1,
            pageSize: 50,
            orderBy: 0,
            sortType: 0
        };

        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'accept': 'application/json, text/plain, */*',
                    'content-type': 'application/json',
                    'origin': 'https://www.guangyapan.com',
                    'referer': 'https://www.guangyapan.com/',
                    'user-agent': this.userAgent
                },
                body: JSON.stringify(data)
            });

            console.log('[光鸭] 获取文件列表，响应状态:', response.status);
            const responseText = await response.text();
            console.log('[光鸭] 获取文件列表，响应内容:', responseText);

            if (response.status === 200) {
                try {
                    const result = JSON.parse(responseText);
                    if (result.msg === 'success' && result.data && result.data.list) {
                        return result.data.list;
                    }
                } catch (parseError) {
                    console.error('[光鸭] JSON解析失败:', parseError);
                }
            }
        } catch (e) {
            console.error('获取分享文件列表失败:', e);
        }

        return [];
    }

    async getShareDownloadUrl(fileId, accessToken) {
        const url = `${this.apiBase}/nd.bizuserres.s/v1/get_share_download_url`;
        const data = { fileId: fileId, accessToken: accessToken };

        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'accept': 'application/json, text/plain, */*',
                    'content-type': 'application/json',
                    'origin': 'https://www.guangyapan.com',
                    'referer': 'https://www.guangyapan.com/',
                    'user-agent': this.userAgent
                },
                body: JSON.stringify(data)
            });

            console.log('[光鸭] 获取下载链接，响应状态:', response.status);
            const responseText = await response.text();
            console.log('[光鸭] 获取下载链接，响应内容:', responseText);

            if (response.status === 200) {
                try {
                    const result = JSON.parse(responseText);
                    if (result.msg === 'success' && result.data) {
                        return result.data.url;
                    }
                } catch (parseError) {
                    console.error('[光鸭] JSON解析失败:', parseError);
                }
            }
        } catch (e) {
            console.error('获取分享文件下载链接失败:', e);
        }

        return null;
    }

    async restoreShareFile(shareAccessToken, fileId) {
        const url = `${this.apiBase}/nd.bizuserres.s/v1/restore_share`;
        const data = {
            accessToken: shareAccessToken,
            fileIds: [fileId],
            parentId: ''
        };

        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: this.baseHeaders,
                body: JSON.stringify(data)
            });

            console.log('[光鸭] 转存文件，响应状态:', response.status);
            const responseText = await response.text();
            console.log('[光鸭] 转存文件，响应内容:', responseText);

            if (response.status === 200) {
                try {
                    const result = JSON.parse(responseText);
                    if (result.msg === 'success' && result.data) {
                        return result.data.fileId;
                    }
                } catch (parseError) {
                    console.error('[光鸭] JSON解析失败:', parseError);
                }
            }
        } catch (e) {
            console.error('转存文件失败:', e);
        }

        return null;
    }

    async getDownloadUrl(fileId) {
        const url = `${this.apiBase}/nd.bizuserres.s/v1/get_res_download_url`;
        const data = { fileId: fileId };

        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: this.baseHeaders,
                body: JSON.stringify(data)
            });

            console.log('[光鸭] 获取转存后下载链接，响应状态:', response.status);
            const responseText = await response.text();
            console.log('[光鸭] 获取转存后下载链接，响应内容:', responseText);

            if (response.status === 200) {
                try {
                    const result = JSON.parse(responseText);
                    if (result.msg === 'success' && result.data) {
                        return result.data.downloadUrl || result.data.signedURL;
                    }
                } catch (parseError) {
                    console.error('[光鸭] JSON解析失败:', parseError);
                }
            }
        } catch (e) {
            console.error('获取下载链接失败:', e);
        }

        return null;
    }
}

// ============================== KV数据加密工具 ==============================
const KV_ENCRYPTION_KEY = 'LsPro-JxPan';
const kvEncryptor = new AES128ECB(KV_ENCRYPTION_KEY);

function encryptForKV(data) {
    try {
        const jsonStr = JSON.stringify(data);
        const encrypted = kvEncryptor.encryptHex(jsonStr);
        return encrypted;
    } catch (e) {
        console.log('[!] KV加密失败:', e);
        return null;
    }
}

function decryptFromKV(encryptedData) {
    try {
        const decrypted = kvEncryptor.decryptHex(encryptedData);
        const data = JSON.parse(decrypted);
        return data;
    } catch (e) {
        console.log('[!] KV解密失败:', e);
        return null;
    }
}

// ============================== D1数据库层 ==============================
async function d1Init(db) {
    try {
        await db.prepare(`
            CREATE TABLE IF NOT EXISTS kv_store (
                key TEXT PRIMARY KEY,
                value TEXT NOT NULL,
                expires_at INTEGER DEFAULT 0,
                created_at INTEGER DEFAULT (strftime('%s', 'now'))
            )
        `).run();
        console.log('[D1] 表创建/检查完成');
    } catch (e) {
        console.log('[D1] 创建表失败:', e.message, e.stack);
    }
    try {
        await db.prepare(`CREATE INDEX IF NOT EXISTS idx_kv_expires ON kv_store(expires_at)`).run();
        console.log('[D1] 索引创建/检查完成');
    } catch (e) {
        console.log('[D1] 创建索引失败(可能已存在):', e.message);
    }
}

async function d1Put(db, key, value, options) {
    try {
        let expiresAt = 0;
        if (options && options.expirationTtl) {
            expiresAt = Math.floor(Date.now() / 1000) + options.expirationTtl;
        }
        const encryptedValue = typeof value === 'string' && (value.startsWith('{') || value.startsWith('['))
            ? encryptForKV(JSON.parse(value))
            : (typeof value === 'object' ? encryptForKV(value) : value);
        const result = await db.prepare('INSERT OR REPLACE INTO kv_store (key, value, expires_at) VALUES (?, ?, ?)')
            .bind(key, encryptedValue, expiresAt).run();
        if (result && result.success !== false) {
            console.log('[D1] PUT成功:', key, 'expires_at:', expiresAt);
            return true;
        }
        console.log('[D1] PUT结果异常:', key, JSON.stringify(result));
        return false;
    } catch (e) {
        console.log('[D1] PUT失败:', key, e.message, e.stack);
        return false;
    }
}

async function d1Get(db, key) {
    try {
        const now = Math.floor(Date.now() / 1000);
        const result = await db.prepare('SELECT value, expires_at FROM kv_store WHERE key = ?')
            .bind(key).first();
        if (!result) return null;
        if (result.expires_at > 0 && result.expires_at < now) {
            await db.prepare('DELETE FROM kv_store WHERE key = ?').bind(key).run();
            return null;
        }
        const rawValue = result.value;
        if (!rawValue) return null;
        return rawValue;
    } catch (e) {
        console.log('[D1] GET失败:', key, e.message);
        return null;
    }
}

async function d1Delete(db, key) {
    try {
        await db.prepare('DELETE FROM kv_store WHERE key = ?').bind(key).run();
        return true;
    } catch (e) {
        console.log('[D1] DELETE失败:', key, e.message);
        return false;
    }
}

async function d1Cleanup(db) {
    try {
        const now = Math.floor(Date.now() / 1000);
        await db.prepare('DELETE FROM kv_store WHERE expires_at > 0 AND expires_at < ?')
            .bind(now).run();
    } catch (e) {
        console.log('[D1] 清理失败:', e.message);
    }
}

async function d1PutRaw(db, key, value, options) {
    try {
        let expiresAt = 0;
        if (options && options.expirationTtl) {
            expiresAt = Math.floor(Date.now() / 1000) + options.expirationTtl;
        }
        const result = await db.prepare('INSERT OR REPLACE INTO kv_store (key, value, expires_at) VALUES (?, ?, ?)')
            .bind(key, value, expiresAt).run();
        if (result && result.success !== false) {
            console.log('[D1] PUT_RAW成功:', key, 'value长度:', String(value).length, 'expires_at:', expiresAt);
            return true;
        }
        console.log('[D1] PUT_RAW结果异常:', key, JSON.stringify(result));
        return false;
    } catch (e) {
        console.log('[D1] PUT_RAW失败:', key, e.message, e.stack);
        return false;
    }
}

async function d1GetRaw(db, key) {
    try {
        const now = Math.floor(Date.now() / 1000);
        const result = await db.prepare('SELECT value, expires_at FROM kv_store WHERE key = ?')
            .bind(key).first();
        if (!result) return null;
        if (result.expires_at > 0 && result.expires_at < now) {
            await db.prepare('DELETE FROM kv_store WHERE key = ?').bind(key).run();
            return null;
        }
        return result.value;
    } catch (e) {
        console.log('[D1] GET_RAW失败:', key, e.message);
        return null;
    }
}

async function d1ListByPrefix(db, prefix) {
    try {
        const results = await db.prepare("SELECT key, value FROM kv_store WHERE key LIKE ?")
            .bind(prefix + '%').all();
        return results.results || [];
    } catch (e) {
        console.log('[D1] LIST失败:', prefix, e.message);
        return [];
    }
}

// ============================== 存储兼容层(优先D1,回退KV) ==============================
async function storePut(env, key, value, options) {
    if (env.jxpan) {
        if (typeof value === 'object') {
            const result = await d1Put(env.jxpan, key, value, options);
            console.log('[存储] D1 PUT结果:', key, result ? '成功' : '失败');
            return result;
        } else {
            const result = await d1PutRaw(env.jxpan, key, value, options);
            console.log('[存储] D1 PUT_RAW结果:', key, result ? '成功' : '失败');
            return result;
        }
    }
    if (env.jx) {
        return await env.jx.put(key, value, options);
    }
    console.log('[存储] 无可用存储:', key);
    return false;
}

async function storeGet(env, key) {
    if (env.jxpan) {
        return await d1Get(env.jxpan, key);
    }
    if (env.jx) {
        const val = await env.jx.get(key);
        return val;
    }
    return null;
}

async function storeDelete(env, key) {
    if (env.jxpan) {
        return await d1Delete(env.jxpan, key);
    }
    if (env.jx) {
        return await env.jx.delete(key);
    }
    return false;
}

async function storeListByPrefix(env, prefix) {
    if (env.jxpan) {
        return await d1ListByPrefix(env.jxpan, prefix);
    }
    if (env.jx) {
        const list = await env.jx.list({ prefix });
        return list.keys || [];
    }
    return [];
}

// ==================== 移动云盘加密工具 ====================

function md5(input) {
    const bytes = typeof input === 'string' ? new TextEncoder().encode(input) : input;
    let len = bytes.length;
    const words = [];
    for (let i = 0; i < len * 8; i += 8) words[i >> 5] |= bytes[i >> 3] << (i % 32);
    words[len >> 2] |= 0x80 << (len % 4 << 3);
    words[((len + 8 >> 6) + 1) * 16 - 2] = len * 8;
    let a = 1732584193, b = -271733879, c = -1732584194, d = 271733878;
    for (let k = 0; k < words.length; k += 16) {
        const aa = a, bb = b, cc = c, dd = d;
        for (let i = 0; i < 64; i++) {
            let f, g;
            if (i < 16) { f = (b & c) | (~b & d); g = i; }
            else if (i < 32) { f = (d & b) | (~d & c); g = (5 * i + 1) % 16; }
            else if (i < 48) { f = b ^ c ^ d; g = (3 * i + 5) % 16; }
            else { f = c ^ (b | ~d); g = (7 * i) % 16; }
            f = f + a + [0xd76aa478,0xe8c7b756,0x242070db,0xc1bdceee,0xf57c0faf,0x4787c62a,0xa8304613,0xfd469501,0x698098d8,0x8b44f7af,0xffff5bb1,0x895cd7be,0x6b901122,0xfd987193,0xa679438e,0x49b40821,0xf61e2562,0xc040b340,0x265e5a51,0xe9b6c7aa,0xd62f105d,0x02441453,0xd8a1e681,0xe7d3fbc8,0x21e1cde6,0xc33707d6,0xf4d50d87,0x455a14ed,0xa9e3e905,0xfcefa3f8,0x676f02d9,0x8d2a4c8a,0xfffa3942,0x8771f681,0x6d9d6122,0xfde5380c,0xa4beea44,0x4bdecfa9,0xf6bb4b60,0xbebfbc70,0x289b7ec6,0xeaa127fa,0xd4ef3085,0x04881d05,0xd9d4d039,0xe6db99e5,0x1fa27cf8,0xc4ac5665,0xf4292244,0x432aff97,0xab9423a7,0xfc93a039,0x655b59c3,0x8f0ccc92,0xffeff47d,0x85845dd1,0x6fa87e4f,0xfe2ce6e0,0xa3014314,0x4e0811a1,0xf7537e82,0xbd3af235,0x2ad7d2bb,0xeb86d391][i] + words[k + g];
            a = d; d = c; c = b;
            const s = [7,12,17,22,7,12,17,22,7,12,17,22,7,12,17,22,5,9,14,20,5,9,14,20,5,9,14,20,5,9,14,20,4,11,16,23,4,11,16,23,4,11,16,23,4,11,16,23,6,10,15,21,6,10,15,21,6,10,15,21,6,10,15,21][i];
            b = b + ((f << s) | (f >>> (32 - s)));
            b = (b + aa) | 0;
        }
        a = (a + aa) | 0; b = (b + bb) | 0; c = (c + cc) | 0; d = (d + dd) | 0;
    }
    const hex = (n) => ((n >>> 0).toString(16).padStart(8, '0'));
    return hex(a) + hex(b) + hex(c) + hex(d);
}

function parseRsaPublicKey(derBase64) {
    const der = Uint8Array.from(atob(derBase64), c => c.charCodeAt(0));
    let offset = 0;
    function readTag() { return der[offset++]; }
    function readLen() {
        let len = der[offset++];
        if (len & 0x80) {
            const numBytes = len & 0x7f;
            len = 0;
            for (let i = 0; i < numBytes; i++) len = (len << 8) | der[offset++];
        }
        return len;
    }
    function readInteger() {
        readTag(); readLen();
        const start = offset;
        while (offset < der.length && der[offset] === 0) offset++;
        const bytes = der.slice(offset, start + (der[start - 1] || 0) + offset - start);
        offset = start + (der[start - 1] || 0);
        let hex = '';
        for (let i = offset - bytes.length; i < offset; i++) hex += der[i].toString(16).padStart(2, '0');
        return BigInt('0x' + hex);
    }
    readTag(); readLen();
    readTag(); readLen();
    readTag(); readLen();
    readTag(); readLen();
    readTag(); readLen();
    readTag(); readLen();
    const n = readInteger();
    const e = readInteger();
    return { n, e };
}

function rsaPkcs1v15Encrypt(n, e, message) {
    const keySize = (n.toString(16).length + 1) >> 1;
    const msgBytes = typeof message === 'string' ? new TextEncoder().encode(message) : message;
    const msgLen = msgBytes.length;
    const padLen = keySize - msgLen - 3;
    if (padLen < 8) throw new Error('Message too long for RSA key');
    const padded = new Uint8Array(keySize);
    padded[0] = 0x00; padded[1] = 0x02;
    const randBytes = new Uint8Array(padLen);
    crypto.getRandomValues(randBytes);
    for (let i = 0; i < padLen; i++) padded[2 + i] = randBytes[i] === 0 ? 1 : randBytes[i];
    padded[2 + padLen] = 0x00;
    padded.set(msgBytes, 3 + padLen);
    let m = 0n;
    for (const b of padded) m = (m << 8n) | BigInt(b);
    let result = 1n;
    let base = m % n;
    let exp = e;
    while (exp > 0n) {
        if (exp & 1n) result = (result * base) % n;
        exp >>= 1n;
        base = (base * base) % n;
    }
    const hex = result.toString(16).padStart(keySize * 2, '0');
    return btoa(hex.match(/.{2}/g).map(h => String.fromCharCode(parseInt(h, 16))).join(''));
}

async function aesEcbEncrypt(keyStr, plaintext) {
    const keyBytes = typeof keyStr === 'string' ? new TextEncoder().encode(keyStr) : keyStr;
    const plainBytes = typeof plaintext === 'string' ? new TextEncoder().encode(plaintext) : plaintext;
    const blockSize = 16;
    const padLen = blockSize - (plainBytes.length % blockSize);
    const padded = new Uint8Array(plainBytes.length + padLen);
    padded.set(plainBytes);
    padded.fill(padLen, plainBytes.length);
    const cryptoKey = await crypto.subtle.importKey('raw', keyBytes, { name: 'AES-CBC' }, false, ['encrypt']);
    const iv = new Uint8Array(16);
    const result = new Uint8Array(padded.length);
    for (let i = 0; i < padded.length; i += blockSize) {
        const block = padded.slice(i, i + blockSize);
        const encrypted = await crypto.subtle.encrypt({ name: 'AES-CBC', iv: iv }, cryptoKey, block);
        result.set(new Uint8Array(encrypted, 0, blockSize), i);
    }
    return btoa(String.fromCharCode.apply(null, result));
}

function stringToBase64(str) {
    const bytes = new TextEncoder().encode(str);
    return btoa(String.fromCharCode(...bytes));
}

function jsonCompact(obj) {
    return JSON.stringify(obj).replace(/\s+/g, '');
}

function pythonQuoteExact(str) {
    if (!str) return '';
    const result = [];
    for (let i = 0; i < str.length; i++) {
        const char = str[i];
        const code = str.charCodeAt(i);
        
        if ((code >= 48 && code <= 57) ||   
            (code >= 65 && code <= 90) ||   
            (code >= 97 && code <= 122)) {  
            result.push(char);
        } else {
            const bytes = new TextEncoder().encode(char);
            for (let j = 0; j < bytes.length; j++) {
                const hex = bytes[j].toString(16).toUpperCase();
                result.push('%' + (hex.length === 1 ? '0' + hex : hex));
            }
        }
    }
    return result.join('');
}

function generateMcloudSign(bodyDict, deviceId, version) {
    const now = new Date();
    const pad2 = n => String(n).padStart(2, '0');
    const timestamp = `${now.getFullYear()}-${pad2(now.getMonth() + 1)}-${pad2(now.getDate())} ${pad2(now.getHours())}:${pad2(now.getMinutes())}:${pad2(now.getSeconds())}`;
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let nonce = '';
    const randArr = new Uint8Array(16);
    crypto.getRandomValues(randArr);
    for (let i = 0; i < 16; i++) nonce += chars[randArr[i] % chars.length];
    let s = '';
    if (bodyDict) {
        s = JSON.stringify(bodyDict, null, 0);
        s = pythonQuoteExact(s);
        s = s.split('').sort((a, b) => a.charCodeAt(0) - b.charCodeAt(0)).join('');
    }
    const encoder = new TextEncoder();
    const b64 = btoa(String.fromCharCode(...encoder.encode(s)));
    const r = md5(b64);
    const c = md5(timestamp + ':' + nonce);
    const sign = md5(r + c).toUpperCase();
    console.log('[移动云盘] 签名调试: ts=' + timestamp + ', nonce=' + nonce + ', sign=' + sign + ', s=' + s.substring(0, 50) + '...');
    return { signHeader: `${timestamp},${nonce},${sign}`, timestamp, nonce };
}

// 生成缓存键
function generateCacheKey(url, pwd) {
    try {
        const combined = `${url}|||${pwd || ''}`;
        const encoder = new TextEncoder();
        const data = encoder.encode(combined);
        const base64 = btoa(String.fromCharCode.apply(null, data));
        return `parse_${base64}`;
    } catch (e) {
        console.log('[!] 生成缓存键失败:', e);
        return `parse_${Date.now()}`;
    }
}

// 从KV获取缓存
async function getCacheFromKV(env, url, pwd) {
    if (!env || !(env.jxpan || env.jx)) {
        return null;
    }
    
    try {
        const cacheKey = generateCacheKey(url, pwd || '');
        const cachedData = await storeGet(env, cacheKey);
        
        if (cachedData) {
            console.log('[*] 从缓存中获取到解析结果, key:', cacheKey);
            try {
                const data = typeof cachedData === 'string' ? decryptFromKV(cachedData) : cachedData;
                if (data) {
                    data.from_cache = true;
                    return data;
                } else {
                    console.log('[!] 解密缓存数据失败');
                    return null;
                }
            } catch (parseError) {
                console.log('[!] 解析缓存数据失败:', parseError);
                return null;
            }
        } else {
            console.log('[*] KV缓存未命中, key:', cacheKey);
        }
    } catch (e) {
        console.log('[!] 读取KV缓存失败:', e);
    }
    
    return null;
}

// 生成随机token
function generateAdminToken() {
    const array = new Uint8Array(32);
    crypto.getRandomValues(array);
    return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
}

// 存储管理员token到KV
async function saveAdminToken(env, token) {
    if (!env || !(env.jxpan || env.jx)) return;
    try {
        const tokenData = {
            token: token,
            createdAt: Date.now(),
            expiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000 // 7天过期
        };
        await storePut(env, 'admin_token', JSON.stringify(tokenData), { expirationTtl: 7 * 24 * 3600 });
        console.log('[后台] Token已存储');
    } catch (e) {
        console.log('[!] 存储Token失败:', e);
    }
}

// 验证管理员token
async function verifyAdminToken(env, token) {
    if (!env || !(env.jxpan || env.jx) || !token) return false;
    try {
        const tokenDataStr = await storeGet(env, 'admin_token');
        if (!tokenDataStr) return false;
        
        const tokenData = JSON.parse(tokenDataStr);
        if (tokenData.token === token && tokenData.expiresAt > Date.now()) {
            return true;
        }
        return false;
    } catch (e) {
        console.log('[!] 验证Token失败:', e);
        return false;
    }
}

// 处理后台面板请求
async function handleAdminRequest(request, env) {
    console.log('[后台] handleAdminRequest函数被调用');
    const url = new URL(request.url);
    const action = url.searchParams.get('action') || '';
    const method = request.method;
    
    console.log('[后台] action:', action, 'method:', method);
    
    // 检查是否有admin和pass环境变量
    const adminUser = env.admin;
    const adminPass = env.pass;
    
    console.log('[后台] adminUser:', adminUser ? '已设置' : '未设置', 'adminPass:', adminPass ? '已设置' : '未设置');
    
    // 处理登录请求
    if (action === 'login') {
        console.log('[后台] 处理登录请求');
        if (method === 'POST') {
            try {
                const formData = await request.formData();
                const username = formData.get('username');
                const password = formData.get('password');
                
                console.log('[后台] 登录尝试 - username:', username);
                
                if (!adminUser || !adminPass) {
                    console.log('[后台] 环境变量未配置');
                    return new Response(admin(false, '后台面板未配置，请在环境变量中设置admin和pass'), {
                        headers: { 'Content-Type': 'text/html; charset=utf-8' }
                    });
                }
                
                if (username === adminUser && password === adminPass) {
                    // 登录成功，生成token
                    const token = generateAdminToken();
                    await saveAdminToken(env, token);
                    
                    console.log('[后台] 登录成功');
                    return new Response(admin(true), {
                        headers: {
                            'Content-Type': 'text/html; charset=utf-8',
                            'Set-Cookie': `admin_token=${token}; Path=/; Max-Age=${7 * 24 * 3600}; HttpOnly; SameSite=Lax`
                        }
                    });
                } else {
                    // 登录失败
                    console.log('[后台] 登录失败 - 用户名或密码错误');
                    return new Response(admin(false, '用户名或密码错误'), {
                        headers: { 'Content-Type': 'text/html; charset=utf-8' }
                    });
                }
            } catch (e) {
                console.log('[后台] 登录异常:', e);
                return new Response(admin(false, '登录失败: ' + e.message), {
                    headers: { 'Content-Type': 'text/html; charset=utf-8' }
                });
            }
        } else {
            // GET请求，返回登录页面
            console.log('[后台] 返回登录页面');
            return new Response(admin(false), {
                headers: { 'Content-Type': 'text/html; charset=utf-8' }
            });
        }
    }
    
    // 处理登出请求
    if (action === 'logout') {
        console.log('[后台] 处理登出请求');
        return new Response(admin(false, '已退出登录'), {
            headers: {
                'Content-Type': 'text/html; charset=utf-8',
                'Set-Cookie': 'admin_token=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax'
            }
        });
    }
    
    // 处理其他后台请求（需要登录）
    const cookies = request.headers.get('Cookie') || '';
    const tokenMatch = cookies.match(/admin_token=([^;]+)/);
    const token = tokenMatch ? tokenMatch[1] : null;
    
    // 验证token
    const isLoggedIn = await verifyAdminToken(env, token);
    
    console.log('[后台] cookies:', cookies, 'isLoggedIn:', isLoggedIn);
    
    if (!isLoggedIn) {
        // 未登录，返回登录页面
        console.log('[后台] 未登录，返回登录页面');
        return new Response(admin(false), {
            headers: { 'Content-Type': 'text/html; charset=utf-8' }
        });
    }
    
    // 已登录，返回后台面板
    console.log('[后台] 已登录，返回后台面板');
    return new Response(admin(true), {
        headers: { 'Content-Type': 'text/html; charset=utf-8' }
    });
}

// 存储缓存到KV
async function setCacheToKV(env, url, pwd, data, expirationTtl) {
    if (!env || !(env.jxpan || env.jx)) {
        return;
    }
    
    try {
        const cacheKey = generateCacheKey(url, pwd || '');
        
        const dataWithUrl = {
            ...data,
            url: url,
            pwd: pwd || ''
        };
        
        const encryptedData = encryptForKV(dataWithUrl);
        if (encryptedData) {
            await storePut(env, cacheKey, encryptedData, { expirationTtl: expirationTtl });
            console.log('[*] 解析结果已加密存储到KV缓存:', cacheKey);
        } else {
            console.log('[!] 加密解析结果失败');
        }
    } catch (e) {
        console.log('[!] 存储KV缓存失败:', e);
    }
}

// 获取统计数据
async function getStatsFromKV(env) {
    if (!env || !(env.jxpan || env.jx)) {
        return { total: 0, success: 0, failed: 0, cached: 0 };
    }
    
    try {
        const encryptedStats = await storeGet(env, 'jx_total');
        if (encryptedStats) {
            try {
                const stats = decryptFromKV(encryptedStats);
                if (stats) {
                    return stats;
                } else {
                    console.log('[!] 解密统计数据失败');
                }
            } catch (parseError) {
                console.log('[!] 解析统计数据失败:', parseError);
            }
        } else {
            // KV中没有数据，初始化默认值
            const defaultStats = { total: 0, success: 0, failed: 0, cached: 0 };
            // 尝试存储默认值，但不等待结果，避免阻塞
            updateStatsInKV(env, defaultStats).catch(e => {
                console.log('[!] 初始化统计数据失败:', e);
            });
            return defaultStats;
        }
    } catch (e) {
        console.log('[!] 获取KV统计数据失败:', e);
    }
    
    return { total: 0, success: 0, failed: 0, cached: 0 };
}

// 更新统计数据
async function updateStatsInKV(env, statsObj) {
    if (!env || !(env.jxpan || env.jx)) {
        return;
    }
    
    try {
        const encryptedStats = encryptForKV(statsObj);
        if (encryptedStats) {
            await storePut(env, 'jx_total', encryptedStats);
            console.log('[*] 统计数据已加密更新到KV');
        } else {
            console.log('[!] 加密统计数据失败');
        }
    } catch (e) {
        console.log('[!] 更新KV统计数据失败:', e);
    }
}

// 保存解析记录
async function saveParseRecord(env, url, pwd, result) {
    if (!env || !(env.jxpan || env.jx)) {
        console.log('[!] 保存解析记录失败: 缺少env或jx KV');
        return;
    }
    
    try {
        const record = {
            id: Date.now(),
            url: url,
            pwd: pwd || '',
            success: result.success,
            code: result.code,
            msg: result.msg,
            data: result.data,
            timestamp: new Date().toISOString()
        };
        
        console.log('[*] 准备保存解析记录:', {
            id: record.id,
            url: record.url,
            pwd: record.pwd,
            success: record.success,
            code: record.code
        });
        
        const encryptedRecord = encryptForKV(record);
        if (encryptedRecord) {
            const recordKey = `parse_record_${record.id}`;
            await storePut(env, recordKey, encryptedRecord, { expirationTtl: 7 * 24 * 3600 });
            console.log('[*] 解析记录已保存:', recordKey);
        } else {
            console.log('[!] 保存解析记录失败: 加密失败');
        }
    } catch (e) {
        console.log('[!] 保存解析记录失败:', e);
    }
}

// 获取解析记录列表
async function getParseRecords(env) {
    if (!env || !(env.jxpan || env.jx)) {
        console.log('[!] 获取解析记录失败: 缺少env或jx KV');
        return { success: [], failed: [] };
    }
    
    try {
        console.log('[*] 开始获取解析记录...');
        const list = await storeListByPrefix(env, 'parse_record_');
        
        const records = { success: [], failed: [] };
        
        if (list && Array.isArray(list) && list.length > 0) {
            for (const item of list) {
                try {
                    const keyName = item.key || item.name;
                    const rawValue = item.value;
                    let record = null;
                    if (rawValue) {
                        record = typeof rawValue === 'string' ? decryptFromKV(rawValue) : rawValue;
                    } else {
                        const storedVal = await storeGet(env, keyName);
                        record = typeof storedVal === 'string' ? decryptFromKV(storedVal) : storedVal;
                    }
                    
                    if (record) {
                        if (record.success) {
                            records.success.push(record);
                        } else {
                            records.failed.push(record);
                        }
                    }
                } catch (e) {
                    console.log('[!] 处理解析记录失败:', e);
                }
            }
        }
        
        // 按时间倒序排列
        records.success.sort((a, b) => b.id - a.id);
        records.failed.sort((a, b) => b.id - a.id);
        
        console.log('[*] 获取解析记录完成:', {
            success: records.success.length,
            failed: records.failed.length
        });
        
        return records;
    } catch (e) {
        console.log('[!] 获取解析记录失败:', e);
        return { success: [], failed: [] };
    }
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
        
        console.log('[*] ajaxm.php响应:', ajaxResponse.substring(0, 500) + '...');
        
        let json;
        try {
            json = JSON.parse(ajaxResponse);
            console.log('[*] JSON解析成功:', JSON.stringify(json));
        } catch (e) {
            console.log('[!] JSON解析失败:', e);
            // 尝试从响应中提取关键信息
            try {
                // 尝试提取dom和url字段
                const domMatch = ajaxResponse.match(/"dom":"([^"]+)"/);
                const urlMatch = ajaxResponse.match(/"url":"([^"]+)"/);
                const infMatch = ajaxResponse.match(/"inf":"([^"]+)"/);
                
                if (domMatch && urlMatch) {
                    console.log('[*] 从响应中提取到dom和url');
                    json = {
                        zt: 1,
                        dom: domMatch[1],
                        url: urlMatch[1],
                        inf: infMatch ? infMatch[1] : info.name
                    };
                } else {
                    json = { zt: 0 };
                }
            } catch (extractError) {
                console.log('[!] 提取响应信息失败:', extractError);
                json = { zt: 0 };
            }
        }
        
        if (json.zt === 1) {
            if (json.inf) info.name = json.inf;
            
            const shareKey = id.match(/([a-zA-Z0-9]+)$/)?.[1] || id;
            const globalShareKey = "lz:" + shareKey;
            
            info.url = json.dom + '/file/' + json.url;
            console.log('[*] 构建下载链接:', info.url);
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
        
        console.log('[*] 开始获取直链，URL:', info.url);
        
        // 尝试使用桌面UA请求
        let requestData = await this.request(info.url, 'GET', null, headers, 'all');
        let url = requestData.info.redirect_url;
        
        console.log('[*] 第一次请求状态:', requestData.info.status);
        console.log('[*] 第一次请求重定向URL:', url);
        
        // 处理acw_sc__v2参数
        if (requestData.data) {
            const argMatch = requestData.data.match(/arg1='(.+?)'/);
            if (argMatch) {
                console.log('[*] 找到arg1参数，需要计算acw_sc__v2');
                headers.Cookie += `; acw_sc__v2=${acwScV2Simple(argMatch[1])}`;
                const newRequest = await this.request(info.url, 'GET', null, headers, 'info');
                url = newRequest.redirect_url;
                console.log('[*] 第二次请求重定向URL:', url);
            }
        }
        
        // 如果没有获取到重定向URL，尝试使用移动UA
        if (!url) {
            console.log('[*] 未获取到重定向URL，尝试使用移动UA');
            headers['User-Agent'] = this.mobileUA;
            const mobileRequest = await this.request(info.url, 'GET', null, headers, 'all');
            
            console.log('[*] 移动UA请求状态:', mobileRequest.info.status);
            console.log('[*] 移动UA重定向URL:', mobileRequest.info.redirect_url);
            
            if (mobileRequest.info.redirect_url) {
                url = mobileRequest.info.redirect_url;
                console.log('[*] 使用移动UA重定向URL:', url);
            } else if (mobileRequest.data) {
                // 优先匹配下载相关的链接
                const downloadMatch = mobileRequest.data.match(/<a\s+[^>]*href="([^"]*download[^"]*)"/i) ||
                                   mobileRequest.data.match(/<a\s+[^>]*href="([^"]*down[^"]*)"/i) ||
                                   mobileRequest.data.match(/<a\s+[^>]*href="([^"]*file[^"]*)"/i) ||
                                   mobileRequest.data.match(/<a\s+[^>]*href="([^"]*\.apk[^"]*)"/i) ||
                                   mobileRequest.data.match(/<a\s+[^>]*href="([^"]*\.zip[^"]*)"/i) ||
                                   mobileRequest.data.match(/<a\s+[^>]*href="([^"]*\.rar[^"]*)"/i) ||
                                   mobileRequest.data.match(/<a\s+[^>]*href="([^"]*\.7z[^"]*)"/i) ||
                                   mobileRequest.data.match(/<a\s+[^>]*href="([^"]*\.exe[^"]*)"/i);
                
                if (downloadMatch) {
                    console.log('[*] 匹配到下载链接:', downloadMatch[1]);
                    url = downloadMatch[1];
                } else {
                    // 尝试匹配其他可能的下载链接
                    const aMatch = mobileRequest.data.match(/<a\s+href="(https?:\/\/[^"\s]+)"/);
                    if (aMatch) {
                        console.log('[*] 匹配到HTTP链接:', aMatch[1]);
                        url = aMatch[1];
                    } else if (mobileRequest.data.includes('location.href')) {
                        // 尝试从JavaScript中提取重定向URL
                        const jsMatch = mobileRequest.data.match(/location\.href\s*=\s*["\']([^"\']+)["\']/);
                        if (jsMatch) {
                            console.log('[*] 从JavaScript中提取到重定向URL:', jsMatch[1]);
                            url = jsMatch[1];
                        }
                    }
                }
            }
        }
        
        // 如果仍然没有获取到URL，尝试使用不同的API域名
        if (!url) {
            console.log('[*] 尝试使用不同的API域名');
            const domains = ['www.lanzoui.com', 'www.lanzoux.com', 'www.lanzouo.com'];
            for (const domain of domains) {
                if (domain !== this.apiDomain) {
                    console.log('[*] 尝试使用域名:', domain);
                    const originalDomain = this.apiDomain;
                    this.apiDomain = domain;
                    
                    try {
                        // 重新构建URL
                        const newUrl = info.url.replace(this.apiDomain, domain);
                        const domainRequest = await this.request(newUrl, 'GET', null, headers, 'info');
                        if (domainRequest.redirect_url) {
                            url = domainRequest.redirect_url;
                            console.log('[*] 使用新域名获取到重定向URL:', url);
                            break;
                        }
                    } catch (e) {
                        console.log('[!] 尝试新域名失败:', e);
                    } finally {
                        this.apiDomain = originalDomain;
                    }
                }
            }
        }
        
        if (!url) {
            console.log('[!] 无法获取下载链接');
            return this.createResponse(201, "获取链接失败", info, globalShareKey);
        }
        
        // 确保URL是完整的
        if (!url.startsWith('http://') && !url.startsWith('https://')) {
            // 尝试从info.url中提取域名
            const baseUrlMatch = info.url.match(/https?:\/\/[^\/]+/);
            if (baseUrlMatch) {
                url = baseUrlMatch[0] + url;
                console.log('[*] 补全URL:', url);
            }
        }
        
        console.log('[*] 最终获取到的下载链接:', url);
        
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

// ============================== 移动云盘AES工具类 ==============================
class AESUtils2 {
    static async encrypt139(plaintext) {
        const key = "PVGDwmcvfs1uV3d1";
        return await this.encrypt(plaintext, key);
    }
    
    static async encrypt(plaintext, key) {
        try {
            // 生成随机16字节IV
            const iv = crypto.getRandomValues(new Uint8Array(16));
            
            // 准备密钥
            const keyBytes = new TextEncoder().encode(key);
            const cryptoKey = await crypto.subtle.importKey(
                'raw',
                keyBytes,
                { name: 'AES-CBC' },
                false,
                ['encrypt']
            );
            
            // PKCS5Padding填充
            const padded = this.pkcs5Pad(plaintext);
            const dataBytes = new TextEncoder().encode(padded);
            
            // 加密
            const encrypted = await crypto.subtle.encrypt(
                { name: 'AES-CBC', iv: iv },
                cryptoKey,
                dataBytes
            );
            
            // 将IV附加在加密数据前面
            const result = new Uint8Array(iv.length + encrypted.byteLength);
            result.set(iv, 0);
            result.set(new Uint8Array(encrypted), iv.length);
            
            // Base64编码
            return btoa(String.fromCharCode(...result));
        } catch (e) {
            console.log(`[!] AES加密失败: ${e}`);
            return plaintext;
        }
    }
    
    static async decrypt139(encryptedData) {
        const key = "PVGDwmcvfs1uV3d1";
        return await this.decrypt(encryptedData, key);
    }
    
    static async decrypt(encryptedData, key) {
        try {
            // Base64解码
            const decoded = atob(encryptedData);
            const decodedBytes = new Uint8Array(decoded.length);
            for (let i = 0; i < decoded.length; i++) {
                decodedBytes[i] = decoded.charCodeAt(i);
            }
            
            // 提取IV（前16字节）
            const iv = decodedBytes.slice(0, 16);
            const encrypted = decodedBytes.slice(16);
            
            // 准备密钥
            const keyBytes = new TextEncoder().encode(key);
            const cryptoKey = await crypto.subtle.importKey(
                'raw',
                keyBytes,
                { name: 'AES-CBC' },
                false,
                ['decrypt']
            );
            
            // 解密
            const decrypted = await crypto.subtle.decrypt(
                { name: 'AES-CBC', iv: iv },
                cryptoKey,
                encrypted
            );
            
            // 去除PKCS5Padding填充
            const decryptedArray = new Uint8Array(decrypted);
            const paddingLen = decryptedArray[decryptedArray.length - 1];
            const unpaddedArray = decryptedArray.slice(0, decryptedArray.length - paddingLen);
            const decryptedStr = new TextDecoder().decode(unpaddedArray);
            
            return decryptedStr;
        } catch (e) {
            console.log(`[!] AES解密失败: ${e}`);
            // 尝试直接返回加密数据
            console.log('[*] 尝试直接返回加密数据:', encryptedData);
            return encryptedData;
        }
    }
    
    static pkcs5Pad(data) {
        const blockSize = 16;
        const paddingLen = blockSize - (data.length % blockSize);
        const padding = String.fromCharCode(paddingLen).repeat(paddingLen);
        return data + padding;
    }
}

// ============================== 移动云盘解析器 ==============================
class MobileCloudParser {
    constructor(config) {
        this.config = config;
        const mcloudConfig = config.mcloud || {};
        this.authorization = mcloudConfig.authorization;
        console.log('[*] 移动云盘Authorization:', this.authorization ? '已设置' : '未设置');
        this.account = this.extractAccountFromAuth(this.authorization);
        console.log('[*] 移动云盘账号:', this.account);
        this.session = null;
    }

    extractAccountFromAuth(authorization) {
        if (!authorization) {
            console.log('[!] Authorization为空');
            return null;
        }
        
        try {
            let authStr = authorization.trim();
            console.log('[*] Authorization原始值:', authStr);
            
            // 移除可能的Basic前缀
            authStr = authStr.replace(/^basic\s+/i, '');
            console.log('[*] 去除Basic前缀后:', authStr);
            
            try {
                // 尝试Base64解码
                const decoded = atob(authStr);
                console.log(`[*] Authorization解码后: ${decoded}`);
                
                // 用"|"分割
                const parts = decoded.split('|');
                console.log(`[*] 分割后parts数量:`, parts.length);
                console.log(`[*] 分割后parts:`, parts);
                
                if (parts.length >= 1) {
                    const firstPart = parts[0];
                    console.log(`[*] 第一部分: ${firstPart}`);
                    
                    // 用":"分割第一部分
                    const subParts = firstPart.split(':');
                    console.log(`[*] 第一部分分割后数量:`, subParts.length);
                    console.log(`[*] 第一部分分割后:`, subParts);
                    
                    if (subParts.length >= 2) {
                        const account = subParts[1];
                        console.log(`[*] 从Authorization中提取到账号: ${account}`);
                        return account;
                    } else {
                        console.log('[!] 第一部分分割后不足2个元素');
                        // 尝试直接返回第一部分作为账号
                        console.log('[*] 尝试直接返回第一部分作为账号:', firstPart);
                        return firstPart;
                    }
                } else {
                    console.log('[!] 分割后parts不足1个元素');
                    // 尝试直接返回解码后的值作为账号
                    console.log('[*] 尝试直接返回解码后的值作为账号:', decoded);
                    return decoded;
                }
            } catch (e) {
                console.log('[!] Base64解码失败:', e);
                // 解码失败时，使用默认账号
                console.log('[*] 解码失败，使用默认账号');
                return 'default';
            }
        } catch (e) {
            console.log(`[!] 解析 authorization 失败: ${e}`);
            // 解析失败时，使用默认账号
            console.log('[*] 解析失败，使用默认账号');
            return 'default';
        }
    }

    buildHeaders() {
        const headers = {
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
            'Mcloud-Client': '10702',
            'Mcloud-Route': '001',
            'Mcloud-Version': '7.13.3',
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
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36 Edg/127.0.0.0',
            'X-Deviceinfo': '||3|12.27.0|edge||522b6107d153211263b13afa2b041bf5||windows 10|922X974|zh-CN|||',
            'X-Huawei-Channelsrc': '10213406',
            'X-Inner-Ntwk': '2',
            'X-M4c-Caller': 'PC',
            'X-M4c-Src': '10002',
            'X-Svctype': '1',
            'X-Yun-Api-Version': 'v1',
            'X-Yun-App-Channel': '10213406',
            'X-Yun-Channel-Source': '10213406',
            'X-Yun-Client-Info': '||9|7.13.3|edge||522b6107d153211263b13afa2b041bf5||windows 10||zh-CN|||ZWRnZQ==||',
            'X-Yun-Module-Type': '100',
            'X-Yun-Svc-Type': '1'
        };
        
        // 添加Authorization头，确保格式正确（使用小写，与Python代码一致）
        if (this.authorization) {
            // 移除所有空白字符（包括换行符），确保Authorization头格式正确
            let cleanAuth = this.authorization.replace(/\s/g, '');
            // 确保Basic和后面的内容之间有空格
            if (cleanAuth.startsWith('Basic')) {
                cleanAuth = 'Basic ' + cleanAuth.substring(5);
            }
            headers['authorization'] = cleanAuth;
            console.log('[*] Authorization:', cleanAuth);
        } else {
            console.log('[!] 未设置Authorization');
        }
        
        return headers;
    }

    extractShareInfo(url) {
        url = url.trim();
        
        try {
            const decodedUrl = decodeURIComponent(url);
            if (decodedUrl !== url) {
                console.log('[*] URL已解码:', decodedUrl);
                url = decodedUrl;
            }
        } catch (e) {
            console.log('[*] URL解码失败，使用原始URL:', e);
        }
        
        const patterns = [
            /https?:\/\/(?:yun|caiyun)\.139\.com\/shareweb\/#\/w\/i\/([a-zA-Z0-9]+)(?:$|\&|\?)/i,
            /https?:\/\/(?:yun|caiyun)\.139\.com\/shareweb\/\?linkId=([a-zA-Z0-9]+)(?:$|\&)/i,
            /https?:\/\/(?:yun|caiyun)\.139\.com\/link\/\?linkId=([a-zA-Z0-9]+)(?:$|\&)/i,
            /\/w\/i\/([a-zA-Z0-9]+)(?:$|\&|\?)/i,
            /linkId=([a-zA-Z0-9]+)(?:$|\&)/i
        ];

        for (const pattern of patterns) {
            const match = url.match(pattern);
            if (match) {
                let linkId = match[1];
                if (linkId.endsWith('https')) {
                    linkId = linkId.substring(0, linkId.length - 5);
                }
                return {
                    linkId: linkId
                };
            }
        }

        return { linkId: null };
    }

    async getShareFiles(linkId, pwd = '', pCaID = 'root') {
        try {
            if (!this.account) {
                console.log('[!] 无法获取手机号，请检查Authorization配置');
                return [];
            }
            
            // 使用与Python代码一致的API端点
            const endpoint = 'https://share-kd-njs.yun.139.com/yun-share/richlifeApp/devapp/IOutLink/getOutLinkInfoV6';
            console.log('[*] API端点:', endpoint);
            
            // 构造请求体（与Python代码完全一致）
            const bodyTemplate = '{"getOutLinkInfoReq":{"account":"{account}","linkID":"{key}","passwd":"{pwd}","caSrt":0,"coSrt":0,"srtDr":1,"bNum":1,"pCaID":"{pCaID}","eNum":200},"commonAccountInfo":{"account":"{account}","accountType":1}}';
            let bodyStr = bodyTemplate.replace('{key}', linkId);
            bodyStr = bodyStr.replace('{pwd}', pwd || '');
            bodyStr = bodyStr.replace(/\{account\}/g, this.account);
            bodyStr = bodyStr.replace('{pCaID}', pCaID);
            
            console.log('[*] 加密前请求体:', bodyStr);
            
            try {
                const encryptedBody = await AESUtils2.encrypt139(bodyStr);
                console.log('[*] 加密后请求体:', encryptedBody.substring(0, 100) + '...');
                
                const headers = this.buildHeaders();
                console.log('[*] 请求头:', JSON.stringify(headers, null, 2));
                
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 30000);
                
                let resp;
                try {
                    resp = await fetch(endpoint, {
                        method: 'POST',
                        headers: headers,
                        body: encryptedBody,
                        signal: controller.signal
                    });
                    clearTimeout(timeoutId);
                } catch (e) {
                    clearTimeout(timeoutId);
                    console.log('[!] 请求失败:', e);
                    return [];
                }
                
                console.log('[*] 响应状态:', resp.status);
                
                if (resp.status !== 200) {
                    console.log('[!] 获取文件信息失败: HTTP', resp.status);
                    const errorText = await resp.text();
                    console.log('[!] 错误响应:', errorText);
                    return [];
                }
                
                const encryptedResponse = await resp.text();
                if (!encryptedResponse) {
                    console.log('[!] 响应内容为空');
                    return [];
                }
                
                console.log('[*] 加密响应:', encryptedResponse.substring(0, 100) + '...');
                
                const decryptedResponse = await AESUtils2.decrypt139(encryptedResponse);
                if (!decryptedResponse) {
                    console.log('[!] 解密响应失败');
                    return [];
                }
                
                console.log('[*] 解密后响应:', decryptedResponse.substring(0, 500));
                
                // 解析JSON（与Python代码一致）
                try {
                    const result = JSON.parse(decryptedResponse);
                    console.log('[*] 响应:', JSON.stringify(result, null, 2));
                    
                    // 检查响应是否成功（与Python代码一致）
                    if (result.success || result.resultCode === '0') {
                        const data = result.data || {};
                        // 移动云盘API返回的文件列表在coLst字段中
                        const fileList = data.coLst || data.fileList || data.files || data.contentList || [];
                        console.log('[*] 成功获取到', fileList.length, '个文件');
                        return fileList;
                    } else {
                        console.log('[!] API返回错误:', result.desc || result.msg || result.message || '');
                        return [];
                    }
                } catch (e) {
                    console.log('[!] JSON解析失败:', e);
                    console.log('[!] 解密后内容:', decryptedResponse);
                    
                    // 尝试从响应中提取文件列表
                    try {
                        // 查找coLst数组，使用更精确的正则表达式
                        const coLstMatch = decryptedResponse.match(/"coLst":\s*\[(.*?)\]/s);
                        if (coLstMatch) {
                            const coLstStr = '[' + coLstMatch[1] + ']';
                            try {
                                const fileList = JSON.parse(coLstStr);
                                console.log('[*] 从响应中提取到文件列表，数量:', fileList.length);
                                return fileList;
                            } catch (parseError) {
                                console.log('[!] 解析提取的coLst失败:', parseError);
                                // 尝试修复可能的JSON格式问题
                                try {
                                    // 尝试找到数组的结束位置
                                    const coLstStart = decryptedResponse.indexOf('"coLst":[');
                                    if (coLstStart !== -1) {
                                        let depth = 1;
                                        let coLstEnd = coLstStart + 7; // 跳过 "coLst":[
                                        
                                        while (depth > 0 && coLstEnd < decryptedResponse.length) {
                                            if (decryptedResponse[coLstEnd] === '[') {
                                                depth++;
                                            } else if (decryptedResponse[coLstEnd] === ']') {
                                                depth--;
                                            }
                                            coLstEnd++;
                                        }
                                        
                                        if (depth === 0) {
                                            const coLstFullStr = decryptedResponse.substring(coLstStart + 7, coLstEnd - 1);
                                            const fileList = JSON.parse('[' + coLstFullStr + ']');
                                            console.log('[*] 从响应中提取到完整文件列表，数量:', fileList.length);
                                            return fileList;
                                        }
                                    }
                                } catch (fixError) {
                                    console.log('[!] 修复JSON格式失败:', fixError);
                                }
                            }
                        }
                    } catch (extractError) {
                        console.log('[!] 提取文件列表失败:', extractError);
                    }
                    
                    return [];
                }
            } catch (e) {
                console.log('[!] 加密/解密过程失败:', e);
                return [];
            }
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
            
            const endpoint = 'https://share-kd-njs.yun.139.com/yun-share/richlifeApp/devapp/IOutLink/dlFromOutLinkV3';
            console.log('[*] 获取下载链接API端点:', endpoint);
            
            const bodyTemplate = '{"dlFromOutLinkReqV3":{"account":"{account}","linkID":"{key}","coIDLst":{"item":["{item}"]}},"commonAccountInfo":{"account":"{account}","accountType":1}}';
            let bodyStr = bodyTemplate.replace('{key}', linkId);
            bodyStr = bodyStr.replace('{item}', filePath);
            bodyStr = bodyStr.replace(/\{account\}/g, this.account);
            console.log('[*] 下载链接请求体:', bodyStr);
            
            const encryptedBody = await AESUtils2.encrypt139(bodyStr);
            const headers = this.buildHeaders();
            
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 30000);
            
            let resp;
            try {
                resp = await fetch(endpoint, {
                    method: 'POST',
                    headers: headers,
                    body: encryptedBody,
                    signal: controller.signal
                });
                clearTimeout(timeoutId);
            } catch (e) {
                clearTimeout(timeoutId);
                console.log('[!] 请求失败:', e);
                return null;
            }
            
            console.log('[*] 下载链接响应状态:', resp.status);
            
            if (resp.status !== 200) {
                console.log('[!] 获取下载链接失败: HTTP', resp.status);
                const errorText = await resp.text();
                console.log('[!] 错误响应:', errorText);
                return null;
            }
            
            const encryptedResponse = await resp.text();
            if (!encryptedResponse) {
                console.log('[!] 下载链接响应为空');
                return null;
            }
            
            const decryptedResponse = await AESUtils2.decrypt139(encryptedResponse);
            if (!decryptedResponse) {
                console.log('[!] 解密下载链接响应失败');
                return null;
            }
            
            console.log('[*] 解密后下载链接响应:', decryptedResponse.substring(0, 500));
            
            try {
                const result = JSON.parse(decryptedResponse);
                
                // 检查响应是否成功（与Python代码一致）
                if (result.success || result.resultCode === '0') {
                    const data = result.data || {};
                    const downloadUrl = data.redrUrl || data.downloadUrl || data.url;
                    if (downloadUrl) {
                        console.log('[*] 成功获取下载链接:', downloadUrl.substring(0, 100) + '...');
                        return downloadUrl;
                    } else {
                        console.log('[!] 响应中未找到下载链接:', result);
                    }
                } else {
                    console.log('[!] API返回错误:', result.desc || result.msg || '');
                    console.log('[!] 错误代码:', result.resultCode || '');
                }
            } catch (e) {
                console.log('[!] JSON解析失败:', e);
                // 尝试从响应中提取下载链接
                try {
                    // 查找redrUrl字段
                    const redrUrlMatch = decryptedResponse.match(/"redrUrl":"([^"]+)"/);
                    if (redrUrlMatch) {
                        const downloadUrl = redrUrlMatch[1];
                        console.log('[*] 从响应中提取到下载链接:', downloadUrl.substring(0, 100) + '...');
                        return downloadUrl;
                    }
                    // 查找downloadUrl字段
                    const downloadUrlMatch = decryptedResponse.match(/"downloadUrl":"([^"]+)"/);
                    if (downloadUrlMatch) {
                        const downloadUrl = downloadUrlMatch[1];
                        console.log('[*] 从响应中提取到下载链接:', downloadUrl.substring(0, 100) + '...');
                        return downloadUrl;
                    }
                    // 查找url字段
                    const urlMatch = decryptedResponse.match(/"url":"([^"]+)"/);
                    if (urlMatch) {
                        const downloadUrl = urlMatch[1];
                        console.log('[*] 从响应中提取到下载链接:', downloadUrl.substring(0, 100) + '...');
                        return downloadUrl;
                    }
                } catch (extractError) {
                    console.log('[!] 提取下载链接失败:', extractError);
                }
                return null;
            }
        } catch (e) {
            console.log('[!] 获取下载链接异常:', e);
            return null;
        }
    }

    async parse(shareUrl, pwd = '') {
        try {
            if (!this.config.mcloud.enabled) {
                return { code: 503, msg: '移动云盘解析已禁用', success: false, data: null };
            }

            if (!this.authorization) {
                return {
                    code: 401,
                    msg: '移动云盘 Authorization 未配置，请检查 MCLOUD_AUTHORIZATION 环境变量',
                    success: false,
                    data: null
                };
            }

            console.log('[*] 开始解析分享链接:', shareUrl);
            console.log('[*] 分享密码:', pwd);
            console.log('[*] 账号:', this.account);
            
            const shareInfo = this.extractShareInfo(shareUrl);
            if (!shareInfo.linkId) {
                console.log('[!] 无效的分享链接:', shareUrl);
                return { code: 400, msg: '无效的移动云盘分享链接', success: false, data: null };
            }
            
            const linkId = shareInfo.linkId;
            console.log('[*] 提取到linkId:', linkId);
            
            if (!this.account) {
                console.log('[!] 无法从Authorization中提取账号，尝试使用默认账号');
                // 尝试使用默认账号
                this.account = 'default';
                console.log('[*] 使用默认账号:', this.account);
            }
            
            const files = await this.getShareFiles(linkId, pwd);
            if (!files || files.length === 0) {
                console.log('[!] 获取文件列表失败，可能的原因：1. Authorization无效 2. 分享链接失效 3. 分享密码错误 4. API返回空文件列表');
                return { code: 404, msg: '分享中没有文件，可能是分享链接失效或Authorization无效', success: false, data: null };
            }
            
            const results = [];
            for (const file of files) {
                const fileId = file.coID || file.contentID || file.id || file.fileId;
                const fileName = file.coName || file.contentName || file.name || file.fileName;
                const fileSize = file.coSize || file.contentSize || file.size || file.fileSize || 0;
                const isDirectory = file.coType === 1 || file.isDir === 1;
                const filePath = file.path;
                
                let downloadUrl = null;
                if (!isDirectory && filePath) {
                    console.log('[*] 正在获取文件', fileName, '的下载链接...');
                    downloadUrl = await this.getDownloadUrl(linkId, filePath);
                }
                
                results.push({
                    file_id: fileId,
                    file_name: fileName,
                    file_size: fileSize,
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
            
            return {
                code: 200,
                msg: '解析成功',
                success: true,
                data: responseData
            };

        } catch (e) {
            console.log('[!] 解析异常:', e);
            return { code: 500, msg: '解析失败: ' + e.message, success: false, data: null };
        }
    }
}

function handleResponse(result, type, configRedirect, config, isAliyun = false, isQuark = false, quarkCookie = null, isUC = false, ucCookie = null, aliyunAuthorization = null) {
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
                          !result.data.is_directory &&
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
function admin(isLoggedIn, errorMessage = '') {
    if (!isLoggedIn) {
        // 登录页面
        return '<!DOCTYPE html>\n' +
            '<html lang="zh-CN">\n' +
            '<head>\n' +
            '    <meta charset="UTF-8">\n' +
            '    <meta name="viewport" content="width=device-width, initial-scale=1.0">\n' +
            '    <title>后台登录 - 网盘解析工具</title>\n' +
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
            '                    }\n' +
            '                }\n' +
            '            }\n' +
            '        }\n' +
            '    </script>\n' +
            '</head>\n' +
            '<body class="bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50 min-h-screen flex items-center justify-center">\n' +
            '    <div class="container mx-auto px-4">\n' +
            '        <div class="max-w-md mx-auto">\n' +
            '            <div class="bg-white/80 backdrop-blur-lg rounded-2xl shadow-xl p-8">\n' +
            '                <div class="text-center mb-8">\n' +
            '                    <div class="inline-flex items-center justify-center w-16 h-16 bg-primary/10 rounded-full mb-4">\n' +
            '                        <i class="fa fa-shield text-3xl text-primary"></i>\n' +
            '                    </div>\n' +
            '                    <h1 class="text-2xl font-bold text-dark mb-2">后台管理面板</h1>\n' +
            '                    <p class="text-secondary">请登录以访问管理功能</p>\n' +
            '                </div>\n' +
            (errorMessage ? '<div class="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-lg mb-6 flex items-center"><i class="fa fa-exclamation-circle mr-2"></i>' + errorMessage + '</div>' : '') +
            '                <form action="/admin?action=login" method="POST" class="space-y-6">\n' +
            '                    <div>\n' +
            '                        <label for="username" class="block text-sm font-medium text-gray-700 mb-2">用户名</label>\n' +
            '                        <div class="relative">\n' +
            '                            <span class="absolute inset-y-0 left-0 pl-3 flex items-center text-gray-400">\n' +
            '                                <i class="fa fa-user"></i>\n' +
            '                            </span>\n' +
            '                            <input type="text" id="username" name="username" required class="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent transition-all" placeholder="请输入用户名">\n' +
            '                        </div>\n' +
            '                    </div>\n' +
            '                    <div>\n' +
            '                        <label for="password" class="block text-sm font-medium text-gray-700 mb-2">密码</label>\n' +
            '                        <div class="relative">\n' +
            '                            <span class="absolute inset-y-0 left-0 pl-3 flex items-center text-gray-400">\n' +
            '                                <i class="fa fa-lock"></i>\n' +
            '                            </span>\n' +
            '                            <input type="password" id="password" name="password" required class="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent transition-all" placeholder="请输入密码">\n' +
            '                        </div>\n' +
            '                    </div>\n' +
            '                    <button type="submit" class="w-full bg-primary text-white py-3 rounded-lg font-medium hover:bg-primary/90 focus:ring-2 focus:ring-primary/50 transition-all flex items-center justify-center">\n' +
            '                        <i class="fa fa-sign-in mr-2"></i> 登录\n' +
            '                    </button>\n' +
            '                </form>\n' +
            '                <div class="mt-6 text-center">\n' +
            '                    <a href="/" class="text-primary hover:text-primary/80 text-sm"><i class="fa fa-arrow-left mr-1"></i> 返回首页</a>\n' +
            '                </div>\n' +
            '            </div>\n' +
            '        </div>\n' +
            '    </div>\n' +
            '</body>\n' +
            '</html>';
    } else {
        return '<!DOCTYPE html>\n' +
            '<html lang="zh-CN">\n' +
            '<head>\n' +
            '    <meta charset="UTF-8">\n' +
            '    <meta name="viewport" content="width=device-width, initial-scale=1.0">\n' +
            '    <title>后台管理面板 - 网盘解析工具</title>\n' +
            '    <script src="https://cdn.tailwindcss.com"></script>\n' +
            '    <link href="https://cdn.jsdelivr.net/npm/font-awesome@4.7.0/css/font-awesome.min.css" rel="stylesheet">\n' +
            '    <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>\n' +
            '    <script src="https://cdnjs.cloudflare.com/ajax/libs/forge/1.3.1/forge.min.js"></script>\n' +
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
            '                    }\n' +
            '                }\n' +
            '            }\n' +
            '        }\n' +
            '    </script>\n' +
            '    <style>\n' +
            '        .sidebar-item { transition: all 0.2s ease; }\n' +
            '        .sidebar-item:hover { background: rgba(59,130,246,0.1); }\n' +
            '        .sidebar-item.active { background: rgba(59,130,246,0.15); color: #3b82f6; border-right: 3px solid #3b82f6; }\n' +
            '        .page-section { display: none; }\n' +
            '        .page-section.active { display: block; }\n' +
            '        .login-card { transition: all 0.2s ease; }\n' +
            '        .login-card:hover { transform: translateY(-2px); box-shadow: 0 8px 25px rgba(0,0,0,0.1); }\n' +
            '    </style>\n' +
            '</head>\n' +
            '<body class="bg-gray-100 min-h-screen flex">\n' +
            '    <aside class="w-64 bg-white shadow-lg flex flex-col fixed h-full z-10">\n' +
            '        <div class="p-6 border-b border-gray-200">\n' +
            '            <h1 class="text-xl font-bold text-dark flex items-center gap-2">\n' +
            '                <i class="fa fa-cogs text-primary"></i> 管理面板\n' +
            '            </h1>\n' +
            '            <p class="text-xs text-secondary mt-1">网盘解析工具</p>\n' +
            '        </div>\n' +
            '        <nav class="flex-1 py-4">\n' +
            '            <div class="sidebar-item active px-6 py-3 flex items-center gap-3 cursor-pointer" onclick="switchPage(\'dashboard\')" id="nav-dashboard">\n' +
            '                <i class="fa fa-dashboard w-5 text-center"></i>\n' +
            '                <span class="font-medium">控制面板</span>\n' +
            '            </div>\n' +
            '            <div class="sidebar-item px-6 py-3 flex items-center gap-3 cursor-pointer" onclick="switchPage(\'qrlogin\')" id="nav-qrlogin">\n' +
            '                <i class="fa fa-qrcode w-5 text-center"></i>\n' +
            '                <span class="font-medium">扫码登录</span>\n' +
            '            </div>\n' +
            '            <div class="sidebar-item px-6 py-3 flex items-center gap-3 cursor-pointer" onclick="switchPage(\'records\')" id="nav-records">\n' +
            '                <i class="fa fa-list w-5 text-center"></i>\n' +
            '                <span class="font-medium">解析记录</span>\n' +
            '            </div>\n' +
            '        </nav>\n' +
            '        <div class="p-4 border-t border-gray-200">\n' +
            '            <a href="/" class="flex items-center gap-2 text-secondary hover:text-primary text-sm mb-3 px-2">\n' +
            '                <i class="fa fa-home"></i> 返回首页\n' +
            '            </a>\n' +
            '            <button onclick="logout()" class="flex items-center gap-2 text-danger hover:text-danger/80 text-sm px-2">\n' +
            '                <i class="fa fa-sign-out"></i> 退出登录\n' +
            '            </button>\n' +
            '        </div>\n' +
            '    </aside>\n' +
            '    <main class="flex-1 ml-64 p-8">\n' +
            '        <div class="page-section active" id="page-dashboard">\n' +
            '            <h2 class="text-2xl font-bold text-dark mb-6 flex items-center gap-2"><i class="fa fa-dashboard text-primary"></i> 控制面板</h2>\n' +
            '            <div class="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">\n' +
            '                <div class="bg-white rounded-xl p-6 shadow-sm hover:shadow-md transition-shadow"><div class="flex items-center justify-between"><div><p class="text-secondary text-sm mb-1">解析总数</p><p class="text-3xl font-bold text-dark" id="totalRequests">0</p></div><div class="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center"><i class="fa fa-bar-chart text-primary text-xl"></i></div></div></div>\n' +
            '                <div class="bg-white rounded-xl p-6 shadow-sm hover:shadow-md transition-shadow"><div class="flex items-center justify-between"><div><p class="text-secondary text-sm mb-1">成功次数</p><p class="text-3xl font-bold text-success" id="successRequests">0</p></div><div class="w-12 h-12 bg-success/10 rounded-full flex items-center justify-center"><i class="fa fa-check-circle text-success text-xl"></i></div></div></div>\n' +
            '                <div class="bg-white rounded-xl p-6 shadow-sm hover:shadow-md transition-shadow"><div class="flex items-center justify-between"><div><p class="text-secondary text-sm mb-1">失败次数</p><p class="text-3xl font-bold text-danger" id="failedRequests">0</p></div><div class="w-12 h-12 bg-danger/10 rounded-full flex items-center justify-center"><i class="fa fa-times-circle text-danger text-xl"></i></div></div></div>\n' +
            '                <div class="bg-white rounded-xl p-6 shadow-sm hover:shadow-md transition-shadow"><div class="flex items-center justify-between"><div><p class="text-secondary text-sm mb-1">缓存命中</p><p class="text-3xl font-bold text-primary" id="cachedRequests">0</p></div><div class="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center"><i class="fa fa-database text-primary text-xl"></i></div></div></div>\n' +
            '            </div>\n' +
            '            <div class="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">\n' +
            '                <div class="bg-white rounded-xl p-6 shadow-sm"><h3 class="text-lg font-semibold text-dark mb-4 flex items-center gap-2"><i class="fa fa-pie-chart text-primary"></i> 解析成功率</h3><div class="h-64"><canvas id="successRateChart"></canvas></div></div>\n' +
            '                <div class="bg-white rounded-xl p-6 shadow-sm"><h3 class="text-lg font-semibold text-dark mb-4 flex items-center gap-2"><i class="fa fa-line-chart text-primary"></i> 解析统计概览</h3><div class="h-64"><canvas id="statsChart"></canvas></div></div>\n' +
            '            </div>\n' +
            '            <div class="bg-white rounded-xl p-6 shadow-sm mb-6">\n' +
            '                <div class="flex items-center justify-between mb-6"><h3 class="text-lg font-semibold text-dark flex items-center gap-2"><i class="fa fa-key text-primary"></i> 登录配置概况</h3><button onclick="loadAllLoginStatus()" class="bg-primary/10 text-primary px-4 py-2 rounded-lg hover:bg-primary/20 transition-all flex items-center gap-2"><i class="fa fa-refresh"></i> 刷新状态</button></div>\n' +
            '                <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4" id="loginStatusCards">\n' +
            '                    <div class="login-card bg-gray-50 rounded-lg p-4 border border-gray-200"><div class="flex items-center justify-between mb-3"><div class="flex items-center gap-2"><i class="fa fa-cloud text-primary text-lg"></i><span class="font-semibold text-dark">光鸭云盘</span></div><span id="gy-status-badge" class="px-2 py-1 rounded-full text-xs bg-gray-200 text-gray-500">检测中</span></div><div class="text-sm text-secondary mb-2" id="gy-status-source">--</div><button onclick="showLoginDetail(\'guangya\')" class="text-xs text-primary hover:text-primary/80 flex items-center gap-1"><i class="fa fa-eye"></i> 查看详情</button></div>\n' +
            '                    <div class="login-card bg-gray-50 rounded-lg p-4 border border-gray-200"><div class="flex items-center justify-between mb-3"><div class="flex items-center gap-2"><i class="fa fa-cloud text-yellow-500 text-lg"></i><span class="font-semibold text-dark">阿里云盘</span></div><span id="aliyun-status-badge" class="px-2 py-1 rounded-full text-xs bg-gray-200 text-gray-500">未配置</span></div><div class="text-sm text-secondary mb-2" id="aliyun-status-source">--</div><button onclick="showLoginDetail(\'aliyun\')" class="text-xs text-primary hover:text-primary/80 flex items-center gap-1"><i class="fa fa-eye"></i> 查看详情</button></div>\n' +
            '                    <div class="login-card bg-gray-50 rounded-lg p-4 border border-gray-200"><div class="flex items-center justify-between mb-3"><div class="flex items-center gap-2"><i class="fa fa-cloud text-orange-500 text-lg"></i><span class="font-semibold text-dark">UC网盘</span></div><span id="uc-status-badge" class="px-2 py-1 rounded-full text-xs bg-gray-200 text-gray-500">未配置</span></div><div class="text-sm text-secondary mb-2" id="uc-status-source">--</div><button onclick="showLoginDetail(\'uc\')" class="text-xs text-primary hover:text-primary/80 flex items-center gap-1"><i class="fa fa-eye"></i> 查看详情</button></div>\n' +
            '                    <div class="login-card bg-gray-50 rounded-lg p-4 border border-gray-200"><div class="flex items-center justify-between mb-3"><div class="flex items-center gap-2"><i class="fa fa-cloud text-purple-500 text-lg"></i><span class="font-semibold text-dark">夸克网盘</span></div><span id="quark-status-badge" class="px-2 py-1 rounded-full text-xs bg-gray-200 text-gray-500">未配置</span></div><div class="text-sm text-secondary mb-2" id="quark-status-source">--</div><button onclick="showLoginDetail(\'quark\')" class="text-xs text-primary hover:text-primary/80 flex items-center gap-1"><i class="fa fa-eye"></i> 查看详情</button></div>\n' +
            '                    <div class="login-card bg-gray-50 rounded-lg p-4 border border-gray-200"><div class="flex items-center justify-between mb-3"><div class="flex items-center gap-2"><i class="fa fa-cloud text-blue-500 text-lg"></i><span class="font-semibold text-dark">移动云盘</span></div><span id="mcloud-status-badge" class="px-2 py-1 rounded-full text-xs bg-gray-200 text-gray-500">未配置</span></div><div class="text-sm text-secondary mb-2" id="mcloud-status-source">--</div><button onclick="showLoginDetail(\'mcloud\')" class="text-xs text-primary hover:text-primary/80 flex items-center gap-1"><i class="fa fa-eye"></i> 查看详情</button></div>\n' +
            '                </div>\n' +
            '            </div>\n' +
            '            <div class="bg-white rounded-xl p-6 shadow-sm">\n' +
            '                <div class="flex items-center justify-between mb-4"><h3 class="text-lg font-semibold text-dark flex items-center gap-2"><i class="fa fa-info-circle text-primary"></i> 系统信息</h3><button onclick="loadStats()" class="bg-primary/10 text-primary px-4 py-2 rounded-lg hover:bg-primary/20 transition-all flex items-center gap-2"><i class="fa fa-refresh"></i> 刷新</button></div>\n' +
            '                <div class="grid grid-cols-1 md:grid-cols-2 gap-4">\n' +
            '                    <div class="bg-gray-50 rounded-lg p-4"><p class="text-sm text-secondary mb-1">系统状态</p><p class="text-lg font-semibold text-success flex items-center gap-2"><i class="fa fa-circle text-xs"></i> 运行中</p></div>\n' +
            '                    <div class="bg-gray-50 rounded-lg p-4"><p class="text-sm text-secondary mb-1">最后更新</p><p class="text-lg font-semibold text-dark" id="lastUpdate">--</p></div>\n' +
            '                    <div class="bg-gray-50 rounded-lg p-4"><p class="text-sm text-secondary mb-1">成功率</p><p class="text-lg font-semibold text-success" id="successRate">--</p></div>\n' +
            '                    <div class="bg-gray-50 rounded-lg p-4"><p class="text-sm text-secondary mb-1">缓存命中率</p><p class="text-lg font-semibold text-primary" id="cacheRate">--</p></div>\n' +
            '                </div>\n' +
            '            </div>\n' +
            '        </div>\n' +
            '        <div class="page-section" id="page-qrlogin">\n' +
            '            <h2 class="text-2xl font-bold text-dark mb-6 flex items-center gap-2"><i class="fa fa-qrcode text-primary"></i> 扫码登录</h2>\n' +
            '            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">\n' +
            '                <div class="bg-white rounded-xl p-6 shadow-sm">\n' +
            '                    <div class="flex items-center gap-3 mb-4"><div class="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center"><i class="fa fa-cloud text-primary text-lg"></i></div><div><h3 class="font-semibold text-dark">光鸭云盘</h3><p class="text-xs text-secondary" id="gy-qr-status">未登录</p></div></div>\n' +
            '                    <div id="gy-qr-container"><button onclick="startGuangyaQRLogin()" id="guangyaQRButton" class="w-full bg-primary text-white py-2.5 rounded-lg hover:bg-primary/90 transition-all flex items-center justify-center gap-2"><i class="fa fa-qrcode"></i> 扫码登录</button></div>\n' +
            '                    <div id="guangyaQRCode" class="hidden mt-4"><div class="flex flex-col items-center"><div id="qrcodeImage" class="mb-3 p-3 bg-white rounded-lg shadow"></div><p class="text-xs text-secondary mb-1">请使用光鸭云盘APP或微信扫码</p><p class="text-xs text-gray-500 mb-2">验证码: <span id="userCodeDisplay" class="font-mono font-bold text-primary"></span></p><div class="flex items-center gap-2 mb-2"><div class="w-24 bg-gray-200 rounded-full h-1.5"><div id="qrCountdown" class="bg-primary h-1.5 rounded-full transition-all" style="width: 100%"></div></div><span id="qrCountdownText" class="text-xs text-secondary">600s</span></div><p id="guangyaQRStatus" class="text-xs text-secondary">等待扫码...</p><button onclick="cancelGuangyaQRLogin()" class="mt-3 text-xs text-gray-500 hover:text-gray-700">取消</button></div></div>\n' +
            '                    <div id="guangyaLoginSuccess" class="hidden mt-4"><div class="bg-success/10 border border-success/30 rounded-lg p-3 text-center"><i class="fa fa-check-circle text-success text-2xl mb-1"></i><p class="text-sm font-semibold text-success">登录成功！</p><p class="text-xs text-secondary mt-1">已保存到默认配置</p></div></div>\n' +
            '                    <div class="mt-4 border-t pt-4"><button onclick="toggleManualInput(\'gy\')" class="text-xs text-primary hover:text-primary/80 flex items-center gap-1"><i class="fa fa-keyboard-o"></i> 手动输入</button><div id="gy-manual-input" class="hidden mt-3 space-y-2"><input type="text" id="guangyaAccessToken" class="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent" placeholder="access_token"><input type="text" id="guangyaRefreshToken" class="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent" placeholder="refresh_token (可选)"><button onclick="saveGuangyaManualLogin()" class="w-full bg-success text-white text-sm py-1.5 rounded-lg hover:bg-success/90">保存</button></div></div>\n' +
            '                </div>\n' +
            '                <div class="bg-white rounded-xl p-6 shadow-sm">\n' +
            '                    <div class="flex items-center gap-3 mb-4"><div class="w-10 h-10 bg-yellow-500/10 rounded-full flex items-center justify-center"><i class="fa fa-cloud text-yellow-500 text-lg"></i></div><div><h3 class="font-semibold text-dark">阿里云盘</h3><p class="text-xs text-secondary" id="aliyun-qr-status">未登录</p></div></div>\n' +
            '                    <div id="aliyun-qr-card-container"><button onclick="startAliyunQRLoginCard()" id="aliyunQRButtonCard" class="w-full bg-yellow-500 text-white py-2.5 rounded-lg hover:bg-yellow-500/90 transition-all flex items-center justify-center gap-2"><i class="fa fa-qrcode"></i> 扫码登录</button></div>\n' +
            '                    <div id="aliyunQRCodeCard" class="hidden mt-4"><div class="flex flex-col items-center"><div id="aliyunQrcodeImageCard" class="mb-3 p-3 bg-white rounded-lg shadow"></div><p class="text-xs text-secondary mb-1">请使用阿里云盘APP扫码</p><div class="flex items-center gap-2 mb-2"><div class="w-24 bg-gray-200 rounded-full h-1.5"><div id="aliyunCountdownCard" class="bg-yellow-500 h-1.5 rounded-full transition-all" style="width: 100%"></div></div><span id="aliyunCountdownTextCard" class="text-xs text-secondary">600s</span></div><p id="aliyunQRStatusCard" class="text-xs text-secondary">等待扫码...</p><button onclick="cancelAliyunQRLoginCard()" class="mt-3 text-xs text-gray-500 hover:text-gray-700">取消</button></div></div>\n' +
            '                    <div id="aliyunLoginSuccessCard" class="hidden mt-4"><div class="bg-success/10 border border-success/30 rounded-lg p-3 text-center"><i class="fa fa-check-circle text-success text-2xl mb-1"></i><p class="text-sm font-semibold text-success">登录成功！</p><p class="text-xs text-secondary mt-1">已保存到默认配置</p></div></div>\n' +
            '                    <div class="mt-4 border-t pt-4"><button onclick="toggleAliyunManualInput()" class="text-xs text-yellow-500 hover:text-yellow-500/80 flex items-center gap-1"><i class="fa fa-keyboard-o"></i> 手动输入Authorization</button><div id="aliyun-manual-input-card" class="hidden mt-3 space-y-2"><textarea id="aliyunAuthCard" class="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-transparent" rows="3" placeholder="Authorization"></textarea><button onclick="saveAliyunManualLogin()" class="w-full bg-success text-white text-sm py-1.5 rounded-lg hover:bg-success/90">保存</button></div></div>\n' +
            '                </div>\n' +
            '                <div class="bg-white rounded-xl p-6 shadow-sm">\n' +
            '                    <div class="flex items-center gap-3 mb-4"><div class="w-10 h-10 bg-orange-500/10 rounded-full flex items-center justify-center"><i class="fa fa-cloud text-orange-500 text-lg"></i></div><div><h3 class="font-semibold text-dark">UC网盘</h3><p class="text-xs text-secondary" id="uc-qr-status">未登录</p></div></div>\n' +
            '                    <div id="uc-qr-container"><button onclick="startUCQRLogin()" id="ucQRButton" class="w-full bg-orange-500 text-white py-2.5 rounded-lg hover:bg-orange-500/90 transition-all flex items-center justify-center gap-2"><i class="fa fa-qrcode"></i> 扫码登录</button></div>\n' +
            '                    <div id="ucQRCode" class="hidden mt-4"><div class="flex flex-col items-center"><div id="ucQrcodeImage" class="mb-3 p-3 bg-white rounded-lg shadow"></div><p class="text-xs text-secondary mb-1">请使用UC浏览器扫码</p><div class="flex items-center gap-2 mb-2"><div class="w-24 bg-gray-200 rounded-full h-1.5"><div id="ucCountdown" class="bg-orange-500 h-1.5 rounded-full transition-all" style="width: 100%"></div></div><span id="ucCountdownText" class="text-xs text-secondary">600s</span></div><p id="ucQRStatus" class="text-xs text-secondary">等待扫码...</p><button onclick="cancelUCQRLogin()" class="mt-3 text-xs text-gray-500 hover:text-gray-700">取消</button></div></div>\n' +
            '                    <div id="ucLoginSuccess" class="hidden mt-4"><div class="bg-success/10 border border-success/30 rounded-lg p-3 text-center"><i class="fa fa-check-circle text-success text-2xl mb-1"></i><p class="text-sm font-semibold text-success">登录成功！</p></div></div>\n' +
            '                    <div class="mt-4 border-t pt-4"><button onclick="toggleManualInput(\'uc\')" class="text-xs text-orange-500 hover:text-orange-500/80 flex items-center gap-1"><i class="fa fa-keyboard-o"></i> 手动输入Cookie</button><div id="uc-manual-input" class="hidden mt-3 space-y-2"><textarea id="ucCookieInput" class="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent" rows="3" placeholder="cookie字符串"></textarea><button onclick="saveUCManualLogin()" class="w-full bg-success text-white text-sm py-1.5 rounded-lg hover:bg-success/90">保存</button></div></div>\n' +
            '                </div>\n' +
            '                <div class="bg-white rounded-xl p-6 shadow-sm">\n' +
            '                    <div class="flex items-center gap-3 mb-4"><div class="w-10 h-10 bg-purple-500/10 rounded-full flex items-center justify-center"><i class="fa fa-cloud text-purple-500 text-lg"></i></div><div><h3 class="font-semibold text-dark">夸克网盘</h3><p class="text-xs text-secondary" id="quark-qr-status">未登录</p></div></div>\n' +
            '                    <div id="quark-qr-container"><button onclick="startQuarkQRLogin()" id="quarkQRButton" class="w-full bg-purple-500 text-white py-2.5 rounded-lg hover:bg-purple-500/90 transition-all flex items-center justify-center gap-2"><i class="fa fa-qrcode"></i> 扫码登录</button></div>\n' +
            '                    <div id="quarkQRCode" class="hidden mt-4"><div class="flex flex-col items-center"><div id="quarkQrcodeImage" class="mb-3 p-3 bg-white rounded-lg shadow"></div><p class="text-xs text-secondary mb-1">请使用夸克APP扫码</p><div class="flex items-center gap-2 mb-2"><div class="w-24 bg-gray-200 rounded-full h-1.5"><div id="quarkCountdown" class="bg-purple-500 h-1.5 rounded-full transition-all" style="width: 100%"></div></div><span id="quarkCountdownText" class="text-xs text-secondary">600s</span></div><p id="quarkQRStatus" class="text-xs text-secondary">等待扫码...</p><button onclick="cancelQuarkQRLogin()" class="mt-3 text-xs text-gray-500 hover:text-gray-700">取消</button></div></div>\n' +
            '                    <div id="quarkLoginSuccess" class="hidden mt-4"><div class="bg-success/10 border border-success/30 rounded-lg p-3 text-center"><i class="fa fa-check-circle text-success text-2xl mb-1"></i><p class="text-sm font-semibold text-success">登录成功！</p></div></div>\n' +
            '                    <div class="mt-4 border-t pt-4"><button onclick="toggleManualInput(\'quark\')" class="text-xs text-purple-500 hover:text-purple-500/80 flex items-center gap-1"><i class="fa fa-keyboard-o"></i> 手动输入Cookie</button><div id="quark-manual-input" class="hidden mt-3 space-y-2"><textarea id="quarkCookieInput" class="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent" rows="3" placeholder="cookie字符串"></textarea><button onclick="saveQuarkManualLogin()" class="w-full bg-success text-white text-sm py-1.5 rounded-lg hover:bg-success/90">保存</button></div></div>\n' +
            '                </div>\n' +
            '                <div class="bg-white rounded-xl p-6 shadow-sm">\n' +
            '                    <div class="flex items-center gap-3 mb-4"><div class="w-10 h-10 bg-blue-500/10 rounded-full flex items-center justify-center"><i class="fa fa-cloud text-blue-500 text-lg"></i></div><div><h3 class="font-semibold text-dark">移动云盘</h3><p class="text-xs text-secondary">暂未实现</p></div></div>\n' +
            '                    <div class="flex flex-col items-center justify-center py-6 text-gray-400"><i class="fa fa-clock-o text-3xl mb-2"></i><p class="text-sm">扫码登录暂未实现</p><p class="text-xs mt-1">请使用手动输入Authorization方式</p></div>\n' +
            '                    <div class="mt-4 border-t pt-4"><button onclick="toggleManualInput(\'mcloud\')" class="text-xs text-blue-500 hover:text-blue-500/80 flex items-center gap-1"><i class="fa fa-keyboard-o"></i> 手动输入Authorization</button><div id="mcloud-manual-input" class="hidden mt-3 space-y-2"><input type="text" id="mcloudAuthInput" class="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent" placeholder="Authorization"><button onclick="saveMCloudManualLogin()" class="w-full bg-success text-white text-sm py-1.5 rounded-lg hover:bg-success/90">保存</button></div></div>\n' +
            '                </div>\n' +
            '            </div>\n' +
            '        </div>\n' +
            '        <div class="page-section" id="page-records">\n' +
            '            <h2 class="text-2xl font-bold text-dark mb-6 flex items-center gap-2"><i class="fa fa-list text-primary"></i> 解析记录</h2>\n' +
            '            <div class="bg-white rounded-xl p-6 shadow-sm">\n' +
            '                <div class="flex items-center justify-between mb-6"><div class="flex items-center gap-2"><button onclick="switchTab(\'success\')" id="tabSuccess" class="px-4 py-2 rounded-lg font-medium transition-all bg-success text-white"><i class="fa fa-check-circle mr-1"></i> 成功记录</button><button onclick="switchTab(\'failed\')" id="tabFailed" class="px-4 py-2 rounded-lg font-medium transition-all bg-gray-200 text-gray-600 hover:bg-gray-300"><i class="fa fa-times-circle mr-1"></i> 失败记录</button></div><button onclick="loadRecords()" class="bg-primary/10 text-primary px-4 py-2 rounded-lg hover:bg-primary/20 transition-all flex items-center gap-2"><i class="fa fa-refresh"></i> 刷新</button></div>\n' +
            '                <div id="recordsList" class="space-y-4"><div class="text-center py-8 text-secondary"><i class="fa fa-spinner fa-spin text-2xl mb-2"></i><p>加载中...</p></div></div>\n' +
            '            </div>\n' +
            '        </div>\n' +
            '        <div id="loginDetailModal" class="hidden fixed inset-0 bg-black/50 z-50 flex items-center justify-center">\n' +
            '            <div class="bg-white rounded-xl p-6 max-w-lg w-full mx-4 shadow-2xl">\n' +
            '                <div class="flex items-center justify-between mb-4"><h3 class="text-lg font-semibold text-dark" id="modalTitle">登录详情</h3><button onclick="closeLoginDetail()" class="text-secondary hover:text-dark"><i class="fa fa-times text-lg"></i></button></div>\n' +
            '                <div id="modalContent" class="space-y-3"></div>\n' +
            '                <div class="mt-6 flex justify-end"><button onclick="closeLoginDetail()" class="bg-gray-200 text-gray-600 px-4 py-2 rounded-lg hover:bg-gray-300 transition-all">关闭</button></div>\n' +
            '            </div>\n' +
            '        </div>\n' +
            '    </main>\n' +
            '    <script>\n' +
            '        let successRateChart = null;\n' +
            '        let statsChart = null;\n' +
            '        let currentTab = "success";\n' +
            '        let allRecords = { success: [], failed: [] };\n' +
            '        let currentPage = 1;\n' +
            '        let pageSize = 5;\n' +
            '        let guangyaQRInterval = null;\n' +
            '        let guangyaQRCountdownInterval = null;\n' +
            '        let currentDeviceId = null;\n' +
            '        let currentExpiresIn = 600;\n' +
            '        let loginStatusCache = {};\n' +
            '        function switchPage(page) {\n' +
            '            document.querySelectorAll(".page-section").forEach(el => el.classList.remove("active"));\n' +
            '            document.querySelectorAll(".sidebar-item").forEach(el => el.classList.remove("active"));\n' +
            '            document.getElementById("page-" + page).classList.add("active");\n' +
            '            document.getElementById("nav-" + page).classList.add("active");\n' +
            '            if (page === "dashboard") { loadStats(); initCharts(); }\n' +
            '            if (page === "qrlogin") { loadAllLoginStatus(); }\n' +
            '            if (page === "records") { loadRecords(); }\n' +
            '        }\n' +
            '        function showLoginDetail(platform) {\n' +
            '            const modal = document.getElementById("loginDetailModal");\n' +
            '            const title = document.getElementById("modalTitle");\n' +
            '            const content = document.getElementById("modalContent");\n' +
            '            const names = { guangya: "光鸭云盘", aliyun: "阿里云盘", uc: "UC网盘", quark: "夸克网盘", mcloud: "移动云盘" };\n' +
            '            title.textContent = names[platform] + " - 登录详情";\n' +
            '            const info = loginStatusCache[platform];\n' +
            '            if (info && info.logged_in) {\n' +
            '                let html = \'\';\n' +
            '                html += \'<div class="bg-gray-50 rounded-lg p-3 mb-3"><div class="text-xs text-secondary mb-1">登录状态</div><div class="text-sm font-semibold text-success"><i class="fa fa-check-circle mr-1"></i>已登录</div></div>\';\n' +
            '                html += \'<div class="bg-gray-50 rounded-lg p-3 mb-3"><div class="text-xs text-secondary mb-1">配置来源</div><div class="text-sm font-medium">\' + (info.source === "kv_default" ? "后台扫码配置" : info.source === "env_var" ? "环境变量配置" : info.source === "default_config" ? "扫码登录配置" : info.source) + \'</div></div>\';\n' +
            '                if (info.loginInfo) {\n' +
            '                    html += \'<div class="bg-gray-50 rounded-lg p-3 mb-3"><div class="text-xs text-secondary mb-2 font-medium">环境变量/存储配置</div>\';\n' +
            '                    if (platform === "guangya") {\n' +
            '                        if (info.loginInfo.access_token) { html += \'<div class="mb-2"><div class="text-xs text-secondary mb-1">access_token</div><div class="text-xs font-mono break-all bg-white p-2 rounded border max-h-24 overflow-auto">\' + (info.loginInfo.access_token.length > 50 ? info.loginInfo.access_token.substring(0, 50) + "..." : info.loginInfo.access_token) + \'</div></div>\'; }\n' +
            '                        if (info.loginInfo.refresh_token) { html += \'<div class="mb-2"><div class="text-xs text-secondary mb-1">refresh_token</div><div class="text-xs font-mono break-all bg-white p-2 rounded border max-h-24 overflow-auto">\' + (info.loginInfo.refresh_token.length > 50 ? info.loginInfo.refresh_token.substring(0, 50) + "..." : info.loginInfo.refresh_token) + \'</div></div>\'; }\n' +
            '                        if (info.loginInfo.device_id) { html += \'<div class="mb-2"><div class="text-xs text-secondary mb-1">device_id</div><div class="text-xs font-mono break-all bg-white p-2 rounded border">\' + info.loginInfo.device_id + \'</div></div>\'; }\n' +
            '                        if (info.loginInfo.token_expires_at) { const expDate = new Date(info.loginInfo.token_expires_at * 1000); html += \'<div class="mb-2"><div class="text-xs text-secondary mb-1">过期时间</div><div class="text-xs">\' + expDate.toLocaleString("zh-CN") + \'</div></div>\'; }\n' +
            '                        if (info.loginInfo.user_name) { html += \'<div class="mb-2"><div class="text-xs text-secondary mb-1">用户名</div><div class="text-xs">\' + info.loginInfo.user_name + \'</div></div>\'; }\n' +
            '                        if (info.loginInfo.user_id) { html += \'<div class="mb-2"><div class="text-xs text-secondary mb-1">用户ID</div><div class="text-xs font-mono">\' + info.loginInfo.user_id + \'</div></div>\'; }\n' +
            '                    } else if (platform === "aliyun") {\n' +
            '                        if (info.loginInfo.type) { html += \'<div class="mb-2"><div class="text-xs text-secondary mb-1">Token类型</div><div class="text-xs font-medium">\' + info.loginInfo.type + \'</div></div>\'; }\n' +
            '                        if (info.loginInfo.authorization) { html += \'<div class="mb-2"><div class="text-xs text-secondary mb-1">Authorization</div><div class="text-xs font-mono break-all bg-white p-2 rounded border max-h-24 overflow-auto">\' + (info.loginInfo.authorization.length > 50 ? info.loginInfo.authorization.substring(0, 50) + "..." : info.loginInfo.authorization) + \'</div></div>\'; }\n' +
            '                        if (info.loginInfo.refresh_token) { html += \'<div class="mb-2"><div class="text-xs text-secondary mb-1">Refresh Token</div><div class="text-xs font-mono break-all bg-white p-2 rounded border max-h-20 overflow-auto">\' + (info.loginInfo.refresh_token.length > 50 ? info.loginInfo.refresh_token.substring(0, 50) + "..." : info.loginInfo.refresh_token) + \'</div></div>\'; }\n' +
            '                    } else if (platform === "quark" || platform === "uc") {\n' +
            '                        if (info.loginInfo.cookie) { html += \'<div class="mb-2"><div class="text-xs text-secondary mb-1">Cookie</div><div class="text-xs font-mono break-all bg-white p-2 rounded border max-h-32 overflow-auto">\' + (info.loginInfo.cookie.length > 80 ? info.loginInfo.cookie.substring(0, 80) + "..." : info.loginInfo.cookie) + \'</div></div>\'; }\n' +
            '                    } else if (platform === "mcloud") {\n' +
            '                        if (info.loginInfo.authorization) { html += \'<div class="mb-2"><div class="text-xs text-secondary mb-1">Authorization</div><div class="text-xs font-mono break-all bg-white p-2 rounded border max-h-24 overflow-auto">\' + (info.loginInfo.authorization.length > 50 ? info.loginInfo.authorization.substring(0, 50) + "..." : info.loginInfo.authorization) + \'</div></div>\'; }\n' +
            '                        if (info.loginInfo.cookie) { html += \'<div class="mb-2"><div class="text-xs text-secondary mb-1">Cookie</div><div class="text-xs font-mono break-all bg-white p-2 rounded border max-h-24 overflow-auto">\' + (info.loginInfo.cookie.length > 80 ? info.loginInfo.cookie.substring(0, 80) + "..." : info.loginInfo.cookie) + \'</div></div>\'; }\n' +
            '                        if (info.loginInfo.phone) { html += \'<div class="mb-2"><div class="text-xs text-secondary mb-1">绑定手机号</div><div class="text-xs">\' + info.loginInfo.phone + \'</div></div>\'; }\n' +
            '                    }\n' +
            '                    html += \'</div>\';\n' +
            '                }\n' +
            '                content.innerHTML = html;\n' +
            '            } else { content.innerHTML = \'<div class="text-center py-8 text-secondary"><i class="fa fa-exclamation-circle text-3xl mb-2"></i><p>未登录或未配置</p></div>\'; }\n' +
            '            modal.classList.remove("hidden");\n' +
            '        }\n' +
            '        function closeLoginDetail() { document.getElementById("loginDetailModal").classList.add("hidden"); }\n' +
            '        async function loadAllLoginStatus() {\n' +
            '            try {\n' +
            '                const response = await fetch("/?action=login_status");\n' +
            '                const data = await response.json();\n' +
            '                if (data.success && data.data) {\n' +
            '                    loginStatusCache = data.data;\n' +
            '                    updateLoginCard("gy", data.data.guangya);\n' +
            '                    updateLoginCard("aliyun", data.data.aliyun);\n' +
            '                    updateLoginCard("quark", data.data.quark);\n' +
            '                    updateLoginCard("uc", data.data.uc);\n' +
            '                    updateLoginCard("mcloud", data.data.mcloud);\n' +
            '                }\n' +
            '            } catch (e) { console.error("加载登录状态失败:", e); }\n' +
            '        }\n' +
            '        function updateLoginCard(prefix, statusData) {\n' +
            '            const badge = document.getElementById(prefix + "-status-badge");\n' +
            '            const source = document.getElementById(prefix + "-status-source");\n' +
            '            const qrStatus = document.getElementById(prefix + "-qr-status");\n' +
            '            if (statusData.logged_in) {\n' +
            '                if (badge) { badge.textContent = "已登录"; badge.className = "px-2 py-1 rounded-full text-xs bg-success/10 text-success"; }\n' +
            '                if (source) { source.textContent = statusData.source === "kv_default" ? "后台扫码配置" : statusData.source === "env_var" ? "环境变量配置" : statusData.source === "default_config" ? "扫码登录配置" : statusData.source; }\n' +
            '                if (qrStatus) { qrStatus.textContent = "已登录 (" + (statusData.source === "kv_default" || statusData.source === "default_config" ? "扫码" : "环境变量") + ")"; qrStatus.className = "text-xs text-success"; }\n' +
            '            } else {\n' +
            '                if (badge) { badge.textContent = "未登录"; badge.className = "px-2 py-1 rounded-full text-xs bg-danger/10 text-danger"; }\n' +
            '                if (source) { source.textContent = "未配置"; }\n' +
            '                if (qrStatus) { qrStatus.textContent = "未登录"; qrStatus.className = "text-xs text-secondary"; }\n' +
            '            }\n' +
            '        }\n' +
            '        function toggleManualInput(prefix) { const el = document.getElementById(prefix + "-manual-input"); if (el) el.classList.toggle("hidden"); }\n' +
            '        document.addEventListener("DOMContentLoaded", function() { loadStats(); initCharts(); loadAllLoginStatus(); });\n' +
            '        async function loadStats() {\n' +
            '            try {\n' +
            '                const response = await fetch("/?action=get_stats");\n' +
            '                const data = await response.json();\n' +
            '                if (data.success) {\n' +
            '                    const stats = data.data;\n' +
            '                    document.getElementById("totalRequests").textContent = stats.total || 0;\n' +
            '                    document.getElementById("successRequests").textContent = stats.success || 0;\n' +
            '                    document.getElementById("failedRequests").textContent = stats.failed || 0;\n' +
            '                    document.getElementById("cachedRequests").textContent = stats.cached || 0;\n' +
            '                    document.getElementById("lastUpdate").textContent = new Date().toLocaleString("zh-CN");\n' +
            '                    const total = stats.total || 0;\n' +
            '                    document.getElementById("successRate").textContent = (total > 0 ? ((stats.success / total) * 100).toFixed(1) : "0.0") + "%";\n' +
            '                    document.getElementById("cacheRate").textContent = (total > 0 ? ((stats.cached / total) * 100).toFixed(1) : "0.0") + "%";\n' +
            '                    updateCharts(stats);\n' +
            '                }\n' +
            '            } catch (error) { console.error("加载统计数据失败:", error); }\n' +
            '        }\n' +
            '        function initCharts() {\n' +
            '            const successCtx = document.getElementById("successRateChart");\n' +
            '            if (!successCtx) return;\n' +
            '            successRateChart = new Chart(successCtx.getContext("2d"), { type: "doughnut", data: { labels: ["成功", "失败"], datasets: [{ data: [0, 0], backgroundColor: ["#10b981", "#ef4444"], borderWidth: 0 }] }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: "bottom" } } } });\n' +
            '            const statsCtx = document.getElementById("statsChart");\n' +
            '            if (!statsCtx) return;\n' +
            '            statsChart = new Chart(statsCtx.getContext("2d"), { type: "bar", data: { labels: ["总数", "成功", "失败", "缓存"], datasets: [{ label: "解析统计", data: [0, 0, 0, 0], backgroundColor: ["#3b82f6", "#10b981", "#ef4444", "#64748b"], borderRadius: 6 }] }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true } } } });\n' +
            '        }\n' +
            '        function updateCharts(stats) {\n' +
            '            if (successRateChart) { successRateChart.data.datasets[0].data = [stats.success || 0, stats.failed || 0]; successRateChart.update(); }\n' +
            '            if (statsChart) { statsChart.data.datasets[0].data = [stats.total || 0, stats.success || 0, stats.failed || 0, stats.cached || 0]; statsChart.update(); }\n' +
            '        }\n' +
            '        function switchTab(tab) {\n' +
            '            currentTab = tab; currentPage = 1;\n' +
            '            const tabSuccess = document.getElementById("tabSuccess");\n' +
            '            const tabFailed = document.getElementById("tabFailed");\n' +
            '            if (tab === "success") { tabSuccess.className = "px-4 py-2 rounded-lg font-medium transition-all bg-success text-white"; tabFailed.className = "px-4 py-2 rounded-lg font-medium transition-all bg-gray-200 text-gray-600 hover:bg-gray-300"; }\n' +
            '            else { tabSuccess.className = "px-4 py-2 rounded-lg font-medium transition-all bg-gray-200 text-gray-600 hover:bg-gray-300"; tabFailed.className = "px-4 py-2 rounded-lg font-medium transition-all bg-danger text-white"; }\n' +
            '            renderRecords();\n' +
            '        }\n' +
            '        async function loadRecords() {\n' +
            '            try {\n' +
            '                const response = await fetch("/?action=get_records");\n' +
            '                const data = await response.json();\n' +
            '                if (data.success) { allRecords = data.data; renderRecords(); } else { showRecordsError(data.msg); }\n' +
            '            } catch (error) { showRecordsError("加载失败"); }\n' +
            '        }\n' +
            '        function renderRecords() {\n' +
            '            const recordsList = document.getElementById("recordsList");\n' +
            '            const records = currentTab === "success" ? allRecords.success : allRecords.failed;\n' +
            '            if (records.length === 0) { recordsList.innerHTML = \'<div class="text-center py-12 text-secondary"><i class="fa fa-inbox text-4xl mb-4 opacity-50"></i><p class="text-lg">暂无\' + (currentTab === "success" ? "成功" : "失败") + \'记录</p></div>\'; return; }\n' +
            '            const totalPages = Math.ceil(records.length / pageSize);\n' +
            '            const paginatedRecords = records.slice((currentPage - 1) * pageSize, currentPage * pageSize);\n' +
            '            let html = \'\';\n' +
            '            paginatedRecords.forEach(function(record) {\n' +
            '                const timeStr = new Date(record.timestamp).toLocaleString("zh-CN");\n' +
            '                const statusClass = record.success ? "success" : "danger";\n' +
            '                const statusIcon = record.success ? "fa-check-circle" : "fa-times-circle";\n' +
            '                const statusText = record.success ? "解析成功" : "解析失败";\n' +
            '                html += \'<div class="bg-gray-50 rounded-lg p-4 hover:shadow-md transition-shadow border-l-4 border-\' + statusClass + \'">\';\n' +
            '                html += \'<div class="flex items-start justify-between mb-3"><div class="flex items-center gap-2"><i class="fa \' + statusIcon + \' text-\' + statusClass + \'"></i><span class="font-medium text-dark">\' + statusText + \'</span></div><span class="text-sm text-secondary">\' + timeStr + \'</span></div>\';\n' +
            '                html += \'<div class="space-y-2"><div class="bg-white rounded p-3"><div class="flex items-center gap-2 mb-2"><i class="fa fa-link text-primary"></i><span class="text-sm font-medium text-gray-700">解析链接：</span></div><div class="bg-gray-50 rounded p-2 text-sm break-all">\' + record.url + \'</div></div>\';\n' +
            '                if (record.pwd) html += \'<div class="bg-white rounded p-3"><div class="flex items-center gap-2 mb-2"><i class="fa fa-key text-warning"></i><span class="text-sm font-medium text-gray-700">分享密码：</span></div><div class="bg-gray-50 rounded p-2 text-sm font-mono">\' + record.pwd + \'</div></div>\';\n' +
            '                html += \'<div class="bg-white rounded p-3"><div class="flex items-center gap-2 mb-2"><i class="fa fa-info-circle text-secondary"></i><span class="text-sm font-medium text-gray-700">解析结果：</span></div><div class="space-y-1"><div class="flex items-center gap-2 text-sm"><span class="text-secondary">状态码：</span><span class="font-mono bg-gray-100 px-2 py-1 rounded">\' + record.code + \'</span></div><div class="text-sm text-gray-600">\' + record.msg + \'</div>\';\n' +
            '                if (record.data) html += \'<details class="mt-2"><summary class="cursor-pointer text-primary text-sm font-medium hover:text-primary/80 flex items-center gap-1"><i class="fa fa-code"></i> 查看详细数据</summary><pre class="bg-gray-900 text-green-400 p-3 rounded mt-2 text-xs overflow-x-auto">\' + JSON.stringify(record.data, null, 2) + \'</pre></details>\';\n' +
            '                html += \'</div></div></div></div>\';\n' +
            '            });\n' +
            '            if (totalPages > 1) {\n' +
            '                html += \'<div class="flex items-center justify-center mt-6 space-x-2">\';\n' +
            '                if (currentPage > 1) html += \'<button onclick="changePage(\' + (currentPage - 1) + \')" class="px-3 py-1 border border-gray-300 rounded-md hover:bg-gray-100"><i class="fa fa-chevron-left"></i></button>\';\n' +
            '                for (let i = 1; i <= totalPages; i++) { if (i === currentPage) html += \'<button class="px-3 py-1 bg-primary text-white rounded-md">\' + i + \'</button>\'; else html += \'<button onclick="changePage(\' + i + \')" class="px-3 py-1 border border-gray-300 rounded-md hover:bg-gray-100">\' + i + \'</button>\'; }\n' +
            '                if (currentPage < totalPages) html += \'<button onclick="changePage(\' + (currentPage + 1) + \')" class="px-3 py-1 border border-gray-300 rounded-md hover:bg-gray-100"><i class="fa fa-chevron-right"></i></button>\';\n' +
            '                html += \'</div>\';\n' +
            '            }\n' +
            '            recordsList.innerHTML = html;\n' +
            '        }\n' +
            '        function changePage(page) { currentPage = page; renderRecords(); }\n' +
            '        function showRecordsError(message) { document.getElementById("recordsList").innerHTML = \'<div class="text-center py-12 text-danger"><i class="fa fa-exclamation-triangle text-4xl mb-4"></i><p class="text-lg">\' + message + \'</p></div>\'; }\n' +
            '        async function startGuangyaQRLogin() {\n' +
            '            const btn = document.getElementById("guangyaQRButton");\n' +
            '            btn.disabled = true; btn.innerHTML = \'<i class="fa fa-spinner fa-spin"></i> 获取二维码...\';\n' +
            '            try {\n' +
            '                const response = await fetch("/?action=guangya_qrcode");\n' +
            '                const data = await response.json();\n' +
            '                if (data.success && data.data) {\n' +
            '                    currentDeviceId = data.data.device_id; currentExpiresIn = data.data.expires_in || 600;\n' +
            '                    document.getElementById("gy-qr-container").classList.add("hidden");\n' +
            '                    document.getElementById("guangyaQRCode").classList.remove("hidden");\n' +
            '                    document.getElementById("guangyaLoginSuccess").classList.add("hidden");\n' +
            '                    document.getElementById("qrcodeImage").innerHTML = \'<img src="https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=\' + encodeURIComponent(data.data.verification_uri_complete) + \'" alt="QR Code" class="mx-auto">\';\n' +
            '                    document.getElementById("userCodeDisplay").textContent = data.data.user_code;\n' +
            '                    startQRCountdown(currentExpiresIn);\n' +
            '                    startQRPoll(data.data.device_id, data.data.interval || 5);\n' +
            '                } else { alert("获取二维码失败: " + (data.msg || "未知错误")); btn.disabled = false; btn.innerHTML = \'<i class="fa fa-qrcode"></i> 扫码登录\'; }\n' +
            '            } catch (error) { alert("获取二维码失败，请重试"); btn.disabled = false; btn.innerHTML = \'<i class="fa fa-qrcode"></i> 扫码登录\'; }\n' +
            '        }\n' +
            '        function startQRCountdown(expiresIn) {\n' +
            '            let remaining = expiresIn;\n' +
            '            if (guangyaQRCountdownInterval) clearInterval(guangyaQRCountdownInterval);\n' +
            '            guangyaQRCountdownInterval = setInterval(() => {\n' +
            '                remaining--;\n' +
            '                document.getElementById("qrCountdown").style.width = (remaining / expiresIn) * 100 + "%";\n' +
            '                document.getElementById("qrCountdownText").textContent = remaining + "s";\n' +
            '                if (remaining <= 0) { clearInterval(guangyaQRCountdownInterval); cancelGuangyaQRLogin(); alert("二维码已过期，请重新获取"); }\n' +
            '            }, 1000);\n' +
            '        }\n' +
            '        function startQRPoll(deviceId, interval) {\n' +
            '            if (guangyaQRInterval) clearInterval(guangyaQRInterval);\n' +
            '            document.getElementById("guangyaQRStatus").textContent = "等待扫码...";\n' +
            '            guangyaQRInterval = setInterval(async () => {\n' +
            '                try {\n' +
            '                    const response = await fetch("/?action=guangya_qr_poll&device_id=" + deviceId);\n' +
            '                    const data = await response.json();\n' +
            '                    if (data.success && data.data) {\n' +
            '                        if (data.data.status === "confirmed") {\n' +
            '                            clearInterval(guangyaQRInterval); clearInterval(guangyaQRCountdownInterval);\n' +
            '                            document.getElementById("guangyaQRStatus").innerHTML = \'<span class="text-success font-semibold">扫码成功！</span>\';\n' +
            '                            await saveGuangyaLogin(data.data);\n' +
            '                            setTimeout(() => { document.getElementById("guangyaQRCode").classList.add("hidden"); document.getElementById("guangyaLoginSuccess").classList.remove("hidden"); loadAllLoginStatus(); }, 1000);\n' +
            '                            return;\n' +
            '                        } else if (data.data.status === "denied") {\n' +
            '                            clearInterval(guangyaQRInterval); clearInterval(guangyaQRCountdownInterval);\n' +
            '                            document.getElementById("guangyaQRStatus").innerHTML = \'<span class="text-danger font-semibold">扫码被拒绝</span>\';\n' +
            '                            setTimeout(cancelGuangyaQRLogin, 2000); return;\n' +
            '                        } else if (data.data.status === "expired") {\n' +
            '                            clearInterval(guangyaQRInterval); clearInterval(guangyaQRCountdownInterval);\n' +
            '                            document.getElementById("guangyaQRStatus").innerHTML = \'<span class="text-danger font-semibold">二维码已过期</span>\';\n' +
            '                            setTimeout(cancelGuangyaQRLogin, 2000); return;\n' +
            '                        }\n' +
            '                    }\n' +
            '                } catch (error) { console.error("轮询失败:", error); }\n' +
            '            }, interval * 1000);\n' +
            '        }\n' +
            '        async function saveGuangyaLogin(loginData) {\n' +
            '            try {\n' +
            '                const params = new URLSearchParams();\n' +
            '                params.append("access_token", loginData.access_token);\n' +
            '                if (loginData.refresh_token) params.append("refresh_token", loginData.refresh_token);\n' +
            '                if (loginData.expires_in) params.append("expires_in", loginData.expires_in);\n' +
            '                if (loginData.device_id) params.append("device_id", loginData.device_id);\n' +
            '                const response = await fetch("/?action=guangya_qr_save&" + params.toString());\n' +
            '                const data = await response.json();\n' +
            '                if (data.success) console.log("登录信息已保存到默认配置");\n' +
            '                else console.error("保存登录信息失败:", data.msg);\n' +
            '            } catch (error) { console.error("保存登录信息失败:", error); }\n' +
            '        }\n' +
            '        function cancelGuangyaQRLogin() {\n' +
            '            if (guangyaQRInterval) { clearInterval(guangyaQRInterval); guangyaQRInterval = null; }\n' +
            '            if (guangyaQRCountdownInterval) { clearInterval(guangyaQRCountdownInterval); guangyaQRCountdownInterval = null; }\n' +
            '            currentDeviceId = null;\n' +
            '            document.getElementById("gy-qr-container").classList.remove("hidden");\n' +
            '            document.getElementById("guangyaQRCode").classList.add("hidden");\n' +
            '            document.getElementById("guangyaLoginSuccess").classList.add("hidden");\n' +
            '            document.getElementById("guangyaQRButton").disabled = false;\n' +
            '            document.getElementById("guangyaQRButton").innerHTML = \'<i class="fa fa-qrcode"></i> 扫码登录\';\n' +
            '            document.getElementById("qrcodeImage").innerHTML = "";\n' +
            '            document.getElementById("userCodeDisplay").textContent = "";\n' +
            '            document.getElementById("qrCountdown").style.width = "100%";\n' +
            '            document.getElementById("qrCountdownText").textContent = "600s";\n' +
            '            document.getElementById("guangyaQRStatus").textContent = "等待扫码...";\n' +
            '        }\n' +
            '        async function saveGuangyaManualLogin() {\n' +
            '            const accessToken = document.getElementById("guangyaAccessToken").value.trim();\n' +
            '            const refreshToken = document.getElementById("guangyaRefreshToken").value.trim();\n' +
            '            if (!accessToken) { alert("请输入access_token"); return; }\n' +
            '            try {\n' +
            '                const params = new URLSearchParams();\n' +
            '                params.append("access_token", accessToken);\n' +
            '                if (refreshToken) params.append("refresh_token", refreshToken);\n' +
            '                params.append("expires_in", "604800");\n' +
            '                const response = await fetch("/?action=guangya_qr_save&" + params.toString());\n' +
            '                const data = await response.json();\n' +
            '                if (data.success) { alert("登录信息已保存！"); loadAllLoginStatus(); document.getElementById("gy-manual-input").classList.add("hidden"); document.getElementById("guangyaAccessToken").value = ""; document.getElementById("guangyaRefreshToken").value = ""; }\n' +
            '                else { alert("保存失败: " + (data.msg || "未知错误")); }\n' +
            '            } catch (error) { alert("保存失败，请重试"); }\n' +
            '        }\n' +
            '        // ==================== 阿里云盘扫码登录 ====================\n' +
            '        let aliyunQRInterval = null; let aliyunCountdownInterval = null; let aliyunCurrentT = null; let aliyunCurrentCk = null; let aliyunCurrentCsrfToken = null; let aliyunCurrentUmidToken = null; let aliyunLoginDone = false;\n' +
            '        async function startAliyunQRLoginCard() {\n' +
            '            aliyunLoginDone = false;\n' +
            '            const btn = document.getElementById("aliyunQRButtonCard");\n' +
            '            btn.disabled = true; btn.innerHTML = \'<i class="fa fa-spinner fa-spin"></i> 获取二维码...\';\n' +
            '            try {\n' +
            '                const response = await fetch("/?action=aliyun_qrcode");\n' +
            '                const data = await response.json();\n' +
            '                if (data.success && data.data) {\n' +
            '                    aliyunCurrentT = data.data.t;\n' +
            '                    aliyunCurrentCk = data.data.ck;\n' +
            '                    aliyunCurrentCsrfToken = data.data.csrf_token;\n' +
            '                    aliyunCurrentUmidToken = data.data.umid_token;\n' +
            '                    document.getElementById("aliyun-qr-card-container").classList.add("hidden");\n' +
            '                    document.getElementById("aliyunQRCodeCard").classList.remove("hidden");\n' +
            '                    document.getElementById("aliyunLoginSuccessCard").classList.add("hidden");\n' +
            '                    document.getElementById("aliyunQrcodeImageCard").innerHTML = \'<img src="https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=\' + encodeURIComponent(data.data.qr_code_url) + \'" alt="QR Code" class="mx-auto">\';\n' +
            '                    startAliyunCountdownCard(600);\n' +
            '                    startAliyunQRPollCard(data.data.device_id, 3);\n' +
            '                } else { alert("获取二维码失败: " + (data.msg || "未知错误")); btn.disabled = false; btn.innerHTML = \'<i class="fa fa-qrcode"></i> 扫码登录\'; }\n' +
            '            } catch (error) { alert("获取二维码失败，请重试"); btn.disabled = false; btn.innerHTML = \'<i class="fa fa-qrcode"></i> 扫码登录\'; }\n' +
            '        }\n' +
            '        function startAliyunCountdownCard(expiresIn) {\n' +
            '            let remaining = expiresIn;\n' +
            '            if (aliyunCountdownInterval) clearInterval(aliyunCountdownInterval);\n' +
            '            aliyunCountdownInterval = setInterval(() => {\n' +
            '                remaining--;\n' +
            '                document.getElementById("aliyunCountdownCard").style.width = (remaining / expiresIn) * 100 + "%";\n' +
            '                document.getElementById("aliyunCountdownTextCard").textContent = remaining + "s";\n' +
            '                if (remaining <= 0) { clearInterval(aliyunCountdownInterval); cancelAliyunQRLoginCard(); alert("二维码已过期，请重新获取"); }\n' +
            '            }, 1000);\n' +
            '        }\n' +
            '        function startAliyunQRPollCard(deviceId, interval) {\n' +
            '            if (aliyunQRInterval) clearInterval(aliyunQRInterval);\n' +
            '            document.getElementById("aliyunQRStatusCard").textContent = "等待扫码...";\n' +
            '            aliyunQRInterval = setInterval(async () => {\n' +
            '                if (aliyunLoginDone) return;\n' +
            '                try {\n' +
            '                    const pollParams = new URLSearchParams();\n' +
            '                    pollParams.append("t", aliyunCurrentT);\n' +
            '                    pollParams.append("ck", aliyunCurrentCk);\n' +
            '                    pollParams.append("csrfToken", aliyunCurrentCsrfToken);\n' +
            '                    pollParams.append("umidToken", aliyunCurrentUmidToken);\n' +
            '                    const response = await fetch("/?action=aliyun_qr_poll&" + pollParams.toString());\n' +
            '                    const data = await response.json();\n' +
            '                    if (data.success && data.data) {\n' +
            '                        if (data.data.status === "confirmed") {\n' +
            '                            aliyunLoginDone = true;\n' +
            '                            clearInterval(aliyunQRInterval); clearInterval(aliyunCountdownInterval);\n' +
            '                            document.getElementById("aliyunQRStatusCard").innerHTML = \'<span class="text-success font-semibold">扫码成功！</span>\';\n' +
            '                            if (data.data.authorization) {\n' +
            '                                await saveAliyunLogin(data.data.authorization);\n' +
            '                            } else {\n' +
            '                                await saveAliyunLogin(null, aliyunCurrentCk, aliyunCurrentLgToken);\n' +
            '                            }\n' +
            '                            setTimeout(() => { document.getElementById("aliyunQRCodeCard").classList.add("hidden"); document.getElementById("aliyunLoginSuccessCard").classList.remove("hidden"); loadAllLoginStatus(); }, 1000);\n' +
            '                            return;\n' +
            '                        } else if (data.data.status === "scaned") {\n' +
            '                            document.getElementById("aliyunQRStatusCard").innerHTML = \'<span class="text-warning font-semibold">已扫码，等待确认...</span>\';\n' +
            '                        } else if (data.data.status === "expired") {\n' +
            '                            clearInterval(aliyunQRInterval); clearInterval(aliyunCountdownInterval);\n' +
            '                            document.getElementById("aliyunQRStatusCard").innerHTML = \'<span class="text-danger font-semibold">二维码已过期</span>\';\n' +
            '                            setTimeout(cancelAliyunQRLoginCard, 2000); return;\n' +
            '                        }\n' +
            '                    } else if (!data.success) {\n' +
            '                        console.error("轮询失败:", data.msg);\n' +
            '                    }\n' +
            '                } catch (error) { console.error("轮询失败:", error); }\n' +
            '            }, interval * 1000);\n' +
            '        }\n' +
            '        function cancelAliyunQRLoginCard() {\n' +
            '            if (aliyunQRInterval) { clearInterval(aliyunQRInterval); aliyunQRInterval = null; }\n' +
            '            if (aliyunCountdownInterval) { clearInterval(aliyunCountdownInterval); aliyunCountdownInterval = null; }\n' +
            '            aliyunCurrentT = null;\n' +
            '            aliyunCurrentCk = null;\n' +
            '            aliyunCurrentCsrfToken = null;\n' +
            '            aliyunCurrentUmidToken = null;\n' +
            '            document.getElementById("aliyun-qr-card-container").classList.remove("hidden");\n' +
            '            document.getElementById("aliyunQRCodeCard").classList.add("hidden");\n' +
            '            document.getElementById("aliyunLoginSuccessCard").classList.add("hidden");\n' +
            '            document.getElementById("aliyunQRButtonCard").disabled = false;\n' +
            '            document.getElementById("aliyunQRButtonCard").innerHTML = \'<i class="fa fa-qrcode"></i> 扫码登录\';\n' +
            '            document.getElementById("aliyunQrcodeImageCard").innerHTML = "";\n' +
            '            document.getElementById("aliyunCountdownCard").style.width = "100%";\n' +
            '            document.getElementById("aliyunCountdownTextCard").textContent = "600s";\n' +
            '            document.getElementById("aliyunQRStatusCard").textContent = "等待扫码...";\n' +
            '        }\n' +
            '        async function saveAliyunLogin(authorization, ck, lgToken) {\n' +
            '            try {\n' +
            '                const params = new URLSearchParams();\n' +
            '                if (authorization) params.append("authorization", authorization);\n' +
            '                if (ck) params.append("ck", ck);\n' +
            '                if (lgToken) params.append("lgToken", lgToken);\n' +
            '                const response = await fetch("/?action=aliyun_qr_save&" + params.toString());\n' +
            '                const data = await response.json();\n' +
            '                if (data.success) console.log("阿里云盘登录信息已保存到默认配置");\n' +
            '                else console.error("保存登录信息失败:", data.msg);\n' +
            '            } catch (error) { console.error("保存登录信息失败:", error); }\n' +
            '        }\n' +
            '        function toggleAliyunManualInput() {\n' +
            '            const el = document.getElementById("aliyun-manual-input-card");\n' +
            '            el.classList.toggle("hidden");\n' +
            '        }\n' +
            '        async function saveAliyunManualLogin() {\n' +
            '            const auth = document.getElementById("aliyunAuthCard").value.trim();\n' +
            '            if (!auth) { alert("请输入Authorization"); return; }\n' +
            '            try {\n' +
            '                const response = await fetch("/?action=aliyun_qr_save&authorization=" + encodeURIComponent(auth));\n' +
            '                const data = await response.json();\n' +
            '                if (data.success) { alert("保存成功！"); loadAllLoginStatus(); document.getElementById("aliyun-manual-input-card").classList.add("hidden"); document.getElementById("aliyunAuthCard").value = ""; }\n' +
            '                else { alert("保存失败: " + (data.msg || "未知错误")); }\n' +
            '            } catch (error) { alert("保存失败，请重试"); }\n' +
            '        }\n' +
            '        // ==================== UC网盘扫码登录 ====================\n' +
            '        let ucQRInterval = null; let ucCountdownInterval = null; let ucCurrentToken = null;\n' +
            '        async function startUCQRLogin() {\n' +
            '            const btn = document.getElementById("ucQRButton");\n' +
            '            btn.disabled = true; btn.innerHTML = \'<i class="fa fa-spinner fa-spin"></i> 获取二维码...\';\n' +
            '            try {\n' +
            '                const resp = await fetch("/?action=uc_qrcode"); const data = await resp.json();\n' +
            '                if (data.success && data.data) {\n' +
            '                    ucCurrentToken = data.data.token;\n' +
            '                    document.getElementById("uc-qr-container").classList.add("hidden");\n' +
            '                    document.getElementById("ucQRCode").classList.remove("hidden");\n' +
            '                    document.getElementById("ucLoginSuccess").classList.add("hidden");\n' +
            '                    document.getElementById("ucQrcodeImage").innerHTML = \'<img src="https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=\' + encodeURIComponent(data.data.qr_url) + \'" alt="QR" class="mx-auto">\';\n' +
            '                    startGenericCountdown("ucCountdown", "ucCountdownText", data.data.expires_in || 600, function() { cancelUCQRLogin(); alert("二维码已过期"); });\n' +
            '                    ucQRInterval = setInterval(async () => {\n' +
            '                        try {\n' +
            '                            const r = await fetch("/?action=uc_qr_poll&token=" + ucCurrentToken); const d = await r.json();\n' +
            '                            if (d.success && d.data) {\n' +
            '                                if (d.data.status === "confirmed") {\n' +
            '                                    clearInterval(ucQRInterval); clearInterval(ucCountdownInterval);\n' +
            '                                    document.getElementById("ucQRStatus").innerHTML = \'<span class="text-success font-semibold">扫码成功！</span>\';\n' +
            '                                    await fetch("/?action=uc_qr_save&cookie=" + encodeURIComponent("ticket=" + d.data.ticket));\n' +
            '                                    setTimeout(() => { document.getElementById("ucQRCode").classList.add("hidden"); document.getElementById("ucLoginSuccess").classList.remove("hidden"); loadAllLoginStatus(); }, 1000);\n' +
            '                                } else if (d.data.status === "expired") {\n' +
            '                                    clearInterval(ucQRInterval); clearInterval(ucCountdownInterval); document.getElementById("ucQRStatus").innerHTML = \'<span class="text-danger font-semibold">已过期</span>\'; setTimeout(cancelUCQRLogin, 2000);\n' +
            '                                } else { document.getElementById("ucQRStatus").textContent = d.data.status === "scanned" ? "已扫码，等待确认..." : "等待扫码..."; }\n' +
            '                            }\n' +
            '                        } catch (e) { console.error("UC轮询失败:", e); }\n' +
            '                    }, (data.data.interval || 3) * 1000);\n' +
            '                } else { alert("获取二维码失败: " + (data.msg || "未知错误")); btn.disabled = false; btn.innerHTML = \'<i class="fa fa-qrcode"></i> 扫码登录\'; }\n' +
            '            } catch (e) { alert("获取二维码失败"); btn.disabled = false; btn.innerHTML = \'<i class="fa fa-qrcode"></i> 扫码登录\'; }\n' +
            '        }\n' +
            '        function cancelUCQRLogin() {\n' +
            '            if (ucQRInterval) { clearInterval(ucQRInterval); ucQRInterval = null; } if (ucCountdownInterval) { clearInterval(ucCountdownInterval); ucCountdownInterval = null; } ucCurrentToken = null;\n' +
            '            document.getElementById("uc-qr-container").classList.remove("hidden"); document.getElementById("ucQRCode").classList.add("hidden"); document.getElementById("ucLoginSuccess").classList.add("hidden");\n' +
            '            document.getElementById("ucQRButton").disabled = false; document.getElementById("ucQRButton").innerHTML = \'<i class="fa fa-qrcode"></i> 扫码登录\';\n' +
            '            document.getElementById("ucQrcodeImage").innerHTML = ""; document.getElementById("ucCountdown").style.width = "100%"; document.getElementById("ucCountdownText").textContent = "600s"; document.getElementById("ucQRStatus").textContent = "等待扫码...";\n' +
            '        }\n' +
            '        async function saveUCManualLogin() {\n' +
            '            const cookie = document.getElementById("ucCookieInput").value.trim(); if (!cookie) { alert("请输入Cookie"); return; }\n' +
            '            try { const r = await fetch("/?action=uc_qr_save&cookie=" + encodeURIComponent(cookie)); const d = await r.json(); if (d.success) { alert("保存成功！"); loadAllLoginStatus(); document.getElementById("uc-manual-input").classList.add("hidden"); document.getElementById("ucCookieInput").value = ""; } else { alert("保存失败: " + d.msg); } } catch (e) { alert("保存失败"); }\n' +
            '        }\n' +
            '        // ==================== 联通云盘扫码登录 ====================\n' +
            '        let unicomQRInterval = null; let unicomCountdownInterval = null; let unicomCurrentUuid = null;\n' +
            '        async function startUnicomQRLogin() {\n' +
            '            const btn = document.getElementById("unicomQRButton");\n' +
            '            btn.disabled = true; btn.innerHTML = \'<i class="fa fa-spinner fa-spin"></i> 获取二维码...\';\n' +
            '            try {\n' +
            '                const resp = await fetch("/?action=unicom_qrcode"); const data = await resp.json();\n' +
            '                if (data.success && data.data) {\n' +
            '                    unicomCurrentUuid = data.data.uuid;\n' +
            '                    document.getElementById("unicom-qr-container").classList.add("hidden");\n' +
            '                    document.getElementById("unicomQRCode").classList.remove("hidden");\n' +
            '                    document.getElementById("unicomLoginSuccess").classList.add("hidden");\n' +
            '                    document.getElementById("unicomQrcodeImage").innerHTML = \'<img src="data:image/png;base64,\' + data.data.qr_image + \'" alt="QR" class="mx-auto" style="max-width:180px;">\';\n' +
            '                    startGenericCountdown("unicomCountdown", "unicomCountdownText", data.data.expires_in || 300, function() { cancelUnicomQRLogin(); alert("二维码已过期"); });\n' +
            '                    unicomQRInterval = setInterval(async () => {\n' +
            '                        try {\n' +
            '                            const r = await fetch("/?action=unicom_qr_poll&uuid=" + unicomCurrentUuid); const d = await r.json();\n' +
            '                            if (d.success && d.data) {\n' +
            '                                if (d.data.status === "confirmed") {\n' +
            '                                    clearInterval(unicomQRInterval); clearInterval(unicomCountdownInterval);\n' +
            '                                    document.getElementById("unicomQRStatus").innerHTML = \'<span class="text-success font-semibold">扫码成功！</span>\';\n' +
            '                                    let saveUrl = "/?action=unicom_qr_save&at=" + encodeURIComponent(d.data.at); if (d.data.rt) saveUrl += "&rt=" + encodeURIComponent(d.data.rt);\n' +
            '                                    await fetch(saveUrl);\n' +
            '                                    setTimeout(() => { document.getElementById("unicomQRCode").classList.add("hidden"); document.getElementById("unicomLoginSuccess").classList.remove("hidden"); loadAllLoginStatus(); }, 1000);\n' +
            '                                } else if (d.data.status === "expired") {\n' +
            '                                    clearInterval(unicomQRInterval); clearInterval(unicomCountdownInterval); document.getElementById("unicomQRStatus").innerHTML = \'<span class="text-danger font-semibold">已过期</span>\'; setTimeout(cancelUnicomQRLogin, 2000);\n' +
            '                                } else { document.getElementById("unicomQRStatus").textContent = d.data.status === "scanned" ? "已扫码，等待确认..." : "等待扫码..."; }\n' +
            '                            }\n' +
            '                        } catch (e) { console.error("联通轮询失败:", e); }\n' +
            '                    }, (data.data.interval || 3) * 1000);\n' +
            '                } else { alert("获取二维码失败: " + (data.msg || "未知错误")); btn.disabled = false; btn.innerHTML = \'<i class="fa fa-qrcode"></i> 扫码登录\'; }\n' +
            '            } catch (e) { alert("获取二维码失败"); btn.disabled = false; btn.innerHTML = \'<i class="fa fa-qrcode"></i> 扫码登录\'; }\n' +
            '        }\n' +
            '        function cancelUnicomQRLogin() {\n' +
            '            if (unicomQRInterval) { clearInterval(unicomQRInterval); unicomQRInterval = null; } if (unicomCountdownInterval) { clearInterval(unicomCountdownInterval); unicomCountdownInterval = null; } unicomCurrentUuid = null;\n' +
            '            document.getElementById("unicom-qr-container").classList.remove("hidden"); document.getElementById("unicomQRCode").classList.add("hidden"); document.getElementById("unicomLoginSuccess").classList.add("hidden");\n' +
            '            document.getElementById("unicomQRButton").disabled = false; document.getElementById("unicomQRButton").innerHTML = \'<i class="fa fa-qrcode"></i> 扫码登录\';\n' +
            '            document.getElementById("unicomQrcodeImage").innerHTML = ""; document.getElementById("unicomCountdown").style.width = "100%"; document.getElementById("unicomCountdownText").textContent = "300s"; document.getElementById("unicomQRStatus").textContent = "等待扫码...";\n' +
            '        }\n' +
            '        async function saveUnicomManualLogin() {\n' +
            '            const at = document.getElementById("unicomAtInput").value.trim(); if (!at) { alert("请输入access_token"); return; }\n' +
            '            const rt = document.getElementById("unicomRtInput").value.trim();\n' +
            '            try { let url = "/?action=unicom_qr_save&at=" + encodeURIComponent(at); if (rt) url += "&rt=" + encodeURIComponent(rt); const r = await fetch(url); const d = await r.json(); if (d.success) { alert("保存成功！"); loadAllLoginStatus(); document.getElementById("unicom-manual-input").classList.add("hidden"); } else { alert("保存失败: " + d.msg); } } catch (e) { alert("保存失败"); }\n' +
            '        }\n' +
            '        // ==================== 夸克网盘扫码登录 ====================\n' +
            '        let quarkQRInterval = null; let quarkCountdownInterval = null; let quarkCurrentToken = null;\n' +
            '        async function startQuarkQRLogin() {\n' +
            '            const btn = document.getElementById("quarkQRButton");\n' +
            '            btn.disabled = true; btn.innerHTML = \'<i class="fa fa-spinner fa-spin"></i> 获取二维码...\';\n' +
            '            try {\n' +
            '                const resp = await fetch("/?action=quark_qrcode"); const data = await resp.json();\n' +
            '                if (data.success && data.data) {\n' +
            '                    quarkCurrentToken = data.data.token;\n' +
            '                    document.getElementById("quark-qr-container").classList.add("hidden");\n' +
            '                    document.getElementById("quarkQRCode").classList.remove("hidden");\n' +
            '                    document.getElementById("quarkLoginSuccess").classList.add("hidden");\n' +
            '                    document.getElementById("quarkQrcodeImage").innerHTML = \'<img src="https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=\' + encodeURIComponent(data.data.qr_url) + \'" alt="QR" class="mx-auto">\';\n' +
            '                    startGenericCountdown("quarkCountdown", "quarkCountdownText", data.data.expires_in || 600, function() { cancelQuarkQRLogin(); alert("二维码已过期"); });\n' +
            '                    quarkQRInterval = setInterval(async () => {\n' +
            '                        try {\n' +
            '                            const r = await fetch("/?action=quark_qr_poll&token=" + quarkCurrentToken); const d = await r.json();\n' +
            '                            if (d.success && d.data) {\n' +
            '                                if (d.data.status === "confirmed") {\n' +
            '                                    clearInterval(quarkQRInterval); clearInterval(quarkCountdownInterval);\n' +
            '                                    document.getElementById("quarkQRStatus").innerHTML = \'<span class="text-success font-semibold">扫码成功！</span>\';\n' +
            '                                    await fetch("/?action=quark_qr_save&cookie=" + encodeURIComponent("ticket=" + d.data.ticket));\n' +
            '                                    setTimeout(() => { document.getElementById("quarkQRCode").classList.add("hidden"); document.getElementById("quarkLoginSuccess").classList.remove("hidden"); loadAllLoginStatus(); }, 1000);\n' +
            '                                } else if (d.data.status === "expired") {\n' +
            '                                    clearInterval(quarkQRInterval); clearInterval(quarkCountdownInterval); document.getElementById("quarkQRStatus").innerHTML = \'<span class="text-danger font-semibold">已过期</span>\'; setTimeout(cancelQuarkQRLogin, 2000);\n' +
            '                                } else { document.getElementById("quarkQRStatus").textContent = "等待扫码..."; }\n' +
            '                            }\n' +
            '                        } catch (e) { console.error("夸克轮询失败:", e); }\n' +
            '                    }, (data.data.interval || 3) * 1000);\n' +
            '                } else { alert("获取二维码失败: " + (data.msg || "未知错误")); btn.disabled = false; btn.innerHTML = \'<i class="fa fa-qrcode"></i> 扫码登录\'; }\n' +
            '            } catch (e) { alert("获取二维码失败"); btn.disabled = false; btn.innerHTML = \'<i class="fa fa-qrcode"></i> 扫码登录\'; }\n' +
            '        }\n' +
            '        function cancelQuarkQRLogin() {\n' +
            '            if (quarkQRInterval) { clearInterval(quarkQRInterval); quarkQRInterval = null; } if (quarkCountdownInterval) { clearInterval(quarkCountdownInterval); quarkCountdownInterval = null; } quarkCurrentToken = null;\n' +
            '            document.getElementById("quark-qr-container").classList.remove("hidden"); document.getElementById("quarkQRCode").classList.add("hidden"); document.getElementById("quarkLoginSuccess").classList.add("hidden");\n' +
            '            document.getElementById("quarkQRButton").disabled = false; document.getElementById("quarkQRButton").innerHTML = \'<i class="fa fa-qrcode"></i> 扫码登录\';\n' +
            '            document.getElementById("quarkQrcodeImage").innerHTML = ""; document.getElementById("quarkCountdown").style.width = "100%"; document.getElementById("quarkCountdownText").textContent = "600s"; document.getElementById("quarkQRStatus").textContent = "等待扫码...";\n' +
            '        }\n' +
            '        async function saveQuarkManualLogin() {\n' +
            '            const cookie = document.getElementById("quarkCookieInput").value.trim(); if (!cookie) { alert("请输入Cookie"); return; }\n' +
            '            try { const r = await fetch("/?action=quark_qr_save&cookie=" + encodeURIComponent(cookie)); const d = await r.json(); if (d.success) { alert("保存成功！"); loadAllLoginStatus(); document.getElementById("quark-manual-input").classList.add("hidden"); document.getElementById("quarkCookieInput").value = ""; } else { alert("保存失败: " + d.msg); } } catch (e) { alert("保存失败"); }\n' +
            '        }\n' +
            '        // ==================== 腾讯微云扫码登录 ====================\n' +
            '        let weiyunQRInterval = null; let weiyunCountdownInterval = null; let weiyunCurrentUuid = null;\n' +
            '        async function startWeiyunQRLogin() {\n' +
            '            const btn = document.getElementById("weiyunQRButton");\n' +
            '            btn.disabled = true; btn.innerHTML = \'<i class="fa fa-spinner fa-spin"></i> 获取二维码...\';\n' +
            '            try {\n' +
            '                const resp = await fetch("/?action=weiyun_qrcode"); const data = await resp.json();\n' +
            '                if (data.success && data.data) {\n' +
            '                    weiyunCurrentUuid = data.data.uuid;\n' +
            '                    document.getElementById("weiyun-qr-container").classList.add("hidden");\n' +
            '                    document.getElementById("weiyunQRCode").classList.remove("hidden");\n' +
            '                    document.getElementById("weiyunLoginSuccess").classList.add("hidden");\n' +
            '                    document.getElementById("weiyunQrcodeImage").innerHTML = \'<img src="\' + data.data.qr_image_url + \'" alt="QR" class="mx-auto" style="max-width:180px;">\';\n' +
            '                    startGenericCountdown("weiyunCountdown", "weiyunCountdownText", data.data.expires_in || 300, function() { cancelWeiyunQRLogin(); alert("二维码已过期"); });\n' +
            '                    weiyunQRInterval = setInterval(async () => {\n' +
            '                        try {\n' +
            '                            const r = await fetch("/?action=weiyun_qr_poll&uuid=" + weiyunCurrentUuid); const d = await r.json();\n' +
            '                            if (d.success && d.data) {\n' +
            '                                if (d.data.status === "confirmed") {\n' +
            '                                    clearInterval(weiyunQRInterval); clearInterval(weiyunCountdownInterval);\n' +
            '                                    document.getElementById("weiyunQRStatus").innerHTML = \'<span class="text-success font-semibold">扫码成功！</span>\';\n' +
            '                                    await fetch("/?action=weiyun_qr_save&cookie=" + encodeURIComponent("auth_code=" + d.data.auth_code));\n' +
            '                                    setTimeout(() => { document.getElementById("weiyunQRCode").classList.add("hidden"); document.getElementById("weiyunLoginSuccess").classList.remove("hidden"); loadAllLoginStatus(); }, 1000);\n' +
            '                                } else if (d.data.status === "expired") {\n' +
            '                                    clearInterval(weiyunQRInterval); clearInterval(weiyunCountdownInterval); document.getElementById("weiyunQRStatus").innerHTML = \'<span class="text-danger font-semibold">已过期</span>\'; setTimeout(cancelWeiyunQRLogin, 2000);\n' +
            '                                } else { document.getElementById("weiyunQRStatus").textContent = d.data.status === "scanned" ? "已扫码，等待确认..." : "等待扫码..."; }\n' +
            '                            }\n' +
            '                        } catch (e) { console.error("微云轮询失败:", e); }\n' +
            '                    }, (data.data.interval || 3) * 1000);\n' +
            '                } else { alert("获取二维码失败: " + (data.msg || "未知错误")); btn.disabled = false; btn.innerHTML = \'<i class="fa fa-qrcode"></i> 微信扫码登录\'; }\n' +
            '            } catch (e) { alert("获取二维码失败"); btn.disabled = false; btn.innerHTML = \'<i class="fa fa-qrcode"></i> 微信扫码登录\'; }\n' +
            '        }\n' +
            '        function cancelWeiyunQRLogin() {\n' +
            '            if (weiyunQRInterval) { clearInterval(weiyunQRInterval); weiyunQRInterval = null; } if (weiyunCountdownInterval) { clearInterval(weiyunCountdownInterval); weiyunCountdownInterval = null; } weiyunCurrentUuid = null;\n' +
            '            document.getElementById("weiyun-qr-container").classList.remove("hidden"); document.getElementById("weiyunQRCode").classList.add("hidden"); document.getElementById("weiyunLoginSuccess").classList.add("hidden");\n' +
            '            document.getElementById("weiyunQRButton").disabled = false; document.getElementById("weiyunQRButton").innerHTML = \'<i class="fa fa-qrcode"></i> 微信扫码登录\';\n' +
            '            document.getElementById("weiyunQrcodeImage").innerHTML = ""; document.getElementById("weiyunCountdown").style.width = "100%"; document.getElementById("weiyunCountdownText").textContent = "300s"; document.getElementById("weiyunQRStatus").textContent = "等待扫码...";\n' +
            '        }\n' +
            '        async function saveWeiyunManualLogin() {\n' +
            '            const cookie = document.getElementById("weiyunCookieInput").value.trim(); if (!cookie) { alert("请输入Cookie"); return; }\n' +
            '            try { const r = await fetch("/?action=weiyun_qr_save&cookie=" + encodeURIComponent(cookie)); const d = await r.json(); if (d.success) { alert("保存成功！"); loadAllLoginStatus(); document.getElementById("weiyun-manual-input").classList.add("hidden"); document.getElementById("weiyunCookieInput").value = ""; } else { alert("保存失败: " + d.msg); } } catch (e) { alert("保存失败"); }\n' +
            '        }\n' +
            '        // ==================== 移动云盘（暂未实现） ====================\n' +
            '        async function saveMCloudManualLogin() {\n' +
            '            const auth = document.getElementById("mcloudAuthInput").value.trim();\n' +
            '            if (!auth) { alert("请输入Authorization"); return; }\n' +
            '            try {\n' +
            '                const r = await fetch("/?action=mcloud_qr_save&authorization=" + encodeURIComponent(auth));\n' +
            '                const d = await r.json();\n' +
            '                if (d.success) {\n' +
            '                    alert("保存成功！");\n' +
            '                    loadAllLoginStatus();\n' +
            '                    document.getElementById("mcloud-manual-input").classList.add("hidden");\n' +
            '                } else {\n' +
            '                    alert("保存失败: " + d.msg);\n' +
            '                }\n' +
            '            } catch (e) {\n' +
            '                alert("保存失败");\n' +
            '            }\n' +
            '        }\n' +
            '        // ==================== 通用倒计时函数 ====================\n' +
            '        function startGenericCountdown(barId, textId, expiresIn, onExpire) {\n' +
            '            let remaining = expiresIn;\n' +
            '            const intervalId = setInterval(() => {\n' +
            '                remaining--;\n' +
            '                document.getElementById(barId).style.width = (remaining / expiresIn) * 100 + "%";\n' +
            '                document.getElementById(textId).textContent = remaining + "s";\n' +
            '                if (remaining <= 0) { clearInterval(intervalId); if (onExpire) onExpire(); }\n' +
            '            }, 1000);\n' +
            '            if (barId.startsWith("uc")) ucCountdownInterval = intervalId;\n' +
            '            else if (barId.startsWith("unicom")) unicomCountdownInterval = intervalId;\n' +
            '            else if (barId.startsWith("quark")) quarkCountdownInterval = intervalId;\n' +
            '            else if (barId.startsWith("weiyun")) weiyunCountdownInterval = intervalId;\n' +
            '            else if (barId.startsWith("mcloud")) mcloudCountdownInterval = intervalId;\n' +
            '        }\n' +
            '        function logout() { if (confirm("确定要退出登录吗？")) window.location.href = "/admin?action=logout"; }\n' +
            '        setInterval(loadStats, 30000);\n' +
            '    </script>\n' +
            '</body>\n' +
            '</html>';
    }
}


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
        '                transition: all 0.3s ease;\n' +
        '            }\n' +
        '            .btn-primary:hover {\n' +
        '                transform: translateY(-2px);\n' +
        '                box-shadow: 0 4px 12px rgba(99, 102, 241, 0.4);\n' +
        '            }\n' +
        '            .btn-outline {\n' +
        '                @apply border border-gray-300 hover:bg-gray-50 focus:ring-2 focus:ring-primary/50;\n' +
        '                transition: all 0.3s ease;\n' +
        '            }\n' +
        '            .btn-outline:hover {\n' +
        '                transform: translateY(-2px);\n' +
        '                box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);\n' +
        '            }\n' +
        '            .card {\n' +
        '                @apply rounded-lg shadow-md p-6 transition-all duration-300 hover:shadow-lg;\n' +
        '                background: rgba(255, 255, 255, 0.3);\n' +
        '                backdrop-filter: blur(15px);\n' +
        '                -webkit-backdrop-filter: blur(15px);\n' +
        '                border: 1px solid rgba(255, 255, 255, 0.2);\n' +
        '                box-shadow: 0 8px 32px 0 rgba(31, 38, 135, 0.1);\n' +
        '            }\n' +
        '            .glass-effect {\n' +
        '                background: rgba(255, 255, 255, 0.3);\n' +
        '                backdrop-filter: blur(15px);\n' +
        '                -webkit-backdrop-filter: blur(15px);\n' +
        '                border: 1px solid rgba(255, 255, 255, 0.2);\n' +
        '                box-shadow: 0 8px 32px 0 rgba(31, 38, 135, 0.1);\n' +
        '            }\n' +
        '            .glass-input {\n' +
        '                background: rgba(255, 255, 255, 0.2);\n' +
        '                backdrop-filter: blur(10px);\n' +
        '                -webkit-backdrop-filter: blur(10px);\n' +
        '                border: 1px solid rgba(255, 255, 255, 0.2);\n' +
        '                transition: all 0.3s ease;\n' +
        '            }\n' +
        '            .glass-input:focus {\n' +
        '                background: rgba(255, 255, 255, 0.4);\n' +
        '                border-color: rgba(99, 102, 241, 0.4);\n' +
        '                box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.1);\n' +
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
        '            .disk-link {\n' +
        '                @apply inline-flex items-center px-3 py-1.5 text-sm text-primary bg-white/60 hover:bg-white/90 rounded-full transition-all duration-200 cursor-pointer;\n' +
        '                border: 1px solid rgba(99, 102, 241, 0.2);\n' +
        '            }\n' +
        '            .disk-link:hover {\n' +
        '                transform: translateY(-1px);\n' +
        '                box-shadow: 0 2px 8px rgba(99, 102, 241, 0.15);\n' +
        '                border-color: rgba(99, 102, 241, 0.4);\n' +
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
        '<body class="bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50 min-h-screen">\n' +
        '    <div class="container mx-auto px-4 py-8 max-w-4xl">\n' +
        '        <!-- 头部 -->\n' +
        '        <header class="text-center mb-8">\n' +
        '            <div class="glass-effect rounded-2xl p-6 mb-6">\n' +
        '                <h1 class="text-4xl font-bold text-dark mb-2 flex items-center justify-center gap-3">\n' +
        '                    <i class="fa fa-cloud-download-alt text-primary"></i> 网盘解析站\n' +
        '                </h1>\n' +
        '                <p class="text-secondary text-lg">支持众多网盘的解析工具</p>\n' +
        '            </div>\n' +
        
        '            <!-- 支持的网盘列表 -->\n' +
        '            <div class="glass-effect rounded-2xl p-4 mb-6">\n' +
        '                <div class="flex flex-wrap items-center justify-center gap-2">\n' +
        '                    <a href="https://www.ilanzou.com/" target="_blank" class="disk-link">\n' +
'                        <i class="fa fa-cloud text-blue-500 mr-1"></i>蓝奏云优享\n' +
'                    </a>\n' +
        '                    <a href="https://www.lanzou.com/" target="_blank" class="disk-link">\n' +
        '                        <i class="fa fa-cloud text-blue-400 mr-1"></i>蓝奏云\n' +
        '                    </a>\n' +
        '                    <a href="https://www.feijipan.com/" target="_blank" class="disk-link">\n' +
        '                        <i class="fa fa-plane text-green-500 mr-1"></i>小飞机网盘\n' +
        '                    </a>\n' +
        '                    <a href="https://fast.uc.cn/" target="_blank" class="disk-link">\n' +
        '                        <i class="fa fa-database text-purple-500 mr-1"></i>UC网盘\n' +
        '                    </a>\n' +
        '                    <a href="https://pan.quark.cn/" target="_blank" class="disk-link">\n' +
        '                        <i class="fa fa-hdd text-blue-500 mr-1"></i>夸克网盘\n' +
        '                    </a>\n' +
        '                    <a href="https://www.alipan.com/" target="_blank" class="disk-link">\n' +
        '                        <i class="fa fa-cloud text-orange-500 mr-1"></i>阿里云盘\n' +
        '                    </a>\n' +
        '                    <a href="https://yun.139.com/" target="_blank" class="disk-link">\n' +
        '                        <i class="fa fa-mobile text-green-600 mr-1"></i>移动云盘\n' +
        '                    </a>\n' +
        '                </div>\n' +
        '            </div>\n' +
        '            <!-- 统计卡片 -->\n' +
        '            <div class="grid grid-cols-2 md:grid-cols-4 gap-4">\n' +
        '                <div class="glass-effect rounded-xl p-4 text-center hover:scale-105 transition-transform cursor-pointer">\n' +
        '                    <div class="text-3xl font-bold text-primary mb-1" id="statTotal">0</div>\n' +
        '                    <div class="text-sm text-secondary">解析总数</div>\n' +
        '                </div>\n' +
        '                <div class="glass-effect rounded-xl p-4 text-center hover:scale-105 transition-transform cursor-pointer">\n' +
        '                    <div class="text-3xl font-bold text-success mb-1" id="statSuccess">0</div>\n' +
        '                    <div class="text-sm text-secondary">成功次数</div>\n' +
        '                </div>\n' +
        '                <div class="glass-effect rounded-xl p-4 text-center hover:scale-105 transition-transform cursor-pointer">\n' +
        '                    <div class="text-3xl font-bold text-danger mb-1" id="statFailed">0</div>\n' +
        '                    <div class="text-sm text-secondary">失败次数</div>\n' +
        '                </div>\n' +
        '                <div class="glass-effect rounded-xl p-4 text-center hover:scale-105 transition-transform cursor-pointer">\n' +
        '                    <div class="text-3xl font-bold text-info mb-1" id="statCached">0</div>\n' +
        '                    <div class="text-sm text-secondary">缓存命中</div>\n' +
        '                </div>\n' +
        '            </div>\n' +
        '        </header>\n' +
        '\n' +
        '        <!-- 主内容 -->\n' +
        '        <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">\n' +
        '            <!-- 左侧：解析表单 -->\n' +
        '            <div class="lg:col-span-2">\n' +
        '                <div class="card glass-effect rounded-2xl">\n' +
        '                    <div class="flex items-center justify-between mb-6">\n' +
        '                        <h2 class="text-xl font-semibold flex items-center gap-2">\n' +
        '                            <i class="fa fa-link text-primary"></i> 解析设置\n' +
        '                        </h2>\n' +
        '                        <span class="text-xs text-secondary bg-primary/10 px-3 py-1 rounded-full">快速解析</span>\n' +
        '                    </div>\n' +
        '                    \n' +
        '                    <form id="parseForm" class="space-y-6">\n' +
        '                        <!-- 分享链接 -->\n' +
        '                        <div class="input-group">\n' +
        '                            <label for="shareUrl" class="input-label flex items-center gap-2">\n' +
        '                                <i class="fa fa-share-alt text-primary"></i> 分享链接\n' +
        '                            </label>\n' +
        '                            <div>\n' +
        '                                <input type="text" id="shareUrl" name="url" class="input-field glass-input w-full pl-4 py-3 rounded-lg" placeholder="请输入网盘分享链接" required>\n' +
        '                            </div>\n' +
        '                        </div>\n' +
        '\n' +
        '                        <!-- 分享密码 -->\n' +
        '                        <div class="input-group">\n' +
        '                            <label for="sharePassword" class="input-label flex items-center gap-2">\n' +
        '                                <i class="fa fa-key text-primary"></i> 分享密码（如果有）\n' +
        '                            </label>\n' +
        '                            <div>\n' +
        '                                <input type="text" id="sharePassword" name="pwd" class="input-field glass-input w-full pl-4 py-3 rounded-lg" placeholder="请输入分享密码">\n' +
        '                            </div>\n' +
        '                        </div>\n' +
        '\n' +
        '                        <!-- 解析按钮 -->\n' +
        '                        <div class="pt-2">\n' +
        '                            <button type="button" id="parseButton" onclick="parseLink()" class="btn btn-primary w-full flex items-center justify-center py-3 rounded-xl font-medium hover:shadow-lg transition-all">\n' +
        '                                <i class="fa fa-search mr-2"></i> 开始解析\n' +
        '                            </button>\n' +
        '                        </div>\n' +
        '                    </form>\n' +
        '                </div>\n' +
        '\n' +
        '                <!-- 解析结果 -->\n' +
        '                <div class="card mt-6 glass-effect rounded-2xl">\n' +
        '                    <div class="flex items-center justify-between mb-4">\n' +
        '                        <h2 class="text-xl font-semibold flex items-center gap-2">\n' +
        '                            <i class="fa fa-code text-primary"></i> 解析结果\n' +
        '                        </h2>\n' +
        '                        <span class="text-xs text-secondary bg-success/10 px-3 py-1 rounded-full">实时更新</span>\n' +
        '                    </div>\n' +
        '                    <div id="result" class="min-h-[200px] bg-gray-50/80 rounded-xl p-4 relative">\n' +
        '                        <p class="text-secondary text-center py-8">解析结果将显示在这里</p>\n' +
        '                    </div>\n' +
        '                </div>\n' +
        '            </div>\n' +
        '\n' +
        '            <!-- 右侧：网盘配置 -->\n' +
        '            <div class="lg:col-span-1">\n' +
        '                <div class="card glass-effect rounded-2xl" style="max-height: 600px; overflow-y: auto;">\n' +
        '                    <div class="flex items-center justify-between mb-4">\n' +
        '                        <h2 class="text-xl font-semibold flex items-center gap-2">\n' +
        '                            <i class="fa fa-cog text-primary"></i> 网盘配置\n' +
        '                        </h2>\n' +
        '                        <span class="text-xs text-secondary bg-warning/10 px-3 py-1 rounded-full">自动保存</span>\n' +
        '                    </div>\n' +
        '                    \n' +
        '                    <!-- 阿里云盘 -->\n' +
        '                    <div class="mb-5 p-4 bg-white/40 rounded-xl">\n' +
        '                        <div class="flex items-center gap-2 mb-3">\n' +
        '                            <i class="fa fa-cloud text-orange-500"></i>\n' +
        '                            <h3 class="font-medium text-gray-700">阿里云盘</h3>\n' +
        '                        </div>\n' +
        '                        <div class="input-group">\n' +
        '                            <label for="aliyunAuth" class="input-label text-sm">Authorization</label>\n' +
        '                            <textarea id="aliyunAuth" class="textarea-field glass-input w-full px-4 py-3 rounded-lg" placeholder="请输入阿里云盘Authorization"></textarea>\n' +
        '                        </div>\n' +
        '                    </div>\n' +
        '\n' +
        '                    <!-- 夸克网盘 -->\n' +
        '                    <div class="mb-5 p-4 bg-white/40 rounded-xl">\n' +
        '                        <div class="flex items-center gap-2 mb-3">\n' +
        '                            <i class="fa fa-hdd text-blue-500"></i>\n' +
        '                            <h3 class="font-medium text-gray-700">夸克网盘</h3>\n' +
        '                        </div>\n' +
        '                        <div class="input-group">\n' +
        '                            <label for="quarkCookie" class="input-label text-sm">Cookie</label>\n' +
        '                            <textarea id="quarkCookie" class="textarea-field glass-input w-full px-4 py-3 rounded-lg" placeholder="请输入夸克网盘Cookie"></textarea>\n' +
        '                        </div>\n' +
        '                    </div>\n' +
        '\n' +
        '                    <!-- UC网盘 -->\n' +
        '                    <div class="mb-5 p-4 bg-white/40 rounded-xl">\n' +
        '                        <div class="flex items-center gap-2 mb-3">\n' +
        '                            <i class="fa fa-database text-purple-500"></i>\n' +
        '                            <h3 class="font-medium text-gray-700">UC网盘</h3>\n' +
        '                        </div>\n' +
        '                        <div class="input-group">\n' +
        '                            <label for="ucCookie" class="input-label text-sm">Cookie</label>\n' +
        '                            <textarea id="ucCookie" class="textarea-field glass-input w-full px-4 py-3 rounded-lg" placeholder="请输入UC网盘Cookie"></textarea>\n' +
        '                        </div>\n' +
        '                    </div>\n' +
        '\n' +
        '                    <!-- 移动云盘 -->\n' +
        '                    <div class="mb-5 p-4 bg-white/40 rounded-xl">\n' +
        '                        <div class="flex items-center gap-2 mb-3">\n' +
        '                            <i class="fa fa-mobile-alt text-green-500"></i>\n' +
        '                            <h3 class="font-medium text-gray-700">移动云盘</h3>\n' +
        '                        </div>\n' +
        '                        <div class="input-group">\n' +
        '                            <label for="mcloudAuth" class="input-label text-sm">Authorization</label>\n' +
        '                            <textarea id="mcloudAuth" class="textarea-field glass-input w-full px-4 py-3 rounded-lg" placeholder="请输入移动云盘Authorization"></textarea>\n' +
        '                        </div>\n' +
        '                        <div class="input-group">\n' +
        '                            <label for="mcloudCookie" class="input-label text-sm">Cookie</label>\n' +
        '                            <textarea id="mcloudCookie" class="textarea-field glass-input w-full px-4 py-3 rounded-lg" placeholder="请输入移动云盘Cookie"></textarea>\n' +
        '                        </div>\n' +
        '                    </div>\n' +
        '\n' +
        '                    <!-- 光鸭云盘 -->\n' +
        '                    <div class="mb-5 p-4 bg-white/40 rounded-xl">\n' +
        '                        <div class="flex items-center gap-2 mb-3">\n' +
        '                            <i class="fa fa-duck text-yellow-600"></i>\n' +
        '                            <h3 class="font-medium text-gray-700">光鸭云盘</h3>\n' +
        '                        </div>\n' +
        '                        <div class="input-group">\n' +
        '                            <label for="guangyaLogin" class="input-label text-sm">登录信息 (JSON)</label>\n' +
        '                            <textarea id="guangyaLogin" class="textarea-field glass-input w-full px-4 py-3 rounded-lg" placeholder=\'请输入光鸭云盘登录信息JSON，例如: {"access_token":"xxx","refresh_token":"xxx"}\'></textarea>\n' +
        '                        </div>\n' +
        '                    </div>\n' +
        '\n' +
        '                    <!-- 保存配置按钮 -->\n' +
        '                    <button id="saveConfig" class="btn btn-outline w-full flex items-center justify-center py-3 rounded-xl font-medium hover:shadow-lg transition-all">\n' +
        '                        <i class="fa fa-save mr-2"></i> 保存配置\n' +
        '                    </button>\n' +
        '                </div>\n' +
        '            </div>\n' +
        '        </div>\n' +
        '    </div>\n' +
        '\n' +
        '    <!-- 脚本 -->\n' +
        '    <script>\n' +
        '        // 页面加载时从本地存储加载配置\n' +
        '        document.addEventListener("DOMContentLoaded", function() {\n' +
        '            console.log("DOMContentLoaded事件触发");\n' +
        '            loadConfig();\n' +
        '            setupEventListeners();\n' +
        '            initStats();\n' +
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
        '            \n' +
        '            // 光鸭云盘\n' +
        '            document.getElementById("guangyaLogin").value = config.guangya?.loginInfo || "";\n' +
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
        '                },\n' +
        '                guangya: {\n' +
        '                    enabled: true,\n' +
        '                    loginInfo: document.getElementById("guangyaLogin").value\n' +
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
        '            let shareUrl = document.getElementById("shareUrl").value;\n' +
        '            const sharePassword = document.getElementById("sharePassword").value;\n' +
        '            // 对分享链接进行解码，确保传递给后端的是原始URL\n' +
        '            try {\n' +
        '                shareUrl = decodeURIComponent(shareUrl);\n' +
        '            } catch (e) {\n' +
        '                console.log("解码分享链接失败，使用原始链接:", e);\n' +
        '            }\n' +
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
        '            // 更新统计数据\n' +
        '            updateStats(result);\n' +
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
        '                    html += \'<div class="relative"><button onclick="copyJSON()" class="absolute top-2 right-2 bg-white/80 hover:bg-white text-gray-600 hover:text-gray-900 px-2 py-1 rounded-md text-xs font-medium transition-colors shadow-sm"><i class="fa fa-copy mr-1"></i>复制JSON</button><div class="bg-gray-900 text-green-400 p-4 rounded-md overflow-x-auto"><pre class="text-sm">\' + JSON.stringify(result, null, 2) + \'</pre></div></div>\';\n' +
        '                    \n' +
        '                    // 下载按钮\n' +
        '                    html += \'<button onclick="downloadCurrentFile()" class="btn btn-primary w-full flex items-center justify-center mt-4"><i class="fa fa-download mr-2"></i> 下载此文件</button>\';\n' +
        '                    \n' +
        '                    // 复制下载链接按钮\n' +
        '                    html += \'<button onclick="copyDownloadLink()" class="btn btn-outline w-full flex items-center justify-center mt-2"><i class="fa fa-link mr-2"></i> 复制下载链接</button>\';\n' +
        '                    \n' +
        '                    resultDiv.innerHTML = html;\n' +
        '                } else {\n' +
        '                    // 单文件结果\n' +
        '                    let html = \'<div class="space-y-4">\';\n' +
        '                    \n' +
        '                    // 显示JSON结果\n' +
        '                    html += \'<div class="relative"><button onclick="copyJSON()" class="absolute top-2 right-2 bg-white/80 hover:bg-white text-gray-600 hover:text-gray-900 px-2 py-1 rounded-md text-xs font-medium transition-colors shadow-sm"><i class="fa fa-copy mr-1"></i>复制JSON</button><div class="bg-gray-900 text-green-400 p-4 rounded-md overflow-x-auto"><pre class="text-sm">\' + JSON.stringify(result, null, 2) + \'</pre></div></div>\';\n' +
        '                    \n' +
        '                    // 下载按钮\n' +
        '                    html += \'<button onclick="downloadCurrentFile()" class="btn btn-primary w-full flex items-center justify-center"><i class="fa fa-download mr-2"></i> 下载此文件</button>\';\n' +
        '                    \n' +
        '                    // 复制下载链接按钮\n' +
        '                    html += \'<button onclick="copyDownloadLink()" class="btn btn-outline w-full flex items-center justify-center mt-2"><i class="fa fa-link mr-2"></i> 复制下载链接</button>\';\n' +
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
        '        // 更新统计数据\n' +
        '        function updateStats(result) {\n' +
        '            // 从后端获取最新统计数据\n' +
        '            fetch("/?action=get_stats")\n' +
        '                .then(response => response.json())\n' +
        '                .then(data => {\n' +
        '                    if (data.success) {\n' +
        '                        const stats = data.data;\n' +
        '                        // 更新显示\n' +
        '                        document.getElementById("statTotal").textContent = stats.total;\n' +
        '                        document.getElementById("statSuccess").textContent = stats.success;\n' +
        '                        document.getElementById("statFailed").textContent = stats.failed;\n' +
        '                        document.getElementById("statCached").textContent = stats.cached;\n' +
        '                    }\n' +
        '                })\n' +
        '                .catch(err => {\n' +
        '                    console.log("获取统计数据失败:", err);\n' +
        '                });\n' +
        '        }\n' +
        '        \n' +
        '        // 页面加载时初始化统计数据\n' +
        '        function initStats() {\n' +
        '            // 从后端获取最新统计数据\n' +
        '            fetch("/?action=get_stats")\n' +
        '                .then(response => response.json())\n' +
        '                .then(data => {\n' +
        '                    if (data.success) {\n' +
        '                        const stats = data.data;\n' +
        '                        // 更新显示\n' +
        '                        document.getElementById("statTotal").textContent = stats.total;\n' +
        '                        document.getElementById("statSuccess").textContent = stats.success;\n' +
        '                        document.getElementById("statFailed").textContent = stats.failed;\n' +
        '                        document.getElementById("statCached").textContent = stats.cached;\n' +
        '                    }\n' +
        '                })\n' +
        '                .catch(err => {\n' +
        '                    console.log("获取统计数据失败:", err);\n' +
        '                    // 失败时使用默认值\n' +
        '                    document.getElementById("statTotal").textContent = "0";\n' +
        '                    document.getElementById("statSuccess").textContent = "0";\n' +
        '                    document.getElementById("statFailed").textContent = "0";\n' +
        '                    document.getElementById("statCached").textContent = "0";\n' +
        '                });\n' +
        '        }\n' +
        '        \n' +
        '        // 复制JSON\n' +
        '        function copyJSON() {\n' +
        '            if (!window.currentParseResult) {\n' +
        '                showNotification("没有可复制的内容", "error");\n' +
        '                return;\n' +
        '            }\n' +
        '            const jsonStr = JSON.stringify(window.currentParseResult, null, 2);\n' +
        '            navigator.clipboard.writeText(jsonStr).then(() => {\n' +
        '                showNotification("JSON已复制到剪贴板", "success");\n' +
        '            }).catch(err => {\n' +
        '                showNotification("复制失败: " + err.message, "error");\n' +
        '            });\n' +
        '        }\n' +
        '        \n' +
        '        // 复制下载链接\n' +
        '        function copyDownloadLink() {\n' +
        '            const shareUrl = document.getElementById("shareUrl").value;\n' +
        '            const sharePassword = document.getElementById("sharePassword").value;\n' +
        '            \n' +
        '            // 构建下载链接\n' +
        '            let downloadUrl = "https://jx.fsapk.xx.kg/?url=" + encodeURIComponent(shareUrl);\n' +
        '            if (sharePassword) {\n' +
        '                downloadUrl += "&pwd=" + encodeURIComponent(sharePassword);\n' +
        '            }\n' +
        '            downloadUrl += "&type=down";\n' +
        '            \n' +
        '            navigator.clipboard.writeText(downloadUrl).then(() => {\n' +
        '                showNotification("下载链接已复制到剪贴板", "success");\n' +
        '            }).catch(err => {\n' +
        '                showNotification("复制失败: " + err.message, "error");\n' +
        '            });\n' +
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
        '        \n' +
        '        // 底栏\n' +
        '        document.write(\'<footer class="mt-12 text-center glass-effect py-6 rounded-lg"><div class="container mx-auto px-4"><div class="flex flex-col items-center justify-center gap-2"><div class="flex items-center gap-2"><a href="https://github.com/ByLsPro/JxPan/" target="_blank" class="text-primary hover:text-primary/80 transition-colors"><i class="fa fa-github mr-1"></i>GitHub项目</a><span class="text-secondary">|</span><span class="text-secondary">By：<span class="font-medium text-dark">LsPro</span> | <span class="font-medium text-dark">灵衫Pro</span></span></div><div class="text-sm text-secondary">网盘解析工具 - 基于CloudFlare Workers部署</div></div></div></footer>\');\n' +
        '    </script>\n' +
        '</body>\n' +
        '</html>';
}

// ============================== 主入口 ==============================
export default {
    async fetch(request, env, ctx) {
        const url = new URL(request.url);
        
        if (env.jxpan) {
            console.log('[D1] 检测到jxpan绑定, 开始初始化...');
            try {
                await d1Init(env.jxpan);
                console.log('[D1] 初始化完成');
            } catch (initErr) {
                console.log('[D1] 初始化异常:', initErr.message, initErr.stack);
            }
        } else {
            console.log('[存储] 未检测到jxpan绑定, 将使用KV或无存储模式');
        }
        
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

        // 处理后台面板路由
        console.log('[路由] 请求路径:', url.pathname);
        if (url.pathname === '/admin') {
            console.log('[路由] 匹配到/admin路径，调用handleAdminRequest');
            return await handleAdminRequest(request, env);
        }

        // 支持从 GET 参数和 POST 表单获取参数
        let params = {};
        if (request.method === 'POST') {
            const formData = await request.formData();
            for (const [key, value] of formData) {
                params[key] = value;
            }
        }
        
        const targetUrl = params['url'] || url.searchParams.get('url');
        const pwd = params['pwd'] || url.searchParams.get('pwd') || '';
        const type = params['type'] || url.searchParams.get('type') || '';
        const authParam = params['auth'] || url.searchParams.get('auth') || '';
        const action = params['action'] || url.searchParams.get('action') || '';

        console.log('[路由] 前端页面请求，targetUrl:', targetUrl, 'action:', action);

        // 处理API请求
        if (action) {
            // 处理获取统计数据的请求
            if (action === 'get_stats') {
                try {
                    const statsObj = await getStatsFromKV(env);
                    return new Response(JSON.stringify({
                        code: 200,
                        msg: '获取统计数据成功',
                        success: true,
                        data: statsObj
                    }), {
                        headers: {
                            'Content-Type': 'application/json; charset=utf-8',
                            'Access-Control-Allow-Origin': '*'
                        }
                    });
                } catch (e) {
                    console.log('[!] 处理统计数据请求失败:', e);
                    return new Response(JSON.stringify({
                        code: 500,
                        msg: '获取统计数据失败',
                        success: false,
                        data: null
                    }), {
                        headers: {
                            'Content-Type': 'application/json; charset=utf-8',
                            'Access-Control-Allow-Origin': '*'
                        }
                    });
                }
            }

            // 处理获取解析记录的请求
            if (action === 'get_records') {
                try {
                    const records = await getParseRecords(env);
                    return new Response(JSON.stringify({
                        code: 200,
                        msg: '获取解析记录成功',
                        success: true,
                        data: records
                    }), {
                        headers: {
                            'Content-Type': 'application/json; charset=utf-8',
                            'Access-Control-Allow-Origin': '*'
                        }
                    });
                } catch (e) {
                    console.log('[!] 处理解析记录请求失败:', e);
                    return new Response(JSON.stringify({
                        code: 500,
                        msg: '获取解析记录失败',
                        success: false,
                        data: null
                    }), {
                        headers: {
                            'Content-Type': 'application/json; charset=utf-8',
                            'Access-Control-Allow-Origin': '*'
                        }
                    });
                }
            }

            // 处理测试KV存储的请求
            if (action === 'test_kv') {
                try {
                    if (!env || !(env.jxpan || env.jx)) {
                        return new Response(JSON.stringify({
                            code: 500,
                            msg: 'KV存储未配置',
                            success: false,
                            data: null
                        }), {
                            headers: {
                                'Content-Type': 'application/json; charset=utf-8',
                                'Access-Control-Allow-Origin': '*'
                            }
                        });
                    }

                    // 测试存储
                    const testKey = 'test_' + Date.now();
                    const testData = { message: 'test', timestamp: new Date().toISOString() };
                    const encryptedData = encryptForKV(testData);
                    
                    if (encryptedData) {
                        await storePut(env, testKey, encryptedData, { expirationTtl: 3600 });
                        console.log('[*] 测试数据已保存:', testKey);

                        // 测试读取
                        const retrievedData = await storeGet(env, testKey);
                        if (retrievedData) {
                            const decryptedData = decryptFromKV(retrievedData);
                            console.log('[*] 测试数据已读取:', decryptedData);

                            // 测试列表
                            const list = await storeListByPrefix(env, 'test_');
                            console.log('[*] 测试数据列表:', list);

                            return new Response(JSON.stringify({
                                code: 200,
                                msg: 'KV存储测试成功',
                                success: true,
                                data: {
                                    saved: testData,
                                    retrieved: decryptedData,
                                    list: list
                                }
                            }), {
                                headers: {
                                    'Content-Type': 'application/json; charset=utf-8',
                                    'Access-Control-Allow-Origin': '*'
                                }
                            });
                        } else {
                            return new Response(JSON.stringify({
                                code: 500,
                                msg: 'KV存储读取失败',
                                success: false,
                                data: null
                            }), {
                                headers: {
                                    'Content-Type': 'application/json; charset=utf-8',
                                    'Access-Control-Allow-Origin': '*'
                                }
                            });
                        }
                    } else {
                        return new Response(JSON.stringify({
                            code: 500,
                            msg: 'KV存储加密失败',
                            success: false,
                            data: null
                        }), {
                            headers: {
                                'Content-Type': 'application/json; charset=utf-8',
                                'Access-Control-Allow-Origin': '*'
                            }
                        });
                    }
                } catch (e) {
                    console.log('[!] KV存储测试失败:', e);
                    return new Response(JSON.stringify({
                        code: 500,
                        msg: 'KV存储测试失败: ' + e.message,
                        success: false,
                        data: null
                    }), {
                        headers: {
                            'Content-Type': 'application/json; charset=utf-8',
                            'Access-Control-Allow-Origin': '*'
                        }
                    });
                }
            }

            // 处理查看解析记录键的请求
            if (action === 'list_parse_records') {
                try {
                    if (!env || !(env.jxpan || env.jx)) {
                        return new Response(JSON.stringify({
                            code: 500,
                            msg: 'KV存储未配置',
                            success: false,
                            data: null
                        }), {
                            headers: {
                                'Content-Type': 'application/json; charset=utf-8',
                                'Access-Control-Allow-Origin': '*'
                            }
                        });
                    }

                    // 列出所有解析记录键
                    const list = await storeListByPrefix(env, 'parse_record_');
                    console.log('[*] 解析记录键列表:', list);

                    return new Response(JSON.stringify({
                        code: 200,
                        msg: '获取解析记录键成功',
                        success: true,
                        data: list
                    }), {
                        headers: {
                            'Content-Type': 'application/json; charset=utf-8',
                            'Access-Control-Allow-Origin': '*'
                        }
                    });
                } catch (e) {
                    console.log('[!] 获取解析记录键失败:', e);
                    return new Response(JSON.stringify({
                        code: 500,
                        msg: '获取解析记录键失败: ' + e.message,
                        success: false,
                        data: null
                    }), {
                        headers: {
                            'Content-Type': 'application/json; charset=utf-8',
                            'Access-Control-Allow-Origin': '*'
                        }
                    });
                }
            }

            // 光鸭云盘扫码登录 - 获取二维码
            if (action === 'guangya_qrcode') {
                try {
                    const deviceId = generateUUID();
                    
                    const response = await fetch('https://account.guangyapan.com/v1/auth/device/code', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json;charset=UTF-8',
                            'Accept': 'application/json, text/plain, */*',
                            'Origin': 'https://www.guangyapan.com',
                            'Referer': 'https://www.guangyapan.com/'
                        },
                        body: JSON.stringify({
                            client_id: 'aMe-8VSlkrbQXpUR',
                            device_id: deviceId,
                            scope: 'user profile sso offline_access'
                        })
                    });
                    
                    const result = await response.json();
                    console.log('[光鸭扫码] 获取设备码响应:', JSON.stringify(result));
                    
                    if (result.device_code && result.user_code && result.verification_uri_complete) {
                        const qrData = {
                            device_code: result.device_code,
                            user_code: result.user_code,
                            verification_uri_complete: result.verification_uri_complete,
                            interval: result.interval || 5,
                            expires_in: result.expires_in || 600,
                            device_id: deviceId,
                            timestamp: Date.now()
                        };
                        
                        if (env && (env.jxpan || env.jx)) {
                            await storePut(env, 'gy_qr_' + deviceId, JSON.stringify(qrData), { expirationTtl: 600 });
                        }
                        
                        return new Response(JSON.stringify({
                            code: 200,
                            msg: '获取二维码成功',
                            success: true,
                            data: {
                                device_id: deviceId,
                                verification_uri_complete: result.verification_uri_complete,
                                user_code: result.user_code,
                                expires_in: result.expires_in || 600,
                                interval: result.interval || 5
                            }
                        }), {
                            headers: {
                                'Content-Type': 'application/json; charset=utf-8',
                                'Access-Control-Allow-Origin': '*'
                            }
                        });
                    } else {
                        return new Response(JSON.stringify({
                            code: 500,
                            msg: '获取二维码失败: ' + JSON.stringify(result),
                            success: false,
                            data: null
                        }), {
                            headers: {
                                'Content-Type': 'application/json; charset=utf-8',
                                'Access-Control-Allow-Origin': '*'
                            }
                        });
                    }
                } catch (e) {
                    console.log('[!] 获取光鸭云盘二维码失败:', e);
                    return new Response(JSON.stringify({
                        code: 500,
                        msg: '获取二维码失败: ' + e.message,
                        success: false,
                        data: null
                    }), {
                        headers: {
                            'Content-Type': 'application/json; charset=utf-8',
                            'Access-Control-Allow-Origin': '*'
                        }
                    });
                }
            }

            // 光鸭云盘扫码登录 - 轮询状态
            if (action === 'guangya_qr_poll') {
                try {
                    const deviceId = url.searchParams.get('device_id');
                    
                    if (!deviceId) {
                        return new Response(JSON.stringify({
                            code: 400,
                            msg: '缺少device_id参数',
                            success: false,
                            data: null
                        }), {
                            headers: {
                                'Content-Type': 'application/json; charset=utf-8',
                                'Access-Control-Allow-Origin': '*'
                            }
                        });
                    }
                    
                    let qrData = null;
                    if (env && (env.jxpan || env.jx)) {
                        const storedData = await storeGet(env, 'gy_qr_' + deviceId);
                        if (storedData) {
                            qrData = JSON.parse(storedData);
                        }
                    }
                    
                    if (!qrData) {
                        return new Response(JSON.stringify({
                            code: 400,
                            msg: '二维码已过期，请重新获取',
                            success: false,
                            data: { status: 'expired' }
                        }), {
                            headers: {
                                'Content-Type': 'application/json; charset=utf-8',
                                'Access-Control-Allow-Origin': '*'
                            }
                        });
                    }
                    
                    const pollResponse = await fetch('https://account.guangyapan.com/v1/auth/token', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json;charset=UTF-8',
                            'Accept': 'application/json, text/plain, */*',
                            'Origin': 'https://www.guangyapan.com',
                            'Referer': 'https://www.guangyapan.com/'
                        },
                        body: JSON.stringify({
                            grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
                            device_code: qrData.device_code,
                            client_id: 'aMe-8VSlkrbQXpUR'
                        })
                    });
                    
                    const pollResult = await pollResponse.json();
                    
                    if (pollResult.access_token) {
                        if (env && (env.jxpan || env.jx)) {
                            await storeDelete(env, 'gy_qr_' + deviceId);
                        }
                        
                        return new Response(JSON.stringify({
                            code: 200,
                            msg: '登录成功',
                            success: true,
                            data: {
                                status: 'confirmed',
                                access_token: pollResult.access_token,
                                refresh_token: pollResult.refresh_token,
                                expires_in: pollResult.expires_in,
                                device_id: deviceId
                            }
                        }), {
                            headers: {
                                'Content-Type': 'application/json; charset=utf-8',
                                'Access-Control-Allow-Origin': '*'
                            }
                        });
                    } else if (pollResult.error) {
                        const error = pollResult.error;
                        let status = 'pending';
                        if (error === 'authorization_pending') {
                            status = 'pending';
                        } else if (error === 'slow_down') {
                            status = 'pending';
                        } else if (error === 'access_denied') {
                            status = 'denied';
                        } else if (error === 'expired_token') {
                            status = 'expired';
                        } else {
                            status = 'error';
                        }
                        
                        return new Response(JSON.stringify({
                            code: 200,
                            msg: status === 'pending' ? '等待扫码' : '扫码' + (status === 'denied' ? '被拒绝' : '状态异常'),
                            success: true,
                            data: { status: status }
                        }), {
                            headers: {
                                'Content-Type': 'application/json; charset=utf-8',
                                'Access-Control-Allow-Origin': '*'
                            }
                        });
                    } else {
                        return new Response(JSON.stringify({
                            code: 200,
                            msg: '等待扫码',
                            success: true,
                            data: { status: 'pending' }
                        }), {
                            headers: {
                                'Content-Type': 'application/json; charset=utf-8',
                                'Access-Control-Allow-Origin': '*'
                            }
                        });
                    }
                } catch (e) {
                    console.log('[!] 轮询光鸭云盘扫码状态失败:', e);
                    return new Response(JSON.stringify({
                        code: 500,
                        msg: '轮询失败: ' + e.message,
                        success: false,
                        data: null
                    }), {
                        headers: {
                            'Content-Type': 'application/json; charset=utf-8',
                            'Access-Control-Allow-Origin': '*'
                        }
                    });
                }
            }

            // 光鸭云盘扫码登录 - 保存登录信息
            if (action === 'guangya_qr_save') {
                try {
                    const accessToken = url.searchParams.get('access_token');
                    const refreshToken = url.searchParams.get('refresh_token');
                    const expiresIn = url.searchParams.get('expires_in');
                    const deviceId = url.searchParams.get('device_id');
                    
                    if (!accessToken) {
                        return new Response(JSON.stringify({
                            code: 400,
                            msg: '缺少access_token参数',
                            success: false,
                            data: null
                        }), {
                            headers: {
                                'Content-Type': 'application/json; charset=utf-8',
                                'Access-Control-Allow-Origin': '*'
                            }
                        });
                    }
                    
                    const loginInfo = {
                        access_token: accessToken,
                        refresh_token: refreshToken || generateRefreshToken(),
                        device_id: deviceId || generateUUID(),
                        token_expires_at: Math.floor(Date.now() / 1000) + (parseInt(expiresIn) || 604800)
                    };
                    
                    if (env && (env.jxpan || env.jx)) {
                        const encryptedLoginInfo = encryptForKV(loginInfo);
                        if (encryptedLoginInfo) {
                            await storePut(env, 'gy_login_default', encryptedLoginInfo);
                            console.log('[*] 光鸭云盘登录信息已保存到KV默认配置');
                        }
                    }
                    
                    return new Response(JSON.stringify({
                        code: 200,
                        msg: '登录信息已保存到默认配置',
                        success: true,
                        data: {
                            loginInfo: loginInfo
                        }
                    }), {
                        headers: {
                            'Content-Type': 'application/json; charset=utf-8',
                            'Access-Control-Allow-Origin': '*'
                        }
                    });
                } catch (e) {
                    console.log('[!] 保存光鸭云盘登录信息失败:', e);
                    return new Response(JSON.stringify({
                        code: 500,
                        msg: '保存失败: ' + e.message,
                        success: false,
                        data: null
                    }), {
                        headers: {
                            'Content-Type': 'application/json; charset=utf-8',
                            'Access-Control-Allow-Origin': '*'
                        }
                    });
                }
            }

            // 阿里云盘扫码登录 - 获取二维码（参考Python脚本流程）
            if (action === 'aliyun_qrcode') {
                try {
                    const ALIYUN_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36';
                    const umidToken = 'c' + Date.now() + Math.floor(1000 + Math.random() * 9000);
                    
                    // Step 1: GET mini_login.htm 获取真实 CSRF Token
                    console.log('[阿里云盘扫码] Step1: 获取CSRF Token...');
                    const initParams = new URLSearchParams({
                        lang: 'zh_cn', appName: 'aliyun_drive', appEntrance: 'web_default',
                        styleType: 'auto', bizParams: '', notLoadSsoView: 'false',
                        notKeepLogin: 'false', isMobile: 'false', rnd: Math.random()
                    });
                    const initResponse = await fetch('https://passport.alipan.com/mini_login.htm?' + initParams.toString(), {
                        method: 'GET',
                        headers: {
                            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                            'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
                            'User-Agent': ALIYUN_UA,
                            'Referer': 'https://auth.alipan.com/'
                        }
                    });
                    const initHtml = await initResponse.text();
                    
                    let csrfToken = '';
                    const csrfMatch1 = initHtml.match(/name="_csrf_token"\s+value="(.+?)"/);
                    const csrfMatch2 = initHtml.match(/"_csrf_token":"(.+?)"/);
                    if (csrfMatch1) csrfToken = csrfMatch1[1];
                    else if (csrfMatch2) csrfToken = csrfMatch2[1];
                    
                    if (!csrfToken) {
                        console.log('[阿里云盘扫码] 未能获取CSRF Token，使用随机值');
                        csrfToken = generateUUID() + generateUUID();
                    }
                    console.log('[阿里云盘扫码] CSRF Token:', csrfToken);
                    
                    // Step 2: GET generate.do 生成二维码
                    console.log('[阿里云盘扫码] Step2: 生成二维码...');
                    const genParams = new URLSearchParams({
                        appName: 'aliyun_drive', fromSite: '52', appEntrance: 'web_default',
                        _csrf_token: csrfToken, umidToken: umidToken,
                        hsiz: '',
                        bizParams: 'taobaoBizLoginFrom=web_default&renderRefer=https%3A%2F%2Fauth.alipan.com%2F',
                        mainPage: 'false', isMobile: 'false', lang: 'zh_CN',
                        returnUrl: '', umidTag: 'SERVER'
                    });
                    const genResponse = await fetch('https://passport.alipan.com/newlogin/qrcode/generate.do?' + genParams.toString(), {
                        method: 'GET',
                        headers: {
                            'Accept': 'application/json, text/plain, */*',
                            'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
                            'User-Agent': ALIYUN_UA,
                            'Referer': 'https://auth.alipan.com/'
                        }
                    });
                    const genResult = await genResponse.json();
                    console.log('[阿里云盘扫码] 生成二维码响应:', JSON.stringify(genResult));
                    
                    if (genResult.content && genResult.content.success && genResult.content.data) {
                        const data = genResult.content.data;
                        return new Response(JSON.stringify({
                            code: 200, msg: '获取二维码成功', success: true,
                            data: {
                                t: data.t,
                                ck: data.ck,
                                qr_code_url: data.codeContent,
                                csrf_token: csrfToken,
                                umid_token: umidToken
                            }
                        }), { headers: { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*' } });
                    } else {
                        return new Response(JSON.stringify({
                            code: 500, msg: '获取二维码失败: ' + JSON.stringify(genResult), success: false, data: null
                        }), { headers: { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*' } });
                    }
                } catch (e) {
                    console.log('[!] 获取阿里云盘二维码失败:', e);
                    return new Response(JSON.stringify({
                        code: 500, msg: '获取二维码失败: ' + e.message, success: false, data: null
                    }), { headers: { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*' } });
                }
            }

            // 阿里云盘扫码登录 - 轮询状态（参考Python脚本，极简参数）
            if (action === 'aliyun_qr_poll') {
                try {
                    const t = url.searchParams.get('t');
                    const ck = url.searchParams.get('ck');
                    const csrfToken = url.searchParams.get('csrfToken');
                    const umidToken = url.searchParams.get('umidToken');
                    
                    if (!t || !ck || !csrfToken) {
                        return new Response(JSON.stringify({
                            code: 400, msg: '缺少必要参数(t/ck/csrfToken)', success: false, data: null
                        }), { headers: { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*' } });
                    }
                    
                    const ALIYUN_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36';
                    
                    // 按Python脚本方式：极简参数
                    const postData = new URLSearchParams({
                        t: t,
                        ck: ck,
                        appName: 'aliyun_drive',
                        fromSite: '52',
                        _csrf_token: csrfToken,
                        umidToken: umidToken || '',
                        navUserAgent: ALIYUN_UA,
                        deviceId: 'nfd_alipan_scanner_001'
                    });
                    
                    const pollResponse = await fetch('https://passport.alipan.com/newlogin/qrcode/query.do', {
                        method: 'POST',
                        headers: {
                            'Accept': 'application/json, text/plain, */*',
                            'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
                            'Content-Type': 'application/x-www-form-urlencoded',
                            'User-Agent': ALIYUN_UA,
                            'Referer': 'https://auth.alipan.com/'
                        },
                        body: postData.toString()
                    });
                    
                    const pollResult = await pollResponse.json();
                    console.log('[阿里云盘扫码] query.do 响应:', JSON.stringify(pollResult));
                    
                    if (pollResult.content && pollResult.content.data) {
                        const data = pollResult.content.data;
                        const status = data.qrCodeStatus;
                        console.log('[阿里云盘扫码] qrCodeStatus:', status);
                        
                        if (status === 'CONFIRMED') {
                            const bizExt = data.bizExt || '';
                            console.log('[阿里云盘扫码] 已确认! bizExt长度:', bizExt.length);
                            
                            let refreshToken = '';
                            let accessTokenFromBiz = '';
                            let userName = '';
                            let userId = '';
                            
                            if (bizExt) {
                                try {
                                    let b64Str = bizExt.replace(/-/g, '+').replace(/_/g, '/');
                                    while (b64Str.length % 4 !== 0) b64Str += '=';
                                    let decoded = atob(b64Str);
                                    const bizData = JSON.parse(decoded);
                                    console.log('[阿里云盘扫码] bizExt解码成功, keys:', Object.keys(bizData));
                                    const pds = bizData.pds_login_result || {};
                                    console.log('[阿里云盘扫码] pds_login_result keys:', Object.keys(pds));
                                    
                                    refreshToken = pds.refreshToken || pds.refresh_token || '';
                                    accessTokenFromBiz = pds.accessToken || pds.access_token || '';
                                    userName = pds.nickName || pds.userName || '';
                                    userId = pds.userId || '';
                                    
                                    console.log('[阿里云盘扫码] refreshToken:', refreshToken ? (refreshToken.startsWith('eyJ') ? 'JWT(' + refreshToken.length + '字符)' : refreshToken.substring(0, 20) + '...') : '空');
                                    console.log('[阿里云盘扫码] accessToken:', accessTokenFromBiz ? (accessTokenFromBiz.startsWith('eyJ') ? 'JWT(' + accessTokenFromBiz.length + '字符)' : accessTokenFromBiz.substring(0, 20) + '...') : '空');
                                    console.log('[阿里云盘扫码] userName:', userName);
                                    
                                    if (!accessTokenFromBiz || !accessTokenFromBiz.startsWith('eyJ')) {
                                        for (const key of Object.keys(pds)) {
                                            const val = pds[key];
                                            if (typeof val === 'string' && val.startsWith('eyJ') && val.length > 200 && key !== 'refreshToken' && key !== 'refresh_token') {
                                                console.log('[阿里云盘扫码] 在pds["' + key + '"]中发现JWT token');
                                                accessTokenFromBiz = val;
                                                break;
                                            }
                                        }
                                    }
                                } catch (decodeErr) {
                                    console.log('[阿里云盘扫码] bizExt解码失败:', decodeErr.message);
                                    console.log('[阿里云盘扫码] bizExt前100字符:', bizExt.substring(0, 100));
                                    try {
                                        const bizData = JSON.parse(bizExt);
                                        const pds = bizData.pds_login_result || {};
                                        refreshToken = pds.refreshToken || pds.refresh_token || '';
                                        accessTokenFromBiz = pds.accessToken || pds.access_token || '';
                                        userName = pds.nickName || pds.userName || '';
                                        console.log('[阿里云盘扫码] 直接JSON解析成功, refreshToken:', refreshToken ? '有' : '无', 'accessToken:', accessTokenFromBiz ? '有' : '无');
                                    } catch (e2) {
                                        console.log('[阿里云盘扫码] 直接JSON解析也失败:', e2.message);
                                    }
                                }
                            }
                            
                            let authorization = null;
                            
                            if (accessTokenFromBiz && accessTokenFromBiz.startsWith('eyJ')) {
                                authorization = accessTokenFromBiz;
                                console.log('[阿里云盘扫码] ✅ 直接从bizExt获取到accessToken(JWT), 长度:', authorization.length, '无需额外请求');
                            }
                            
                            if (refreshToken && !authorization) {
                                try {
                                    console.log('[阿里云盘扫码] 尝试方式1: open.aliyundrive.com/oauth/access_token');
                                    const tokenResponse = await fetch('https://open.aliyundrive.com/oauth/access_token', {
                                        method: 'POST',
                                        headers: {
                                            'Accept': 'application/json, text/plain, */*',
                                            'Content-Type': 'application/json; charset=UTF-8',
                                            'Origin': 'https://www.alipan.com',
                                            'Referer': 'https://www.alipan.com/',
                                            'User-Agent': ALIYUN_UA
                                        },
                                        body: JSON.stringify({
                                            client_id: '25dzX3vbYqktVxyX',
                                            grant_type: 'refresh_token',
                                            refresh_token: refreshToken
                                        })
                                    });
                                    const tokenResult = await tokenResponse.json();
                                    console.log('[阿里云盘扫码] 方式1 响应:', JSON.stringify(tokenResult).substring(0, 300));
                                    authorization = tokenResult.access_token || null;
                                    if (authorization) {
                                        console.log('[阿里云盘扫码] 方式1 成功获取access_token, 长度:', authorization.length);
                                    } else {
                                        console.log('[阿里云盘扫码] 方式1 未获取到access_token, 响应code:', tokenResult.code, 'message:', tokenResult.message || '');
                                    }
                                } catch (tokenErr) {
                                    console.log('[阿里云盘扫码] 方式1 失败:', tokenErr.message);
                                }
                                
                                // 方式2: 用 refreshToken 通过 api.aliyundrive.com/token/get 获取 access_token
                                if (!authorization) {
                                    try {
                                        console.log('[阿里云盘扫码] 尝试方式2: api.aliyundrive.com/token/get');
                                        const tokenResponse2 = await fetch('https://api.aliyundrive.com/token/get', {
                                            method: 'POST',
                                            headers: {
                                                'Accept': 'application/json, text/plain, */*',
                                                'Content-Type': 'application/json; charset=UTF-8',
                                                'Origin': 'https://www.alipan.com',
                                                'Referer': 'https://www.alipan.com/',
                                                'User-Agent': ALIYUN_UA
                                            },
                                            body: JSON.stringify({
                                                client_id: '25dzX3vbYqktVxyX',
                                                grant_type: 'refresh_token',
                                                refresh_token: refreshToken
                                            })
                                        });
                                        const tokenResult2 = await tokenResponse2.json();
                                        console.log('[阿里云盘扫码] 方式2 响应:', JSON.stringify(tokenResult2).substring(0, 300));
                                        authorization = tokenResult2.access_token || tokenResult2.authorization || null;
                                        if (authorization) {
                                            console.log('[阿里云盘扫码] 方式2 成功获取access_token, 长度:', authorization.length);
                                        } else {
                                            console.log('[阿里云盘扫码] 方式2 未获取到access_token, 响应code:', tokenResult2.code, 'message:', tokenResult2.message || '');
                                        }
                                    } catch (tokenErr2) {
                                        console.log('[阿里云盘扫码] 方式2 失败:', tokenErr2.message);
                                    }
                                }
                                
                                // 方式3: 用 refreshToken 通过 auth.alipan.com 获取 access_token (浏览器实际流程)
                                if (!authorization) {
                                    try {
                                        console.log('[阿里云盘扫码] 尝试方式3: auth.alipan.com/v2/oauth/token_login');
                                        const tokenLoginResponse = await fetch('https://auth.alipan.com/v2/oauth/token_login', {
                                            method: 'POST',
                                            headers: {
                                                'Accept': 'application/json, text/plain, */*',
                                                'Content-Type': 'application/json; charset=UTF-8',
                                                'Origin': 'https://auth.alipan.com',
                                                'Referer': 'https://auth.alipan.com/v2/oauth/authorize?client_id=25dzX3vbYqktVxyX&redirect_uri=https%3A%2F%2Fwww.alipan.com%2Fsign%2Fcallback&response_type=code&login_type=custom&state=%7B%22origin%22%3A%22https%3A%2F%2Fwww.alipan.com%22%7D',
                                                'User-Agent': ALIYUN_UA
                                            },
                                            body: JSON.stringify({ token: refreshToken })
                                        });
                                        const tokenLoginResult = await tokenLoginResponse.json();
                                        console.log('[阿里云盘扫码] 方式3 token_login 响应:', JSON.stringify(tokenLoginResult));
                                        
                                        if (tokenLoginResponse.status !== 200 || tokenLoginResult.code === 'Forbidden') {
                                            console.log('[阿里云盘扫码] 方式3 token_login 失败，HTTP', tokenLoginResponse.status);
                                        } else {
                                            const gotoUrl = tokenLoginResult.goto || tokenLoginResult.redirect_uri || '';
                                            let authCode = '';
                                            if (tokenLoginResult.code && !['Forbidden', 'InvalidRequest', 'InvalidParameter'].includes(tokenLoginResult.code)) {
                                                authCode = tokenLoginResult.code;
                                            }
                                            if (!authCode && gotoUrl) {
                                                try {
                                                    const gotoUrlObj = new URL(gotoUrl);
                                                    authCode = gotoUrlObj.searchParams.get('code') || '';
                                                } catch (e) {
                                                    const codeMatch = gotoUrl.match(/code=([^&]+)/);
                                                    if (codeMatch) authCode = codeMatch[1];
                                                }
                                            }
                                            
                                            if (authCode) {
                                                console.log('[阿里云盘扫码] 方式3 获取到授权码，用code换取access_token');
                                                const tokenGetResponse = await fetch('https://api.aliyundrive.com/token/get', {
                                                    method: 'POST',
                                                    headers: {
                                                        'Accept': 'application/json, text/plain, */*',
                                                        'Content-Type': 'application/json; charset=UTF-8',
                                                        'Origin': 'https://www.alipan.com',
                                                        'Referer': 'https://www.alipan.com/',
                                                        'User-Agent': ALIYUN_UA
                                                    },
                                                    body: JSON.stringify({
                                                        code: authCode,
                                                        loginType: 'normal',
                                                        deviceId: 'nfd_alipan_scanner_001'
                                                    })
                                                });
                                                const tokenGetResult = await tokenGetResponse.json();
                                                console.log('[阿里云盘扫码] 方式3 token/get 响应:', JSON.stringify(tokenGetResult).substring(0, 500));
                                                authorization = tokenGetResult.access_token || null;
                                                if (authorization) {
                                                    console.log('[阿里云盘扫码] 方式3 成功获取access_token, 长度:', authorization.length);
                                                    if (tokenGetResult.refresh_token) {
                                                        refreshToken = tokenGetResult.refresh_token;
                                                        console.log('[阿里云盘扫码] 方式3 同时获取到新refresh_token');
                                                    }
                                                } else {
                                                    console.log('[阿里云盘扫码] 方式3 token/get 未返回access_token');
                                                }
                                            } else {
                                                console.log('[阿里云盘扫码] 方式3 未能提取授权码, goto:', gotoUrl ? gotoUrl.substring(0, 200) : '空');
                                            }
                                        }
                                    } catch (tokenErr3) {
                                        console.log('[阿里云盘扫码] 方式3 失败:', tokenErr3.message);
                                    }
                                }
                            }
                            
                            if (authorization) {
                                if (env && (env.jxpan || env.jx)) {
                                    await storePut(env, 'aliyun_login_default', authorization, { expirationTtl: 86400 });
                                    if (refreshToken) {
                                        await storePut(env, 'aliyun_refresh_token', refreshToken, { expirationTtl: 86400 * 30 });
                                    }
                                }
                                console.log('[*] 阿里云盘登录成功！用户:', userName, 'Authorization已保存, 长度:', authorization.length);
                                return new Response(JSON.stringify({
                                    code: 200, msg: '登录成功', success: true,
                                    data: { status: 'confirmed', authorization: authorization, user_name: userName }
                                }), { headers: { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*' } });
                            }
                            
                            if (refreshToken && refreshToken.startsWith('eyJ')) {
                                if (env && (env.jxpan || env.jx)) {
                                    await storePut(env, 'aliyun_login_default', refreshToken, { expirationTtl: 86400 });
                                    await storePut(env, 'aliyun_refresh_token', refreshToken, { expirationTtl: 86400 * 30 });
                                }
                                console.log('[*] 阿里云盘登录成功（JWT refreshToken作为Authorization）！用户:', userName);
                                return new Response(JSON.stringify({
                                    code: 200, msg: '登录成功（refreshToken模式）', success: true,
                                    data: { status: 'confirmed', authorization: refreshToken, user_name: userName }
                                }), { headers: { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*' } });
                            }
                            
                            if (refreshToken) {
                                if (env && (env.jxpan || env.jx)) {
                                    await storePut(env, 'aliyun_login_default', refreshToken, { expirationTtl: 86400 });
                                }
                                console.log('[*] 阿里云盘登录成功（非JWT refreshToken备用）！用户:', userName);
                                return new Response(JSON.stringify({
                                    code: 200, msg: '登录成功（refreshToken模式，可能无法直接用于解析）', success: true,
                                    data: { status: 'confirmed', authorization: refreshToken, user_name: userName }
                                }), { headers: { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*' } });
                            }
                            
                            return new Response(JSON.stringify({
                                code: 200, msg: '已确认但获取token失败', success: true,
                                data: { status: 'confirmed' }
                            }), { headers: { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*' } });
                            
                        } else if (status === 'SCANED') {
                            return new Response(JSON.stringify({
                                code: 200, msg: '已扫码', success: true,
                                data: { status: 'scaned' }
                            }), { headers: { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*' } });
                            
                        } else if (status === 'EXPIRED') {
                            return new Response(JSON.stringify({
                                code: 200, msg: '二维码已过期', success: true,
                                data: { status: 'expired' }
                            }), { headers: { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*' } });
                            
                        } else {
                            return new Response(JSON.stringify({
                                code: 200, msg: '等待扫码', success: true,
                                data: { status: 'pending' }
                            }), { headers: { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*' } });
                        }
                    }
                    
                    return new Response(JSON.stringify({
                        code: 200, msg: '等待扫码', success: true,
                        data: { status: 'pending' }
                    }), { headers: { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*' } });
                    
                } catch (e) {
                    console.log('[!] 轮询阿里云盘扫码状态失败:', e);
                    return new Response(JSON.stringify({
                        code: 500, msg: '轮询失败: ' + e.message, success: false, data: null
                    }), { headers: { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*' } });
                }
            }

            // 阿里云盘扫码登录 - 保存登录信息
            if (action === 'aliyun_qr_save') {
                try {
                    const authorization = url.searchParams.get('authorization');
                    
                    if (authorization) {
                        if (env && (env.jxpan || env.jx)) {
                            await storePut(env, 'aliyun_login_default', authorization, { expirationTtl: 86400 });
                            console.log('[*] 阿里云盘登录信息已保存到KV默认配置');
                        }
                        
                        return new Response(JSON.stringify({
                            code: 200,
                            msg: '登录信息已保存到默认配置',
                            success: true,
                            data: {
                                authorization: authorization
                            }
                        }), {
                            headers: {
                                'Content-Type': 'application/json; charset=utf-8',
                                'Access-Control-Allow-Origin': '*'
                            }
                        });
                    }
                    
                    const lgToken = url.searchParams.get('lgToken');
                    const ck = url.searchParams.get('ck');
                    let savedAuth = null;
                    
                    if (lgToken) {
                        try {
                            const tokenResponse = await fetch('https://passport.aliyundrive.com/qrcodeCheck.htm?lgToken=' + encodeURIComponent(lgToken) + '&_from=havana', {
                                method: 'GET',
                                headers: {
                                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                                    'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
                                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                                    'Referer': 'https://passport.alipan.com/'
                                }
                            });
                            
                            const setCookies = tokenResponse.headers.get('set-cookie');
                            if (setCookies) {
                                const match = setCookies.match(/Authorization=([^;]+)/);
                                if (match) savedAuth = match[1];
                            }
                        } catch (e) {
                            console.log('[阿里云盘扫码] lgToken方式失败:', e);
                        }
                    }
                    
                    if (!savedAuth && ck) {
                        try {
                            const apiResponse = await fetch('https://api.aliyundrive.com/v2/user/get_login_info', {
                                method: 'POST',
                                headers: {
                                    'Accept': 'application/json, text/plain, */*',
                                    'Content-Type': 'application/json;charset=UTF-8',
                                    'Origin': 'https://www.alipan.com',
                                    'Referer': 'https://www.alipan.com/',
                                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                                    'Cookie': 'ick=' + ck
                                },
                                body: JSON.stringify({})
                            });
                            
                            if (apiResponse.ok) {
                                const apiResult = await apiResponse.json();
                                if (apiResult.authorization) {
                                    savedAuth = apiResult.authorization;
                                }
                            }
                        } catch (e) {
                            console.log('[阿里云盘扫码] ck方式失败:', e);
                        }
                    }
                    
                    if (savedAuth) {
                        if (env && (env.jxpan || env.jx)) {
                            await storePut(env, 'aliyun_login_default', savedAuth, { expirationTtl: 86400 });
                            console.log('[*] 阿里云盘登录信息已保存到KV默认配置');
                        }
                        
                        return new Response(JSON.stringify({
                            code: 200,
                            msg: '登录信息已保存到默认配置',
                            success: true,
                            data: {
                                authorization: savedAuth
                            }
                        }), {
                            headers: {
                                'Content-Type': 'application/json; charset=utf-8',
                                'Access-Control-Allow-Origin': '*'
                            }
                        });
                    } else {
                        return new Response(JSON.stringify({
                            code: 500,
                            msg: '获取Authorization失败',
                            success: false,
                            data: null
                        }), {
                            headers: {
                                'Content-Type': 'application/json; charset=utf-8',
                                'Access-Control-Allow-Origin': '*'
                            }
                        });
                    }
                } catch (e) {
                    console.log('[!] 保存阿里云盘登录信息失败:', e);
                    return new Response(JSON.stringify({
                        code: 500,
                        msg: '保存失败: ' + e.message,
                        success: false,
                        data: null
                    }), {
                        headers: {
                            'Content-Type': 'application/json; charset=utf-8',
                            'Access-Control-Allow-Origin': '*'
                        }
                    });
                }
            }

            // 登录状态API - 返回所有网盘状态
            if (action === 'login_status') {
                const config = getConfig(env);
                const result = {
                    guangya: { logged_in: false, source: null, loginInfo: null },
                    aliyun: { logged_in: false, source: null, loginInfo: null },
                    quark: { logged_in: false, source: null, loginInfo: null },
                    uc: { logged_in: false, source: null, loginInfo: null },
                    mcloud: { logged_in: false, source: null, loginInfo: null }
                };

                // 光鸭云盘
                if (config.guangya.loginInfo) {
                    try {
                        const loginInfo = typeof config.guangya.loginInfo === 'string' 
                            ? JSON.parse(config.guangya.loginInfo) 
                            : config.guangya.loginInfo;
                        if (loginInfo && loginInfo.access_token) {
                            result.guangya = { logged_in: true, source: 'env_var', loginInfo };
                        }
                    } catch (e) {}
                }
                if (!result.guangya.logged_in && (env.jxpan || env.jx)) {
                    const stored = await storeGet(env, 'gy_login_default');
                    if (stored) {
                        try {
                            const decrypted = typeof stored === 'string' ? decryptFromKV(stored) : stored;
                            if (decrypted && decrypted.access_token) {
                                result.guangya = { logged_in: true, source: 'default_config', loginInfo: decrypted };
                            }
                        } catch (e) {}
                    }
                }

                // 阿里云盘
                if (config.aliyun.authorization) {
                    result.aliyun = { 
                        logged_in: true, 
                        source: 'env_var', 
                        loginInfo: { authorization: config.aliyun.authorization, type: config.aliyun.authorization.startsWith('eyJ') && config.aliyun.authorization.length > 200 ? 'JWT Access Token' : 'Authorization' } 
                    };
                }
                if (!result.aliyun.logged_in && (env.jxpan || env.jx)) {
                    const stored = await storeGet(env, 'aliyun_login_default');
                    if (stored) {
                        const authVal = typeof stored === 'string' ? stored : JSON.stringify(stored);
                        let refreshToken = null;
                        if (env.jxpan || env.jx) {
                            const rt = await storeGet(env, 'aliyun_refresh_token');
                            if (rt) refreshToken = rt;
                        }
                        result.aliyun = { 
                            logged_in: true, 
                            source: 'default_config', 
                            loginInfo: { 
                                authorization: authVal, 
                                refresh_token: refreshToken,
                                type: authVal.startsWith('eyJ') && authVal.length > 200 ? 'JWT Access Token' : (authVal.startsWith('Bearer ') ? 'Bearer Token' : 'Token')
                            } 
                        };
                    }
                }

                // 夸克网盘
                if (config.quark.cookie) {
                    result.quark = { logged_in: true, source: 'env_var', loginInfo: { cookie: config.quark.cookie } };
                }
                if (!result.quark.logged_in && (env.jxpan || env.jx)) {
                    const stored = await storeGet(env, 'quark_login_default');
                    if (stored) {
                        const cookieVal = typeof stored === 'string' ? decryptFromKV(stored) : stored;
                        result.quark = { logged_in: true, source: 'default_config', loginInfo: { cookie: cookieVal } };
                    }
                }

                // UC网盘
                if (config.uc.cookie) {
                    result.uc = { logged_in: true, source: 'env_var', loginInfo: { cookie: config.uc.cookie } };
                }
                if (!result.uc.logged_in && (env.jxpan || env.jx)) {
                    const stored = await storeGet(env, 'uc_login_default');
                    if (stored) {
                        const cookieVal = typeof stored === 'string' ? decryptFromKV(stored) : stored;
                        result.uc = { logged_in: true, source: 'default_config', loginInfo: { cookie: cookieVal } };
                    }
                }

                // 移动云盘
                if (config.mcloud.authorization || config.mcloud.cookie) {
                    result.mcloud = { 
                        logged_in: true, 
                        source: 'env_var', 
                        loginInfo: { 
                            authorization: config.mcloud.authorization || null,
                            cookie: config.mcloud.cookie || null
                        } 
                    };
                }
                if (!result.mcloud.logged_in && (env.jxpan || env.jx)) {
                    const stored = await storeGet(env, 'mcloud_login_default');
                    if (stored) {
                        const mcloudData = typeof stored === 'string' ? decryptFromKV(stored) : stored;
                        result.mcloud = { 
                            logged_in: true, 
                            source: 'default_config', 
                            loginInfo: { 
                                authorization: mcloudData.authorization || mcloudData.auth || null,
                                cookie: mcloudData.cookie || null,
                                phone: mcloudData.phone || null
                            } 
                        };
                    }
                }

                return new Response(JSON.stringify({
                    code: 200,
                    msg: '获取登录状态成功',
                    success: true,
                    data: result
                }), {
                    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*' }
                });
            }

            // ==================== UC网盘扫码登录 ====================
            if (action === 'uc_qrcode') {
                try {
                    const ts = Date.now().toString();
                    const params = new URLSearchParams({
                        __dt: '792565',
                        __t: ts
                    });
                    const formData = new URLSearchParams({
                        client_id: '381',
                        v: '1.2',
                        request_id: ts
                    });
                    const response = await fetch('https://api.open.uc.cn/cas/ajax/getTokenForQrcodeLogin?' + params.toString(), {
                        method: 'POST',
                        headers: {
                            'accept': 'application/json, text/plain, */*',
                            'content-type': 'application/x-www-form-urlencoded',
                            'origin': 'https://drive.uc.cn',
                            'referer': 'https://drive.uc.cn/',
                            'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36'
                        },
                        body: formData.toString()
                    });
                    const result = await response.json();
                    if (result.status === 2000000 && result.data && result.data.members && result.data.members.token) {
                        const token = result.data.members.token;
                        const ucParamStr = 'dsdnfrpfbivesscpgimibtbmnijblauputogpintnwktprchmt';
                        const ucBizStr = encodeURIComponent('S:custom|C:titlebar_fix');
                        const qrUrl = `https://su.uc.cn/1_n0ZCv?uc_param_str=${ucParamStr}&token=${token}&client_id=381&uc_biz_str=${ucBizStr}`;
                        if (env && (env.jxpan || env.jx)) {
                            await storePut(env, 'uc_qr_token', token, { expirationTtl: 600 });
                        }
                        return new Response(JSON.stringify({
                            code: 200, msg: '获取二维码成功', success: true,
                            data: { token: token, qr_url: qrUrl, expires_in: 600, interval: 3 }
                        }), { headers: { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*' } });
                    } else {
                        return new Response(JSON.stringify({ code: 500, msg: '获取Token失败: ' + JSON.stringify(result), success: false, data: null }), { headers: { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*' } });
                    }
                } catch (e) {
                    return new Response(JSON.stringify({ code: 500, msg: '获取二维码失败: ' + e.message, success: false, data: null }), { headers: { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*' } });
                }
            }

            if (action === 'uc_qr_poll') {
                try {
                    const token = url.searchParams.get('token');
                    if (!token) return new Response(JSON.stringify({ code: 400, msg: '缺少token参数', success: false }), { headers: { 'Content-Type': 'application/json; charset=utf-8' } });
                    const ts = Date.now().toString();
                    const formData = new URLSearchParams({ client_id: '381', v: '1.2', request_id: ts, token: token });
                    const response = await fetch('https://api.open.uc.cn/cas/ajax/getServiceTicketByQrcodeToken', {
                        method: 'POST',
                        headers: {
                            'accept': 'application/json, text/plain, */*',
                            'content-type': 'application/x-www-form-urlencoded',
                            'origin': 'https://drive.uc.cn',
                            'referer': 'https://drive.uc.cn/',
                            'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36'
                        },
                        body: formData.toString()
                    });
                    const result = await response.json();
                    const status = result.status;
                    if (status === 2000000) {
                        const members = result.data.members;
                        const ticket = members.ticket || members.service_ticket;
                        if (ticket) {
                            return new Response(JSON.stringify({ code: 200, msg: '登录成功', success: true, data: { status: 'confirmed', ticket: ticket } }), { headers: { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*' } });
                        }
                        return new Response(JSON.stringify({ code: 200, msg: '等待扫码', success: true, data: { status: 'waiting' } }), { headers: { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*' } });
                    } else if (status === 50004001) {
                        return new Response(JSON.stringify({ code: 200, msg: '等待扫码', success: true, data: { status: 'waiting' } }), { headers: { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*' } });
                    } else if (status === 50004002) {
                        return new Response(JSON.stringify({ code: 200, msg: '已过期', success: true, data: { status: 'expired' } }), { headers: { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*' } });
                    }
                    return new Response(JSON.stringify({ code: 200, msg: '等待扫码', success: true, data: { status: 'waiting' } }), { headers: { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*' } });
                } catch (e) {
                    return new Response(JSON.stringify({ code: 500, msg: '轮询失败: ' + e.message, success: false, data: { status: 'waiting' } }), { headers: { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*' } });
                }
            }

            if (action === 'uc_qr_save') {
                try {
                    const cookie = url.searchParams.get('cookie');
                    if (!cookie) return new Response(JSON.stringify({ code: 400, msg: '缺少cookie参数', success: false }), { headers: { 'Content-Type': 'application/json; charset=utf-8' } });
                    if (env && (env.jxpan || env.jx)) {
                        await storePut(env, 'uc_login_default', encryptToKV({ cookie: cookie, timestamp: Date.now() }));
                    }
                    return new Response(JSON.stringify({ code: 200, msg: '保存成功', success: true }), { headers: { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*' } });
                } catch (e) {
                    return new Response(JSON.stringify({ code: 500, msg: '保存失败: ' + e.message, success: false }), { headers: { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*' } });
                }
            }

            // ==================== 联通云盘扫码登录 ====================
            if (action === 'unicom_qrcode') {
                try {
                    const response = await fetch('https://panservice.mail.wo.cn/wohome/open/v1/QRCode/generate', {
                        method: 'GET',
                        headers: {
                            'Accept': 'application/json, text/plain, */*',
                            'Origin': 'https://pan.wo.cn',
                            'Referer': 'https://pan.wo.cn/',
                            'X-YP-Client-Id': '1001000021',
                            'client-id': '1001000021',
                            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36'
                        }
                    });
                    const result = await response.json();
                    if (result.meta && result.meta.code === '200' && result.result) {
                        const qrImage = result.result.image;
                        const qrUuid = result.result.uuid;
                        if (env && (env.jxpan || env.jx)) {
                            await storePut(env, 'unicom_qr_uuid', qrUuid, { expirationTtl: 300 });
                        }
                        return new Response(JSON.stringify({
                            code: 200, msg: '获取二维码成功', success: true,
                            data: { uuid: qrUuid, qr_image: qrImage, expires_in: 300, interval: 3 }
                        }), { headers: { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*' } });
                    } else {
                        return new Response(JSON.stringify({ code: 500, msg: '获取二维码失败', success: false, data: null }), { headers: { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*' } });
                    }
                } catch (e) {
                    return new Response(JSON.stringify({ code: 500, msg: '获取二维码失败: ' + e.message, success: false, data: null }), { headers: { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*' } });
                }
            }

            if (action === 'unicom_qr_poll') {
                try {
                    const qrUuid = url.searchParams.get('uuid');
                    if (!qrUuid) return new Response(JSON.stringify({ code: 400, msg: '缺少uuid参数', success: false }), { headers: { 'Content-Type': 'application/json; charset=utf-8' } });
                    const response = await fetch('https://panservice.mail.wo.cn/wohome/open/v1/QRCode/query?uuid=' + encodeURIComponent(qrUuid), {
                        method: 'GET',
                        headers: {
                            'Accept': 'application/json, text/plain, */*',
                            'Origin': 'https://pan.wo.cn',
                            'Referer': 'https://pan.wo.cn/',
                            'X-YP-Client-Id': '1001000021',
                            'client-id': '1001000021',
                            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36'
                        }
                    });
                    const result = await response.json();
                    if (!result.result) return new Response(JSON.stringify({ code: 200, msg: '等待扫码', success: true, data: { status: 'waiting' } }), { headers: { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*' } });
                    const state = result.result.state;
                    if (state === 1) {
                        return new Response(JSON.stringify({ code: 200, msg: '等待扫码', success: true, data: { status: 'waiting' } }), { headers: { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*' } });
                    } else if (state === 2) {
                        return new Response(JSON.stringify({ code: 200, msg: '已扫码', success: true, data: { status: 'scanned' } }), { headers: { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*' } });
                    } else if (state === 3) {
                        const at = result.result.token;
                        const rt = result.result.refreshToken;
                        return new Response(JSON.stringify({ code: 200, msg: '登录成功', success: true, data: { status: 'confirmed', at: at, rt: rt } }), { headers: { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*' } });
                    } else if (state === 4) {
                        return new Response(JSON.stringify({ code: 200, msg: '已过期', success: true, data: { status: 'expired' } }), { headers: { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*' } });
                    }
                    return new Response(JSON.stringify({ code: 200, msg: '等待扫码', success: true, data: { status: 'waiting' } }), { headers: { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*' } });
                } catch (e) {
                    return new Response(JSON.stringify({ code: 500, msg: '轮询失败: ' + e.message, success: false, data: { status: 'waiting' } }), { headers: { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*' } });
                }
            }

            if (action === 'unicom_qr_save') {
                try {
                    const at = url.searchParams.get('at');
                    const rt = url.searchParams.get('rt');
                    if (!at) return new Response(JSON.stringify({ code: 400, msg: '缺少at参数', success: false }), { headers: { 'Content-Type': 'application/json; charset=utf-8' } });
                    if (env && (env.jxpan || env.jx)) {
                        await storePut(env, 'unicom_login_default', encryptToKV({ at: at, rt: rt, timestamp: Date.now() }));
                    }
                    return new Response(JSON.stringify({ code: 200, msg: '保存成功', success: true }), { headers: { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*' } });
                } catch (e) {
                    return new Response(JSON.stringify({ code: 500, msg: '保存失败: ' + e.message, success: false }), { headers: { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*' } });
                }
            }

            // ==================== 夸克网盘扫码登录 ====================
            if (action === 'quark_qrcode') {
                try {
                    const requestId = crypto.randomUUID().replace(/-/g, '');
                    const response = await fetch('https://uop.quark.cn/cas/ajax/getTokenForQrcodeLogin?client_id=532&v=1.2&request_id=' + requestId, {
                        method: 'GET',
                        headers: {
                            'Accept': 'application/json, text/plain, */*',
                            'Referer': 'https://pan.quark.cn/',
                            'Origin': 'https://pan.quark.cn',
                            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36'
                        }
                    });
                    const result = await response.json();
                    if (result.status === 2000000 && result.data && result.data.members && result.data.members.token) {
                        const token = result.data.members.token;
                        const qrUrl = `https://su.quark.cn/4_eMHBJ?token=${token}&client_id=532&ssb=weblogin&uc_param_str=&uc_biz_str=S%3Acustom%7COPT%3ASAREA%400%7COPT%3AIMMERSIVE%401%7COPT%3ABACK_BTN_STYLE%400`;
                        if (env && (env.jxpan || env.jx)) {
                            await storePut(env, 'quark_qr_token', token, { expirationTtl: 600 });
                        }
                        return new Response(JSON.stringify({
                            code: 200, msg: '获取二维码成功', success: true,
                            data: { token: token, qr_url: qrUrl, expires_in: 600, interval: 3 }
                        }), { headers: { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*' } });
                    } else {
                        return new Response(JSON.stringify({ code: 500, msg: '获取Token失败', success: false, data: null }), { headers: { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*' } });
                    }
                } catch (e) {
                    return new Response(JSON.stringify({ code: 500, msg: '获取二维码失败: ' + e.message, success: false, data: null }), { headers: { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*' } });
                }
            }

            if (action === 'quark_qr_poll') {
                try {
                    const token = url.searchParams.get('token');
                    if (!token) return new Response(JSON.stringify({ code: 400, msg: '缺少token参数', success: false }), { headers: { 'Content-Type': 'application/json; charset=utf-8' } });
                    const requestId = crypto.randomUUID().replace(/-/g, '');
                    const response = await fetch('https://uop.quark.cn/cas/ajax/getServiceTicketByQrcodeToken?client_id=532&v=1.2&token=' + encodeURIComponent(token) + '&request_id=' + requestId, {
                        method: 'GET',
                        headers: {
                            'Accept': 'application/json, text/plain, */*',
                            'Referer': 'https://pan.quark.cn/',
                            'Origin': 'https://pan.quark.cn',
                            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36'
                        }
                    });
                    const result = await response.json();
                    const status = result.status;
                    if (status === 2000000) {
                        const members = result.data.members;
                        const ticket = members.service_ticket || members.ticket;
                        if (ticket) {
                            return new Response(JSON.stringify({ code: 200, msg: '登录成功', success: true, data: { status: 'confirmed', ticket: ticket } }), { headers: { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*' } });
                        }
                        return new Response(JSON.stringify({ code: 200, msg: '等待扫码', success: true, data: { status: 'waiting' } }), { headers: { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*' } });
                    } else if (status === 50004001) {
                        return new Response(JSON.stringify({ code: 200, msg: '等待扫码', success: true, data: { status: 'waiting' } }), { headers: { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*' } });
                    } else if (status === 50004002) {
                        return new Response(JSON.stringify({ code: 200, msg: '已过期', success: true, data: { status: 'expired' } }), { headers: { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*' } });
                    }
                    return new Response(JSON.stringify({ code: 200, msg: '等待扫码', success: true, data: { status: 'waiting' } }), { headers: { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*' } });
                } catch (e) {
                    return new Response(JSON.stringify({ code: 500, msg: '轮询失败: ' + e.message, success: false, data: { status: 'waiting' } }), { headers: { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*' } });
                }
            }

            if (action === 'quark_qr_save') {
                try {
                    const cookie = url.searchParams.get('cookie');
                    if (!cookie) return new Response(JSON.stringify({ code: 400, msg: '缺少cookie参数', success: false }), { headers: { 'Content-Type': 'application/json; charset=utf-8' } });
                    if (env && (env.jxpan || env.jx)) {
                        await storePut(env, 'quark_login_default', encryptToKV({ cookie: cookie, timestamp: Date.now() }));
                    }
                    return new Response(JSON.stringify({ code: 200, msg: '保存成功', success: true }), { headers: { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*' } });
                } catch (e) {
                    return new Response(JSON.stringify({ code: 500, msg: '保存失败: ' + e.message, success: false }), { headers: { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*' } });
                }
            }

            // ==================== 腾讯微云扫码登录 ====================
            if (action === 'weiyun_qrcode') {
                try {
                    const appid = 'wx7d59d32f953438c0';
                    const state = '1942086690';
                    const redirectUri = encodeURIComponent('https://user.weiyun.com/login/verify_code?g_tk=5381&appid=wx7d59d32f953438c0&action=web_login&callback=weiyun');
                    const qrConnectUrl = `https://open.weixin.qq.com/connect/qrconnect?appid=${appid}&redirect_uri=${redirectUri}&response_type=code&scope=snsapi_login&state=${state}&self_redirect=true&stylelite=1`;
                    const response = await fetch(qrConnectUrl, {
                        headers: {
                            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                            'Referer': 'https://open.weixin.qq.com/'
                        }
                    });
                    const html = await response.text();
                    const uuidMatch = html.match(/uuid=([a-zA-Z0-9_-]+)/);
                    if (uuidMatch && uuidMatch[1]) {
                        const wxUuid = uuidMatch[1];
                        const qrImageUrl = `https://open.weixin.qq.com/connect/qrcode/${wxUuid}`;
                        if (env && (env.jxpan || env.jx)) {
                            await storePut(env, 'weiyun_qr_uuid', wxUuid, { expirationTtl: 300 });
                        }
                        return new Response(JSON.stringify({
                            code: 200, msg: '获取二维码成功', success: true,
                            data: { uuid: wxUuid, qr_image_url: qrImageUrl, expires_in: 300, interval: 3 }
                        }), { headers: { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*' } });
                    } else {
                        return new Response(JSON.stringify({ code: 500, msg: '获取UUID失败', success: false, data: null }), { headers: { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*' } });
                    }
                } catch (e) {
                    return new Response(JSON.stringify({ code: 500, msg: '获取二维码失败: ' + e.message, success: false, data: null }), { headers: { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*' } });
                }
            }

            if (action === 'weiyun_qr_poll') {
                try {
                    const wxUuid = url.searchParams.get('uuid');
                    if (!wxUuid) return new Response(JSON.stringify({ code: 400, msg: '缺少uuid参数', success: false }), { headers: { 'Content-Type': 'application/json; charset=utf-8' } });
                    const ts = Date.now().toString();
                    const response = await fetch('https://lp.open.weixin.qq.com/connect/l/qrconnect?uuid=' + encodeURIComponent(wxUuid) + '&_=' + ts, {
                        headers: {
                            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                            'Referer': 'https://open.weixin.qq.com/'
                        }
                    });
                    const content = await response.text();
                    const codeMatch = content.match(/window\.wx_errcode=(\d+);/);
                    if (!codeMatch) {
                        return new Response(JSON.stringify({ code: 200, msg: '等待扫码', success: true, data: { status: 'waiting' } }), { headers: { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*' } });
                    }
                    const errcode = codeMatch[1];
                    if (errcode === '405') {
                        const authCodeMatch = content.match(/window\.wx_code='([^']+)';/);
                        const authCode = authCodeMatch ? authCodeMatch[1] : '';
                        return new Response(JSON.stringify({ code: 200, msg: '登录成功', success: true, data: { status: 'confirmed', auth_code: authCode } }), { headers: { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*' } });
                    } else if (errcode === '404') {
                        return new Response(JSON.stringify({ code: 200, msg: '已扫码', success: true, data: { status: 'scanned' } }), { headers: { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*' } });
                    } else if (errcode === '402') {
                        return new Response(JSON.stringify({ code: 200, msg: '已过期', success: true, data: { status: 'expired' } }), { headers: { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*' } });
                    }
                    return new Response(JSON.stringify({ code: 200, msg: '等待扫码', success: true, data: { status: 'waiting' } }), { headers: { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*' } });
                } catch (e) {
                    return new Response(JSON.stringify({ code: 500, msg: '轮询失败: ' + e.message, success: false, data: { status: 'waiting' } }), { headers: { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*' } });
                }
            }

            if (action === 'weiyun_qr_save') {
                try {
                    const cookie = url.searchParams.get('cookie');
                    if (!cookie) return new Response(JSON.stringify({ code: 400, msg: '缺少cookie参数', success: false }), { headers: { 'Content-Type': 'application/json; charset=utf-8' } });
                    if (env && (env.jxpan || env.jx)) {
                        await storePut(env, 'weiyun_login_default', encryptToKV({ cookie: cookie, timestamp: Date.now() }));
                    }
                    return new Response(JSON.stringify({ code: 200, msg: '保存成功', success: true }), { headers: { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*' } });
                } catch (e) {
                    return new Response(JSON.stringify({ code: 500, msg: '保存失败: ' + e.message, success: false }), { headers: { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*' } });
                }
            }

            // ==================== 移动云盘扫码登录 ====================
            if (action === 'mcloud_qrcode') {
                try {
                    const clientId = '10701';
                    const version = '7.17.2';
                    const deviceId = crypto.randomUUID().replace(/-/g, '').substring(0, 32);
                    const sid = crypto.randomUUID().replace(/-/g, '').substring(0, 16);
                    const aesKey = crypto.randomUUID().replace(/-/g, '').substring(0, 16);

                    const keyBody = { clientCode: clientId, type: '1' };
                    const keySign = generateMcloudSign(keyBody, deviceId, version);
                    const keyHeaders = {
                        'Content-Type': 'application/json;charset=UTF-8',
                        'Accept': 'application/json, text/plain, */*',
                        'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
                        'CMS-DEVICE': 'default',
                        'DNT': '1',
                        'INNER-HCY-ROUTER-HTTPS': '1',
                        'Origin': 'https://yun.139.com',
                        'Referer': 'https://yun.139.com/w/',
                        'caller': 'web',
                        'mcloud-client': clientId,
                        'mcloud-channel': '1000101',
                        'mcloud-route': '001',
                        'mcloud-sign': keySign.signHeader,
                        'mcloud-version': version,
                        'x-deviceinfo': `||9|${version}|edge||${deviceId}||windows 10||zh-CN|||`,
                        'x-yun-channel-source': '10000034',
                        'x-yun-svc-type': '1',
                        'x-SvcType': '1',
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36'
                    };
                    const keyResp = await fetch('https://yun.139.com/orchestration/auth-rebuild/key/v1.0/getRsaPublicKey', {
                        method: 'POST', headers: keyHeaders, body: JSON.stringify(keyBody)
                    });
                    const keyData = await keyResp.json();
                    let mcloudSkey = '';
                    if (keyData.success && keyData.data && keyData.data.publicKey) {
                        const pubKey = keyData.data.publicKey;
                        const rsaKey = parseRsaPublicKey(pubKey);
                        mcloudSkey = rsaPkcs1v15Encrypt(rsaKey.n, rsaKey.e, aesKey);
                    } else {
                        console.log('[移动云盘] 获取RSA公钥失败:', JSON.stringify(keyData));
                    }

                    if (env && (env.jxpan || env.jx)) {
                        await storePut(env, 'mcloud_session', JSON.stringify({ deviceId, sid, aesKey, mcloudSkey }), { expirationTtl: 300 });
                    }
                    const qrUrl = `https://yun.139.com/w/#/qrcLogin?sID=${sid}&dID=${deviceId}&cType=9`;
                    return new Response(JSON.stringify({
                        code: 200, msg: '获取二维码成功', success: true,
                        data: { qr_url: qrUrl, sid: sid, device_id: deviceId, expires_in: 300, interval: 3 }
                    }), { headers: { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*' } });
                } catch (e) {
                    return new Response(JSON.stringify({ code: 500, msg: '获取二维码失败: ' + e.message, success: false, data: null }), { headers: { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*' } });
                }
            }

            if (action === 'mcloud_qr_poll') {
                try {
                    if (!env || !(env.jxpan || env.jx)) return new Response(JSON.stringify({ code: 500, msg: '存储未配置', success: false, data: { status: 'waiting' } }), { headers: { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*' } });
                    const sessionStr = await storeGet(env, 'mcloud_session');
                    if (!sessionStr) return new Response(JSON.stringify({ code: 400, msg: '会话已过期，请重新获取二维码', success: false, data: { status: 'expired' } }), { headers: { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*' } });
                    const session = JSON.parse(sessionStr);
                    const { deviceId, sid, aesKey, mcloudSkey } = session;
                    const clientId = '10701';
                    const version = '7.17.2';

                    const inner = { dycPwd: sid, loginStyle: 'QRCode', clientEnv: '3', setCookie: 0 };
                    const encryptMsg = await aesEcbEncrypt(aesKey, JSON.stringify(inner));
                    const loginBody = { encryptMsg: encryptMsg, clientId: clientId, returnToken: true };
                    const loginSign = generateMcloudSign(loginBody, deviceId, version);
                    const loginHeaders = {
                        'Content-Type': 'application/json;charset=UTF-8',
                        'Accept': 'application/json, text/plain, */*',
                        'Origin': 'https://yun.139.com',
                        'Referer': 'https://yun.139.com/w/',
                        'caller': 'web',
                        'mcloud-client': clientId,
                        'mcloud-channel': '1000101',
                        'mcloud-route': '001',
                        'mcloud-sign': loginSign.signHeader,
                        'mcloud-skey': mcloudSkey || '',
                        'mcloud-version': version,
                        'x-deviceinfo': `||9|${version}|edge||${deviceId}||windows 10||zh-CN|||`,
                        'x-yun-channel-source': '10000034',
                        'x-yun-svc-type': '1',
                        'x-huawei-channelSrc': '10000034',
                        'x-inner-ntwk': '2',
                        'x-m4c-caller': 'PC',
                        'x-m4c-src': '10002',
                        'x-SvcType': '1',
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36'
                    };
                    const loginResp = await fetch('https://yun.139.com/orchestration/auth-rebuild/permission/v1.0/login', {
                        method: 'POST', headers: loginHeaders, body: JSON.stringify(loginBody)
                    });
                    const loginData = await loginResp.json();
                    const data = loginData.data || {};
                    const result = data.result || {};
                    const resCode = result.resultCode || '';

                    if (loginData.success && resCode === '0') {
                        const token = data.authToken || data.token;
                        if (token) {
                            let phone = '';
                            try { phone = atob(data.encryptAccount || ''); } catch (e) { phone = data.simplifyAccount || ''; }
                            const authStr = `pc:${phone}:${token}`;
                            const authorization = 'Basic ' + btoa(authStr);
                            return new Response(JSON.stringify({
                                code: 200, msg: '登录成功', success: true,
                                data: { status: 'confirmed', authorization: authorization, phone: phone }
                            }), { headers: { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*' } });
                        }
                    }
                    if (resCode === '200059541') {
                        return new Response(JSON.stringify({ code: 200, msg: '等待扫码', success: true, data: { status: 'waiting' } }), { headers: { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*' } });
                    } else if (resCode === '200059548') {
                        return new Response(JSON.stringify({ code: 200, msg: '已扫码', success: true, data: { status: 'scanned' } }), { headers: { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*' } });
                    } else if (resCode === '200059542' || resCode === '200059549') {
                        return new Response(JSON.stringify({ code: 200, msg: '已过期', success: true, data: { status: 'expired' } }), { headers: { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*' } });
                    }
                    return new Response(JSON.stringify({ code: 200, msg: '等待扫码', success: true, data: { status: 'waiting' } }), { headers: { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*' } });
                } catch (e) {
                    return new Response(JSON.stringify({ code: 500, msg: '轮询失败: ' + e.message, success: false, data: { status: 'waiting' } }), { headers: { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*' } });
                }
            }

            if (action === 'mcloud_qr_save') {
                try {
                    const authorization = url.searchParams.get('authorization');
                    const phone = url.searchParams.get('phone');
                    if (!authorization) return new Response(JSON.stringify({ code: 400, msg: '缺少authorization参数', success: false }), { headers: { 'Content-Type': 'application/json; charset=utf-8' } });
                    if (env && (env.jxpan || env.jx)) {
                        await storePut(env, 'mcloud_login_default', encryptToKV({ authorization: authorization, phone: phone, timestamp: Date.now() }));
                    }
                    return new Response(JSON.stringify({ code: 200, msg: '保存成功', success: true }), { headers: { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*' } });
                } catch (e) {
                    return new Response(JSON.stringify({ code: 500, msg: '保存失败: ' + e.message, success: false }), { headers: { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*' } });
                }
            }
        }

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

        // 尝试从KV缓存中获取数据
        let cachedResult = null;
        try {
            // 只有当env.jx存在时才尝试获取缓存
            if (env && (env.jxpan || env.jx)) {
                cachedResult = await getCacheFromKV(env, targetUrl, pwd);
            }
        } catch (e) {
            console.log('[!] 读取缓存失败:', e);
            // 即使读取缓存失败，也继续执行，不影响主流程
        }

        // 如果有缓存且不是下载模式，直接返回缓存结果
        if (cachedResult && type !== 'down') {
            // 更新统计数据
            try {
                const statsObj = await getStatsFromKV(env);
                statsObj.total++;
                statsObj.success++;
                statsObj.cached++;
                await updateStatsInKV(env, statsObj);
            } catch (e) {
                console.log('[!] 处理缓存统计数据失败:', e);
                // 即使更新统计数据失败，也继续返回缓存结果
            }
            // 确保传递正确的参数给handleResponse
            return handleResponse(cachedResult, type, CONFIG["redirect-url"], CONFIG, false, false, null, false, null, null);
        }

        let result;
        let isAliyun = false;
        let isQuark = false;
        let isUC = false;
        let quarkCookie = null;
        let ucCookie = null;
        let quarkParser = null;
        let ucParser = null;
        
        if (authParam) {
            console.log('[后端] 从请求参数获取到auth，优先使用');
            if (/alipan\.com|aliyundrive\.com/i.test(targetUrl)) {
                CONFIG.aliyun.authorization = authParam;
                console.log('[后端] 已设置阿里云盘authorization（优先级：前端配置）');
            } else if (/pan\.quark\.cn/i.test(targetUrl)) {
                CONFIG.quark.cookie = authParam;
                console.log('[后端] 已设置夸克网盘cookie（优先级：前端配置）');
            } else if (/uc\.cn|fast\.uc\.cn|drive\.uc\.cn/i.test(targetUrl)) {
                CONFIG.uc.cookie = authParam;
                console.log('[后端] 已设置UC网盘cookie（优先级：前端配置）');
            } else if (/yun\.139\.com|caiyun\.139\.com/i.test(targetUrl)) {
                CONFIG.mcloud.authorization = authParam;
                console.log('[后端] 已设置移动云盘authorization（优先级：前端配置）');
            }
        } else {
            // 从KV中读取扫码登录保存的信息（优先级：扫码登录 > 环境变量 > 默认值）
            if (env && (env.jxpan || env.jx)) {
                try {
                    if (/alipan\.com|aliyundrive\.com/i.test(targetUrl)) {
                        const kvAuth = await storeGet(env, 'aliyun_login_default');
                        if (kvAuth) {
                            if (kvAuth.startsWith('eyJ') && kvAuth.length > 200) {
                                console.log('[后端] KV中保存的是JWT refreshToken，尝试自动刷新获取access_token...');
                                try {
                                    const ALIYUN_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36';
                                    let accessToken = null;
                                    
                                    const tokenLoginResp = await fetch('https://auth.alipan.com/v2/oauth/token_login', {
                                        method: 'POST',
                                        headers: {
                                            'Accept': 'application/json, text/plain, */*',
                                            'Content-Type': 'application/json; charset=UTF-8',
                                            'Origin': 'https://auth.alipan.com',
                                            'Referer': 'https://auth.alipan.com/v2/oauth/authorize?client_id=25dzX3vbYqktVxyX&redirect_uri=https%3A%2F%2Fwww.alipan.com%2Fsign%2Fcallback&response_type=code&login_type=custom',
                                            'User-Agent': ALIYUN_UA
                                        },
                                        body: JSON.stringify({ token: kvAuth })
                                    });
                                    const tokenLoginResult = await tokenLoginResp.json();
                                    
                                    if (tokenLoginResp.status === 200 && tokenLoginResult.code !== 'Forbidden') {
                                        const gotoUrl = tokenLoginResult.goto || tokenLoginResult.redirect_uri || '';
                                        let authCode = '';
                                        if (tokenLoginResult.code && !['Forbidden', 'InvalidRequest', 'InvalidParameter'].includes(tokenLoginResult.code)) {
                                            authCode = tokenLoginResult.code;
                                        }
                                        if (!authCode && gotoUrl) {
                                            try {
                                                const gotoUrlObj = new URL(gotoUrl);
                                                authCode = gotoUrlObj.searchParams.get('code') || '';
                                            } catch (e) {
                                                const codeMatch = gotoUrl.match(/code=([^&]+)/);
                                                if (codeMatch) authCode = codeMatch[1];
                                            }
                                        }
                                        
                                        if (authCode) {
                                            const tokenGetResp = await fetch('https://api.aliyundrive.com/token/get', {
                                                method: 'POST',
                                                headers: {
                                                    'Accept': 'application/json, text/plain, */*',
                                                    'Content-Type': 'application/json; charset=UTF-8',
                                                    'Origin': 'https://www.alipan.com',
                                                    'Referer': 'https://www.alipan.com/',
                                                    'User-Agent': ALIYUN_UA
                                                },
                                                body: JSON.stringify({
                                                    code: authCode,
                                                    loginType: 'normal',
                                                    deviceId: 'nfd_alipan_scanner_001'
                                                })
                                            });
                                            const tokenGetResult = await tokenGetResp.json();
                                            accessToken = tokenGetResult.access_token || null;
                                            
                                            if (accessToken) {
                                                CONFIG.aliyun.authorization = accessToken;
                                                await storePut(env, 'aliyun_login_default', accessToken, { expirationTtl: 86400 });
                                                if (tokenGetResult.refresh_token) {
                                                    await storePut(env, 'aliyun_refresh_token', tokenGetResult.refresh_token, { expirationTtl: 86400 * 30 });
                                                }
                                                console.log('[后端] ✅ 自动刷新成功，已获取access_token并更新KV, 长度:', accessToken.length);
                                            } else {
                                                console.log('[后端] 自动刷新：token/get未返回access_token，使用refreshToken作为备用');
                                                CONFIG.aliyun.authorization = kvAuth;
                                            }
                                        } else {
                                            console.log('[后端] 自动刷新：未能提取授权码，使用refreshToken作为备用');
                                            CONFIG.aliyun.authorization = kvAuth;
                                        }
                                    } else {
                                        console.log('[后端] 自动刷新：token_login失败，使用refreshToken作为备用');
                                        CONFIG.aliyun.authorization = kvAuth;
                                    }
                                } catch (refreshErr) {
                                    console.log('[后端] 自动刷新失败，使用refreshToken作为备用:', refreshErr.message);
                                    CONFIG.aliyun.authorization = kvAuth;
                                }
                            } else {
                                CONFIG.aliyun.authorization = kvAuth;
                                console.log('[后端] 已从KV读取阿里云盘扫码登录信息（优先级：扫码登录 > 环境变量）');
                            }
                        } else {
                            console.log('[后端] KV中无阿里云盘扫码登录信息，使用环境变量或默认值');
                        }
                    } else if (/pan\.quark\.cn/i.test(targetUrl)) {
                        const kvCookie = await storeGet(env, 'quark_login_default');
                        if (kvCookie) {
                            CONFIG.quark.cookie = kvCookie;
                            console.log('[后端] 已从KV读取夸克网盘扫码登录信息（优先级：扫码登录 > 环境变量）');
                        } else {
                            console.log('[后端] KV中无夸克网盘扫码登录信息，使用环境变量或默认值');
                        }
                    } else if (/uc\.cn|fast\.uc\.cn|drive\.uc\.cn/i.test(targetUrl)) {
                        const kvCookie = await storeGet(env, 'uc_login_default');
                        if (kvCookie) {
                            CONFIG.uc.cookie = kvCookie;
                            console.log('[后端] 已从KV读取UC网盘扫码登录信息（优先级：扫码登录 > 环境变量）');
                        } else {
                            console.log('[后端] KV中无UC网盘扫码登录信息，使用环境变量或默认值');
                        }
                    } else if (/yun\.139\.com|caiyun\.139\.com/i.test(targetUrl)) {
                        const kvAuth = await storeGet(env, 'mcloud_login_default');
                        if (kvAuth) {
                            CONFIG.mcloud.authorization = kvAuth;
                            console.log('[后端] 已从KV读取移动云盘扫码登录信息（优先级：扫码登录 > 环境变量）');
                        } else {
                            console.log('[后端] KV中无移动云盘扫码登录信息，使用环境变量或默认值');
                        }
                    }
                } catch (kvErr) {
                    console.log('[后端] 读取KV扫码登录信息失败，使用环境变量或默认值:', kvErr);
                }
            } else {
                console.log('[后端] KV不可用，使用环境变量或默认值');
            }
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
                
            } else if (/yun\.139\.com/i.test(targetUrl) || /caiyun\.139\.com/i.test(targetUrl)) {
                // 移动云盘解析
                const parser = new MobileCloudParser(CONFIG);
                result = await parser.parse(targetUrl, pwd);
                
            } else if (/guangyapan\.com/i.test(targetUrl)) {
                // 光鸭云盘解析
                const parser = new GuangyaPanParser(CONFIG);
                result = await parser.parse(targetUrl, pwd, env);
                
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

        // 存储解析结果到KV缓存
        try {
            if (result.success && env && (env.jxpan || env.jx)) {
                const cacheTtl = CONFIG.cacheexpired || 3600;
                await setCacheToKV(env, targetUrl, pwd, result, cacheTtl);
            }
        } catch (e) {
            console.log('[!] 缓存解析结果失败:', e);
        }

        // 更新统计数据
        try {
            if (env && (env.jxpan || env.jx)) {
                const statsObj = await getStatsFromKV(env);
                statsObj.total++;
                if (result.success) {
                    statsObj.success++;
                } else {
                    statsObj.failed++;
                }
                await updateStatsInKV(env, statsObj);
            }
        } catch (e) {
            console.log('[!] 更新统计数据失败:', e);
            // 即使更新统计数据失败，也继续执行，不影响主流程
        }

        // 保存解析记录
        try {
            if (env && (env.jxpan || env.jx)) {
                await saveParseRecord(env, targetUrl, pwd, result);
            }
        } catch (e) {
            console.log('[!] 保存解析记录失败:', e);
            // 即使保存记录失败，也继续执行，不影响主流程
        }

        return handleResponse(result, type, CONFIG["redirect-url"], CONFIG, isAliyun, isQuark, quarkCookie, isUC, ucCookie, CONFIG.aliyun ? CONFIG.aliyun.authorization : null);
    }
};




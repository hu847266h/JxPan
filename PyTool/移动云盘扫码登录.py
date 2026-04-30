#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
移动云盘(和彩云 yun.139.com) 扫码登录
支持两种模式:
  1. 命令行独立运行: python 移动云盘扫码登录.py [API_URL] [API_KEY] [DISK_ID] [CONFIG_NAME]
  2. 作为模块被 app.py (Flask服务) 导入调用

登录流程:
  1. 随机生成本地 AES key (16字节)
  2. 调用 /key/v1.0/getRsaPublicKey 获取服务端 RSA 公钥
  3. RSA-PKCS1v15 加密 AES key → mcloud-skey (放入请求头)
  4. 生成二维码 URL (含 sID=随机16字符, dID=device_id)
  5. 内层 payload: {dycPwd: sID, loginStyle: "QRCode", clientEnv: "3", setCookie: 0}
  6. AES-ECB-PKCS7 加密 payload → encryptMsg
  7. 轮询 /permission/v1.0/login 直到扫码确认
  8. 登录成功后构建 Authorization = Basic base64("pc:手机号:token")
"""

import time
import uuid
import json
import base64
import hashlib
import random
import string
import requests
import sys
from io import BytesIO
from urllib.parse import quote

try:
    import qrcode
    from Crypto.PublicKey import RSA
    from Crypto.Cipher import PKCS1_v1_5, AES
    from Crypto.Util.Padding import pad
except ImportError as e:
    print(f"[!] 缺少依赖: {e}，请运行: pip install pycryptodome qrcode pillow")
    raise


class MCloudQRLogin:
    """移动云盘(和彩云)二维码登录"""

    BASE_URL = "https://yun.139.com/orchestration/auth-rebuild"

    def __init__(self, api_url=None, api_key=None, disk_id=None, config_name=None):
        self.session = requests.Session()
        self.client_id = "10701"
        self.version = "7.17.2"
        self.api_url = api_url
        self.api_key = api_key
        self.disk_id = disk_id
        self.config_name = config_name or "移动云盘"

        # 每次实例化生成固定的 device_id 和 sID (扫码 session)
        self.device_id = hashlib.md5(str(uuid.uuid4()).encode()).hexdigest()
        self.sid = self._random_str(16)
        self.aes_key = self._random_str(16)
        self.mcloud_skey = None
        self._qr_image_b64 = None   # 供 Flask 使用

    # ── 内部工具 ──────────────────────────────────────────────────────

    @staticmethod
    def _random_str(length):
        return ''.join(random.choices(string.ascii_letters + string.digits, k=length))

    def _generate_sign(self, body_dict):
        """
        mcloud-sign 算法（对应 JS getNewSign）:
          s = quote(json_str)  →  sorted(s)  →  base64  →  md5
          sign = md5(md5_data + md5(ts:nonce)).upper()
        """
        timestamp = time.strftime("%Y-%m-%d %H:%M:%S")
        nonce = self._random_str(16)
        s = ''
        if body_dict:
            s = json.dumps(body_dict, separators=(',', ':'))
            s = quote(s, safe='')
            s = ''.join(sorted(s))
        b64 = base64.b64encode(s.encode('utf-8')).decode('utf-8')
        r = hashlib.md5(b64.encode('utf-8')).hexdigest()
        c = hashlib.md5(f'{timestamp}:{nonce}'.encode('utf-8')).hexdigest()
        sign = hashlib.md5((r + c).encode('utf-8')).hexdigest().upper()
        return f"{timestamp},{nonce},{sign}"

    def _rsa_encrypt(self, pub_key_str, plaintext):
        """RSA-PKCS1v15 公钥加密，pub_key_str 为 Base64 DER (X.509，无 header)"""
        wrapped = '\n'.join(pub_key_str[i:i+64] for i in range(0, len(pub_key_str), 64))
        key_obj = RSA.import_key(f"-----BEGIN PUBLIC KEY-----\n{wrapped}\n-----END PUBLIC KEY-----")
        cipher = PKCS1_v1_5.new(key_obj)
        return base64.b64encode(cipher.encrypt(plaintext.encode('utf-8'))).decode('utf-8')

    def _aes_ecb_encrypt(self, plaintext):
        """AES-ECB + PKCS7，对应 JS AESEncrypt(str, aesKey)"""
        key = self.aes_key.encode('utf-8')
        cipher = AES.new(key, AES.MODE_ECB)
        encrypted = cipher.encrypt(pad(plaintext.encode('utf-8'), AES.block_size))
        return base64.b64encode(encrypted).decode('utf-8')

    def _make_headers(self, body_dict, skey=''):
        return {
            "Content-Type": "application/json;charset=UTF-8",
            "Accept": "application/json, text/plain, */*",
            "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
            "CMS-DEVICE": "default",
            "DNT": "1",
            "INNER-HCY-ROUTER-HTTPS": "1",
            "Origin": "https://yun.139.com",
            "Referer": "https://yun.139.com/w/",
            "caller": "web",
            "mcloud-client": self.client_id,
            "mcloud-channel": "1000101",
            "mcloud-route": "001",
            "mcloud-sign": self._generate_sign(body_dict),
            "mcloud-skey": skey or '',
            "mcloud-version": self.version,
            "x-deviceinfo": f"||9|{self.version}|edge||{self.device_id}||windows 10||zh-CN|||",
            "x-yun-channel-source": "10000034",
            "x-yun-svc-type": "1",
            "x-huawei-channelSrc": "10000034",
            "x-inner-ntwk": "2",
            "x-m4c-caller": "PC",
            "x-m4c-src": "10002",
            "x-SvcType": "1",
            "User-Agent": (
                "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
                "AppleWebKit/537.36 (KHTML, like Gecko) "
                "Chrome/145.0.0.0 Safari/537.36 Edg/145.0.0.0"
            ),
        }

    # ── 核心步骤 ──────────────────────────────────────────────────────

    def _init_secret_key(self):
        """Step 1: 获取服务端 RSA 公钥 → 生成 mcloud-skey"""
        url = f"{self.BASE_URL}/key/v1.0/getRsaPublicKey"
        body = {"clientCode": self.client_id, "type": "1"}
        try:
            resp = self.session.post(url, json=body,
                                     headers=self._make_headers(body), timeout=10).json()
        except Exception as e:
            print(f"[-] 获取 RSA 公钥失败: {e}")
            return False

        if not resp.get("success"):
            print(f"[-] 获取 RSA 公钥失败: {resp}")
            return False

        data = resp.get("data") or {}
        pub_key = data.get("publicKey")
        if not isinstance(pub_key, str) or not pub_key:
            print(f"[-] publicKey 格式异常: {data}")
            return False

        self.mcloud_skey = self._rsa_encrypt(pub_key, self.aes_key)
        return True

    def _build_login_body(self):
        """构造扫码登录请求体（QR 模式）"""
        inner = {
            "dycPwd": self.sid,
            "loginStyle": "QRCode",
            "clientEnv": "3",
            "setCookie": 0
        }
        encrypt_msg = self._aes_ecb_encrypt(json.dumps(inner, separators=(',', ':')))
        return {
            "encryptMsg": encrypt_msg,
            "clientId": self.client_id,
            "returnToken": True
        }

    def _qr_url(self):
        return f"https://yun.139.com/w/#/qrcLogin?sID={self.sid}&dID={self.device_id}&cType=9"

    # ── Flask 模式接口 ─────────────────────────────────────────────────

    def get_qrcode(self):
        """初始化并生成二维码（Flask 调用入口）
        返回 True 表示成功，False 表示失败
        """
        if not self._init_secret_key():
            return False

        qr_url = self._qr_url()
        qr = qrcode.QRCode(
            version=None,
            error_correction=qrcode.constants.ERROR_CORRECT_L,
            box_size=10,
            border=2,
        )
        qr.add_data(qr_url)
        qr.make(fit=True)
        img = qr.make_image(fill_color="black", back_color="white")
        buffer = BytesIO()
        img.save(buffer, format="PNG")
        self._qr_image_b64 = base64.b64encode(buffer.getvalue()).decode("utf-8")
        return True

    def get_qr_base64(self):
        """返回二维码 base64 PNG（供 Flask 返回给前端）"""
        return self._qr_image_b64

    def poll_login_status(self):
        """单次轮询（供 Flask background_poll 每 2 秒调用）
        返回: (status_str, result_or_none)
          'waiting'   → 还未扫码
          'scanned'   → 已扫码，等待手机确认
          'confirmed' → 登录成功，result = {"authorization": "Basic xxx", "phone": "..."}
          'expired'   → 已过期或取消
        """
        login_url = f"{self.BASE_URL}/permission/v1.0/login"
        body = self._build_login_body()
        try:
            resp = self.session.post(
                login_url,
                data=json.dumps(body, separators=(',', ':')),
                headers=self._make_headers(body, self.mcloud_skey),
                timeout=10
            ).json()
        except Exception as e:
            print(f"[-] 轮询请求异常: {e}")
            return "waiting", None

        data = resp.get("data") or {}
        result = data.get("result") or {}
        res_code = result.get("resultCode", "")

        # 扫码成功且有 token
        if resp.get("success") and res_code == "0":
            token = data.get("token")
            if token:
                return "confirmed", self._build_auth(data)

        if res_code == "200059541":
            return "waiting", None
        elif res_code == "200059548":
            return "scanned", None
        elif res_code in ("200059542", "200059549"):
            return "expired", None

        # 其他情况继续等待
        return "waiting", None

    def _build_auth(self, data):
        """从登录成功响应数据中提取手机号，构建 Authorization
        注意：必须使用 authToken 字段（实际API认证token），
        而非 token 字段（加密的SSO token，不能用于API调用）
        """
        auth_token = data.get("authToken", "")
        if not auth_token:
            # 兼容：如果没有 authToken，回退到 token
            auth_token = data.get("token", "")
            print(f"[!] 警告：未找到 authToken 字段，回退使用 token 字段")
        encrypt_account = data.get("encryptAccount", "")
        simplify_account = data.get("simplifyAccount", "")
        try:
            phone = base64.b64decode(encrypt_account).decode('utf-8')
        except Exception:
            phone = simplify_account
        auth_str = f"pc:{phone}:{auth_token}"
        authorization = "Basic " + base64.b64encode(auth_str.encode('utf-8')).decode('utf-8')
        return {"authorization": authorization, "phone": phone, "authToken": auth_token}

    def send_to_api(self, authorization, api_url=None, api_key=None,
                    disk_id=None, config_name=None):
        """将 Authorization 发送到 disk-mount API（动态参数）"""
        _api_url = api_url or self.api_url
        _api_key = api_key or self.api_key
        _disk_id = disk_id or self.disk_id
        _config_name = config_name or self.config_name

        if not _api_url or not _api_key or not _disk_id:
            print("[-] 未配置 API 地址、API Key 或 磁盘ID，跳过上传。")
            return False

        mount_url = f"{_api_url.rstrip('/')}/admin/api/disk-mount/api-key/{_disk_id}"
        payload = {
            "configName": _config_name,
            "diskType": "p139",
            "authType": "authorization",
            "status": "mounted",
            "token": authorization
        }
        api_headers = {"X-API-Key": _api_key, "Content-Type": "application/json"}

        print(f"\n[*] 正在将 Authorization 发送到 API...")
        print(f"[*] 目标地址: {mount_url}")
        try:
            resp = requests.put(mount_url, headers=api_headers, json=payload, timeout=30)
            print(f"[*] 响应状态码: {resp.status_code}")
            try:
                print(f"[*] 响应内容: {json.dumps(resp.json(), ensure_ascii=False, indent=2)}")
            except Exception:
                print(f"[*] 响应内容: {resp.text}")
            if resp.status_code == 200:
                print("\n[+] ✅ Authorization 已成功上传到 disk-mount API！")
                return True
            else:
                print(f"\n[-] ❌ 上传失败，HTTP 状态码: {resp.status_code}")
                return False
        except requests.exceptions.ConnectionError:
            print(f"[-] ❌ 无法连接到 API 服务器: {mount_url}")
        except requests.exceptions.Timeout:
            print(f"[-] ❌ 请求超时")
        except Exception as e:
            print(f"[-] ❌ 发送失败: {e}")
        return False

    # ── CLI 模式接口 ───────────────────────────────────────────────────

    def show_qrcode(self):
        """终端中显示二维码（CLI 模式）"""
        if not self._init_secret_key():
            print("[-] 初始化失败，退出")
            return False

        qr_url = self._qr_url()
        print(f"\n[*] 二维码地址: {qr_url}")
        qr = qrcode.QRCode(box_size=1, border=1)
        qr.add_data(qr_url)
        qr.make(fit=True)
        qr.print_ascii(invert=True)
        print("[*] 请使用移动云盘APP 或 微信 扫码登录\n")
        return True

    def wait_for_login(self, timeout=140):
        """循环轮询直到登录成功或超时（CLI 模式）"""
        start = time.time()
        print("[*] 正在监听扫码状态...")
        while time.time() - start < timeout:
            status, result = self.poll_login_status()
            elapsed = int(time.time() - start)
            if status == "confirmed":
                print(f"\n[+] 登录成功！")
                return result
            elif status == "scanned":
                print(f"\r[*] 已扫码，请在手机上点击「确认登录」... ({elapsed}s)", end="", flush=True)
            elif status == "expired":
                print(f"\n[-] 二维码已失效或已取消，请重新运行")
                return None
            else:
                print(f"\r[*] 等待扫码中... ({elapsed}s)", end="", flush=True)
            time.sleep(2)
        print(f"\n[-] 超时（{timeout}秒），未完成登录")
        return None

    def run(self):
        """命令行模式运行"""
        print("=" * 50)
        print("  移动云盘(和彩云) 扫码登录")
        print("=" * 50)

        if not self.show_qrcode():
            return

        result = self.wait_for_login()
        if result:
            auth = result["authorization"]
            print(f"  手机号:       {result['phone']}")
            print(f"  Authorization: {auth}")
            print()
            self.send_to_api(auth)


if __name__ == "__main__":
    API_URL = "http://your-server-address:port"
    API_KEY = "your-api-key"
    DISK_ID = ""
    CONFIG_NAME = "移动云盘"

    if len(sys.argv) >= 3:
        API_URL = sys.argv[1]
        API_KEY = sys.argv[2]
        if len(sys.argv) >= 4:
            DISK_ID = sys.argv[3]
        if len(sys.argv) >= 5:
            CONFIG_NAME = sys.argv[4]
        print(f"[*] 使用命令行参数:")
        print(f"    API URL: {API_URL}")
        print(f"    API Key: {API_KEY[:8]}...")
        if DISK_ID:
            print(f"    Disk ID: {DISK_ID}")
    elif API_URL == "http://your-server-address:port":
        print("=" * 60)
        print("  ⚠️  请先配置 API 地址和 API Key！")
        print("  方式1: 修改脚本中的 API_URL 和 API_KEY 变量")
        print("  方式2: 命令行传参:")
        print("    python 移动云盘扫码登录.py <API_URL> <API_KEY> [DISK_ID] [CONFIG_NAME]")
        print("=" * 60)
        print("[*] 将继续运行，但获取到的 Authorization 不会自动上传。\n")

    app = MCloudQRLogin(api_url=API_URL, api_key=API_KEY, disk_id=DISK_ID, config_name=CONFIG_NAME)
    app.run()

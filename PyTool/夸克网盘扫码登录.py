#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
夸克网盘扫码登录
支持两种模式:
  1. 命令行独立运行: python 夸克网盘扫码登录.py [API_URL] [API_KEY] [DISK_ID] [CONFIG_NAME]
  2. 作为模块被 app.py (Flask服务) 导入调用
"""

import requests
import time
import qrcode
import sys
import uuid
import json
import base64
from io import BytesIO


class QuarkUOPLogin:
    def __init__(self, api_url=None, api_key=None, disk_id=None, config_name=None):
        self.session = requests.Session()
        self.client_id = "532"
        self.api_url = api_url
        self.api_key = api_key
        self.disk_id = disk_id
        self.config_name = config_name or "夸克网盘"
        self.headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
            "Accept": "application/json, text/plain, */*",
            "Referer": "https://pan.quark.cn/",
            "Origin": "https://pan.quark.cn"
        }

    def _get_request_id(self):
        return str(uuid.uuid4()).replace("-", "")

    def get_token(self):
        """步骤1: 获取二维码 Token"""
        url = "https://uop.quark.cn/cas/ajax/getTokenForQrcodeLogin"
        params = {
            "client_id": self.client_id,
            "v": "1.2",
            "request_id": self._get_request_id()
        }
        try:
            resp = self.session.get(url, params=params, headers=self.headers)
            res_json = resp.json()
            if res_json.get("status") == 2000000:
                token = res_json["data"]["members"]["token"]
                print(f"[+] 成功获取 Token: {token}")
                return token
            else:
                print(f"[-] 获取 Token 失败: {res_json}")
        except Exception as e:
            print(f"[-] 请求异常: {e}")
        return None

    def get_qr_url(self, token):
        """生成扫码链接"""
        return (
            f"https://su.quark.cn/4_eMHBJ?token={token}"
            f"&client_id={self.client_id}"
            f"&ssb=weblogin"
            f"&uc_param_str="
            f"&uc_biz_str=S%3Acustom%7COPT%3ASAREA%400%7COPT%3AIMMERSIVE%401%7COPT%3ABACK_BTN_STYLE%400"
        )

    def generate_qr_base64(self, token):
        """生成二维码 base64 图片（供Flask API使用）"""
        qr_url = self.get_qr_url(token)
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
        return base64.b64encode(buffer.getvalue()).decode("utf-8")

    def show_qrcode(self, token):
        """步骤2: 在终端显示二维码（CLI模式）"""
        qr_url = self.get_qr_url(token)
        print("\n" + "=" * 45)
        print(" 请使用【手机夸克 APP】扫描下方二维码 ")
        print(" 并在手机端点击『确认登录』")
        print("=" * 45 + "\n")
        qr = qrcode.QRCode(box_size=1, border=1)
        qr.add_data(qr_url)
        qr.make(fit=True)
        qr.print_ascii(invert=True)
        print(f"\n扫码链接: {qr_url}\n")

    def poll_login_status(self, token):
        """单次轮询登录状态（供Flask API使用）
        返回: (status_str, ticket_or_none)
        """
        url = "https://uop.quark.cn/cas/ajax/getServiceTicketByQrcodeToken"
        params = {
            "client_id": self.client_id,
            "v": "1.2",
            "token": token,
            "request_id": self._get_request_id()
        }
        try:
            resp = self.session.get(url, params=params, headers=self.headers).json()
            status = resp.get("status")
            if status == 2000000:
                members = resp.get("data", {}).get("members", {})
                ticket = members.get("service_ticket") or members.get("ticket")
                if ticket:
                    return "confirmed", ticket
                return "waiting", None
            elif status == 50004001:
                return "waiting", None
            elif status == 50004002:
                return "expired", None
        except Exception as e:
            print(f"[-] 轮询异常: {e}")
        return "waiting", None

    def wait_for_login(self, token):
        """步骤3: 循环轮询登录状态（CLI模式）"""
        print("[*] 正在等待扫码确认 ", end="")
        for i in range(60):
            status, ticket = self.poll_login_status(token)
            if status == "confirmed":
                print(f"\n[+] 扫码成功！Ticket: {ticket[:10]}***")
                return ticket
            elif status == "expired":
                print("\n[-] 二维码已过期，请重启脚本。")
                return None
            sys.stdout.write(".")
            sys.stdout.flush()
            time.sleep(2)
        print("\n[-] 超时未登录。")
        return None

    def get_final_cookies(self, ticket):
        """步骤4: 使用 Ticket 换取夸克主站 Cookie"""
        auth_url = f"https://pan.quark.cn/account/info?st={ticket}&lw=scan"
        print(f"[*] 正在执行登录回调 (st={ticket[:20]}...)...")
        try:
            self.session.get(auth_url, headers=self.headers, allow_redirects=True)
            cookies = self.session.cookies.get_dict()
            print(f"[+] pan.quark.cn 返回 Cookie 数量: {len(cookies)}")
            # __pus / __kp / __kps / __ktd / __uid 任一存在即视为成功
            key_cookies = {"__pus", "__kp", "__kps", "__uid"}
            if key_cookies & set(cookies):
                cookie_str = "; ".join([f"{k}={v}" for k, v in cookies.items()])
                print("\n" + "=" * 60)
                print("【登录成功】获取到的 Cookie")
                print("-" * 60)
                print(cookie_str)
                print("=" * 60 + "\n")
                with open("quark_cookie.txt", "w") as f:
                    f.write(cookie_str)
                return cookie_str
            else:
                print("[-] 回调成功但未发现核心 Cookie (__pus/__kp 等)。")
                print(f"当前 Cookies: {cookies}")
        except Exception as e:
            print(f"[-] 回调失败: {e}")
        return None

    def send_to_api(self, cookie_str, api_url=None, api_key=None, disk_id=None, config_name=None):
        """步骤5: 将 Cookie 发送到 disk-mount API（动态参数）"""
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
            "diskType": "qk",
            "authType": "cookie",
            "status": "mounted",
            "token": cookie_str
        }
        api_headers = {"X-API-Key": _api_key, "Content-Type": "application/json"}

        print(f"\n[*] 正在将 Cookie 发送到 API...")
        print(f"[*] 目标地址: {mount_url}")
        try:
            resp = requests.put(mount_url, headers=api_headers, json=payload, timeout=30)
            print(f"[*] 响应状态码: {resp.status_code}")
            try:
                resp_json = resp.json()
                print(f"[*] 响应内容: {json.dumps(resp_json, ensure_ascii=False, indent=2)}")
            except Exception:
                print(f"[*] 响应内容: {resp.text}")
            if resp.status_code == 200:
                print("\n[+] ✅ Cookie 已成功上传到 disk-mount API！")
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

    def run(self):
        """命令行模式运行"""
        token = self.get_token()
        if token:
            self.show_qrcode(token)
            ticket = self.wait_for_login(token)
            if ticket:
                cookie_str = self.get_final_cookies(ticket)
                if cookie_str:
                    self.send_to_api(cookie_str)


if __name__ == "__main__":
    API_URL = "http://your-server-address:port"
    API_KEY = "your-api-key"
    DISK_ID = ""
    CONFIG_NAME = "夸克网盘"

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
        print("    python 夸克网盘扫码登录.py <API_URL> <API_KEY> [DISK_ID] [CONFIG_NAME]")
        print("=" * 60)
        print("[*] 将继续运行，但获取到的 Cookie 不会自动上传。\n")

    app = QuarkUOPLogin(api_url=API_URL, api_key=API_KEY, disk_id=DISK_ID, config_name=CONFIG_NAME)
    app.run()

#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
UC网盘扫码登录
支持两种模式:
  1. 命令行独立运行: python UC网盘扫码登录.py [API_URL] [API_KEY] [DISK_ID] [CONFIG_NAME]
  2. 作为模块被 app.py (Flask服务) 导入调用
"""

import requests
import time
import qrcode
import sys
import json
import base64
from io import BytesIO
from urllib.parse import quote


class UCDriveLogin:
    def __init__(self, api_url=None, api_key=None, disk_id=None, config_name=None):
        self.session = requests.Session()
        self.client_id = "381"
        self.api_url = api_url
        self.api_key = api_key
        self.disk_id = disk_id
        self.config_name = config_name or "UC网盘"
        self.headers = {
            "accept": "application/json, text/plain, */*",
            "accept-language": "zh-CN,zh;q=0.9,en;q=0.8,en-GB;q=0.7,en-US;q=0.6",
            "content-type": "application/x-www-form-urlencoded",
            "origin": "https://drive.uc.cn",
            "referer": "https://drive.uc.cn/",
            "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36 Edg/146.0.0.0"
        }

    def _get_ts(self):
        return str(int(time.time() * 1000))

    def get_token(self):
        """步骤1: 获取二维码 Token"""
        url = "https://api.open.uc.cn/cas/ajax/getTokenForQrcodeLogin"
        params = {"__dt": "792565", "__t": self._get_ts()}
        data = {
            "client_id": self.client_id,
            "v": "1.2",
            "request_id": self._get_ts()
        }
        try:
            resp = self.session.post(url, params=params, data=data, headers=self.headers).json()
            if resp.get("status") == 2000000:
                token = resp["data"]["members"]["token"]
                print(f"[+] 成功获取 Token: {token}")
                return token
            else:
                print(f"[-] 获取 Token 失败: {resp}")
        except Exception as e:
            print(f"[-] 请求异常: {e}")
        return None

    def get_qr_url(self, token):
        """生成扫码链接"""
        uc_param_str = "dsdnfrpfbivesscpgimibtbmnijblauputogpintnwktprchmt"
        uc_biz_str = quote("S:custom|C:titlebar_fix")
        return (
            f"https://su.uc.cn/1_n0ZCv"
            f"?uc_param_str={uc_param_str}"
            f"&token={token}"
            f"&client_id={self.client_id}"
            f"&uc_biz_str={uc_biz_str}"
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
        print(" 请使用【手机 UC 浏览器】扫描下方二维码 ")
        print(" 并在手机端点击『确认登录』")
        print("=" * 45 + "\n")
        qr = qrcode.QRCode(
            version=None,
            error_correction=qrcode.constants.ERROR_CORRECT_L,
            box_size=1,
            border=1,
        )
        qr.add_data(qr_url)
        qr.make(fit=True)
        qr.print_ascii(invert=True)
        print(f"\n扫码链接: {qr_url}\n")

    def poll_login_status(self, token):
        """单次轮询登录状态（供Flask API使用）
        返回: (status_str, ticket_or_none)
        """
        url = "https://api.open.uc.cn/cas/ajax/getServiceTicketByQrcodeToken"
        data = {
            "client_id": self.client_id,
            "v": "1.2",
            "request_id": self._get_ts(),
            "token": token
        }
        try:
            resp = self.session.post(url, data=data, headers=self.headers).json()
            status = resp.get("status")
            if status == 2000000:
                members = resp["data"]["members"]
                ticket = members.get("ticket") or members.get("service_ticket")
                if ticket:
                    return "confirmed", ticket
                return "waiting", None
            elif status == 50004001:
                return "waiting", None
            elif status == 50004002:
                return "expired", None
        except Exception as e:
            print(f"[-] 请求错误: {e}")
        return "waiting", None

    def wait_for_login(self, token):
        """步骤3: 循环轮询登录状态（CLI模式）"""
        print("[*] 正在等待扫码确认...")
        for i in range(90):
            status, ticket = self.poll_login_status(token)
            if status == "confirmed":
                print(f"\n[+] 扫码登录成功！获取到 Ticket: {ticket[:20]}...")
                return ticket
            elif status == "expired":
                print("\n[-] 二维码已失效，请重试。")
                return None
            sys.stdout.write(".")
            sys.stdout.flush()
            time.sleep(2)
        print("\n[-] 等待超时，请重试。")
        return None

    def get_final_cookies(self, ticket):
        """步骤4: 使用 Ticket 换取最终的 Web Cookie"""
        # 步骤4a: 向 fast.uc.cn 发送 st，换取 __pus/__kp/__kps/__uid 等 Cookie
        fast_url = "https://fast.uc.cn/api/info?fr=pc&pr=UCBrowser"
        fast_headers = {
            "accept": "application/json, text/plain, */*",
            "accept-language": "zh-CN,zh;q=0.9,en;q=0.8,en-GB;q=0.7,en-US;q=0.6",
            "content-type": "application/json",
            "origin": "https://fast.uc.cn",
            "referer": "https://fast.uc.cn/",
            "user-agent": self.headers["user-agent"],
        }
        try:
            print(f"[*] 向 fast.uc.cn 兑换 Cookie (st={ticket[:20]}...)...")
            resp_fast = self.session.post(
                fast_url,
                headers=fast_headers,
                json={"st": ticket},
                timeout=15,
            )
            fast_cookies = self.session.cookies.get_dict()
            print(f"[+] fast.uc.cn 返回状态: {resp_fast.status_code}, Cookie 数量: {len(fast_cookies)}")
        except Exception as e:
            print(f"[-] fast.uc.cn 请求异常: {e}")

        callback_urls = [
            f"https://drive.uc.cn/api/v1/sso/callback?ticket={ticket}",
            f"https://broccoli.uc.cn/api/v1/sso/callback?ticket={ticket}",
        ]
        for callback_url in callback_urls:
            print(f"[*] 尝试回调: {callback_url[:60]}...")
            try:
                self.session.get(callback_url, headers=self.headers, allow_redirects=True)
                cookies = self.session.cookies.get_dict()
                if cookies:
                    cookie_str = "; ".join([f"{k}={v}" for k, v in cookies.items()])
                    print("\n" + "=" * 60)
                    print("【登录成功】获取到的 Cookie：")
                    print("-" * 60)
                    print(cookie_str)
                    print("=" * 60 + "\n")
                    with open("uc_cookie.txt", "w") as f:
                        f.write(cookie_str)
                    return cookie_str
            except Exception as e:
                print(f"[-] 回调失败: {e}")
        print("[-] 所有回调地址均未成功获取 Cookie")
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
            "diskType": "uc",
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
    CONFIG_NAME = "UC网盘"

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
        print("    python UC网盘扫码登录.py <API_URL> <API_KEY> [DISK_ID] [CONFIG_NAME]")
        print("=" * 60)
        print("[*] 将继续运行，但获取到的 Cookie 不会自动上传。\n")

    app = UCDriveLogin(api_url=API_URL, api_key=API_KEY, disk_id=DISK_ID, config_name=CONFIG_NAME)
    app.run()

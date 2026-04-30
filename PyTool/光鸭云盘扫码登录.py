#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
光鸭云盘扫码登录脚本
支持两种模式:
  1. 命令行独立运行: python 光鸭云盘扫码登录.py
  2. 作为模块被其他脚本导入调用

登录流程:
  1. 调用 /v1/auth/device/code 获取登录二维码信息
  2. 生成二维码 URL
  3. 轮询 /v1/auth/token 直到扫码确认
  4. 登录成功后构建登录信息 JSON
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
import os
import subprocess
import platform


try:
    import qrcode
except ImportError as e:
    print(f"[!] 缺少依赖: {e}，请运行: pip install qrcode pillow")
    raise


try:
    from PIL import Image
    import io
    import os
except ImportError:
    pass


class GuangyaQRLogin:
    """光鸭云盘二维码登录"""

    BASE_URL = "https://account.guangyapan.com"

    def __init__(self):
        self.session = requests.Session()
        self.client_id = "aMe-8VSlkrbQXpUR"
        self.device_id = self._generate_device_id()
        self.code = None
        self.user_code = None
        self.verification_uri_complete = None
        self.interval = 5  # 轮询间隔（秒）
        self.expires_in = 600  # 二维码有效期（秒）
        self._qr_image_b64 = None  # 供其他模块使用
        self._image_viewer_process = None  # 图片查看器进程

    # ── 内部工具 ──────────────────────────────────────────────────────

    @staticmethod
    def _random_str(length):
        return ''.join(random.choices(string.ascii_letters + string.digits, k=length))

    def _generate_device_id(self):
        """生成设备ID"""
        return hashlib.md5(str(uuid.uuid4()).encode()).hexdigest()

    def _get_headers(self):
        """获取请求头"""
        return {
            "Content-Type": "application/json;charset=UTF-8",
            "Accept": "application/json, text/plain, */*",
            "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
            "Origin": "https://www.guangyapan.com",
            "Referer": "https://www.guangyapan.com/",
            "User-Agent": (
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) "
                "Chrome/147.0.0.0 Safari/537.36 Edg/147.0.0.0"
            ),
        }

    # ── 核心步骤 ──────────────────────────────────────────────────────

    def _get_device_code(self):
        """Step 1: 获取设备码和二维码信息"""
        url = f"{self.BASE_URL}/v1/auth/device/code"
        data = {
            "client_id": self.client_id,
            "device_id": self.device_id,
            "scope": "user profile sso offline_access"
        }

        try:
            response = self.session.post(
                url, 
                json=data, 
                headers=self._get_headers(),
                timeout=10
            )
            result = response.json()

            # 检查响应是否包含必要字段
            if "device_code" in result and "user_code" in result and "verification_uri_complete" in result:
                self.code = result.get("device_code")
                self.user_code = result.get("user_code")
                self.verification_uri_complete = result.get("verification_uri_complete")
                self.interval = result.get("interval", 5)
                self.expires_in = result.get("expires_in", 600)
                return True
            else:
                print(f"获取设备码失败: {result}")
                return False
        except Exception as e:
            print(f"获取设备码出错: {e}")
            return False

    def _poll_token(self):
        """Step 2: 轮询获取登录令牌"""
        url = f"{self.BASE_URL}/v1/auth/token"
        data = {
            "grant_type": "urn:ietf:params:oauth:grant-type:device_code",
            "device_code": self.code,
            "client_id": self.client_id
        }

        try:
            response = self.session.post(
                url, 
                json=data, 
                headers=self._get_headers(),
                timeout=10
            )
            result = response.json()
            # 不再打印详细响应

            # 检查是否包含 access_token
            if "access_token" in result:
                return result
            elif "error" in result:
                error = result.get("error")
                if error == "authorization_pending":
                    return "pending"
                elif error == "slow_down":
                    return "pending"
                elif error == "access_denied":
                    return "denied"
                elif error == "expired_token":
                    return "expired"
                else:
                    return "error"
            else:
                return "error"
        except Exception:
            return "error"

    def _build_login_info(self, token_data):
        """构建登录信息 JSON"""
        access_token = token_data.get("access_token")
        refresh_token = token_data.get("refresh_token")
        expires_in = token_data.get("expires_in", 7 * 24 * 3600)

        login_info = {
            "access_token": access_token,
            "refresh_token": refresh_token or self._generate_refresh_token(),
            "device_id": self.device_id,
            "token_expires_at": int(time.time()) + expires_in
        }
        return login_info

    def _generate_refresh_token(self):
        """生成符合格式的refresh_token"""
        prefix = "gy."
        part1 = self._random_str(24)
        part2 = self._random_str(32)
        return f"{prefix}{part1}_{part2}"

    # ── 公共接口 ──────────────────────────────────────────────────────

    def get_qrcode(self):
        """初始化并生成二维码
        返回 True 表示成功，False 表示失败
        """
        if not self._get_device_code():
            return False

        if not self.verification_uri_complete:
            print("[!] 未获取到二维码 URL")
            return False

        qr = qrcode.QRCode(
            version=None,
            error_correction=qrcode.constants.ERROR_CORRECT_L,
            box_size=10,
            border=2,
        )
        qr.add_data(self.verification_uri_complete)
        qr.make(fit=True)
        img = qr.make_image(fill_color="black", back_color="white")
        buffer = BytesIO()
        img.save(buffer, format="PNG")
        self._qr_image_b64 = base64.b64encode(buffer.getvalue()).decode("utf-8")
        return True

    def get_qr_base64(self):
        """返回二维码 base64 PNG"""
        return self._qr_image_b64

    def get_qr_url(self):
        """返回二维码 URL"""
        return self.verification_uri_complete

    def wait_for_login(self, timeout=None):
        """循环轮询直到登录成功或超时
        返回: 登录信息 JSON 或 None
        """
        if not self.code:
            if not self._get_device_code():
                return None

        start_time = time.time()
        max_time = timeout or self.expires_in
        print(f"[*] 二维码有效期: {self.expires_in}秒")
        print(f"[*] 正在监听扫码状态...")

        while time.time() - start_time < max_time:
            elapsed = int(time.time() - start_time)
            result = self._poll_token()

            if isinstance(result, dict):
                print(f"\n[+] 登录成功！")
                # 关闭图片查看器
                self._close_image_viewer()
                login_info = self._build_login_info(result)
                return login_info
            elif result == "pending":
                print(f"\r[*] 等待扫码中... ({elapsed}s)", end="", flush=True)
                time.sleep(self.interval)
            elif result == "denied":
                print(f"\n[-] 登录被拒绝，请重新运行")
                # 关闭图片查看器
                self._close_image_viewer()
                return None
            elif result == "expired":
                print(f"\n[-] 二维码已失效，请重新运行")
                # 关闭图片查看器
                self._close_image_viewer()
                return None
            else:
                print(f"\r[*] 等待扫码中... ({elapsed}s)", end="", flush=True)
                time.sleep(self.interval)

        print(f"\n[-] 超时（{max_time}秒），未完成登录")
        # 关闭图片查看器
        self._close_image_viewer()
        return None

    def _close_image_viewer(self):
        """关闭图片查看器进程并删除临时二维码图片"""
        # 关闭图片查看器进程
        if self._image_viewer_process:
            try:
                # 尝试终止图片查看器进程
                self._image_viewer_process.terminate()
                # 等待进程结束
                self._image_viewer_process.wait(timeout=2)
                print("[*] 图片查看器已关闭")
            except Exception as e:
                # 忽略关闭失败的错误
                pass
            finally:
                self._image_viewer_process = None
        
        # 删除临时二维码图片
        temp_file = "guangya_qrcode.png"
        if os.path.exists(temp_file):
            try:
                os.remove(temp_file)
                print(f"[*] 临时二维码图片已删除")
            except Exception as e:
                # 忽略删除失败的错误
                pass

    def show_qrcode(self):
        """终端中显示二维码"""
        if not self._get_device_code():
            print("[-] 初始化失败，退出")
            return False

        if not self.verification_uri_complete:
            print("[-] 未获取到二维码 URL")
            return False

        print("\n[*] 请使用光鸭云盘APP 或 微信 扫码登录\n")
        
        # 尝试多种方式显示二维码
        methods = [
            self._show_ascii_qr,
            self._show_image_qr,
            self._show_qr_url
        ]
        
        for method in methods:
            try:
                if method():
                    break
            except Exception as e:
                print(f"[!] {method.__name__} 失败: {e}")
                continue
        
        return True
    
    def _show_ascii_qr(self):
        """显示ASCII格式的二维码"""
        try:
            # 参考移动云盘扫码登录脚本的实现方式
            qr = qrcode.QRCode(box_size=1, border=1)
            qr.add_data(self.verification_uri_complete)
            qr.make(fit=True)
            qr.print_ascii(invert=True)
            print()
            return True
        except Exception:
            return False
    
    def _show_image_qr(self):
        """生成并显示二维码图片"""
        temp_file = "guangya_qrcode.png"
        try:
            # 使用qrcode库生成二维码
            qr = qrcode.QRCode(
                version=1,
                error_correction=qrcode.constants.ERROR_CORRECT_L,
                box_size=10,
                border=4,
            )
            qr.add_data(self.verification_uri_complete)
            qr.make(fit=True)
            img = qr.make_image(fill_color="black", back_color="white")
            
            # 保存二维码到临时文件
            img.save(temp_file)
            
            # 尝试使用系统默认图片查看器打开
            if os.name == 'nt':  # Windows
                os.startfile(temp_file)
            else:  # Linux/Mac
                import subprocess
                if platform.system() == "Darwin":  # Mac
                    subprocess.run(['open', temp_file], check=False)
                else:  # Linux
                    subprocess.run(['xdg-open', temp_file], check=False)
            
            print("[*] 二维码图片已打开，请使用手机扫码")
            return True
        except Exception:
            return False
    
    def _show_qr_url(self):
        """显示二维码地址"""
        print(f"[*] 二维码地址: {self.verification_uri_complete}")
        print("[*] 请复制链接到浏览器打开或使用二维码生成工具创建二维码")
        return True

    def run(self):
        """命令行模式运行"""
        print("=" * 50)
        print("  光鸭云盘 扫码登录")
        print("=" * 50)

        if not self.show_qrcode():
            return

        login_info = self.wait_for_login()
        if login_info:
            print(f"  设备ID:       {login_info['device_id']}")
            print(f"  Access Token: {login_info['access_token'][:30]}...")
            print(f"  Refresh Token: {login_info['refresh_token'][:30]}...")
            print(f"  过期时间:       {login_info['token_expires_at']}")
            print()

            # 保存登录信息到文件
            login_info_file = "guangya_qr_login_info.json"
            with open(login_info_file, "w", encoding="utf-8") as f:
                json.dump(login_info, f, ensure_ascii=False, indent=2)

            print(f"[+] 登录信息已保存到: {login_info_file}")
            print("\n请复制以下JSON内容，配置到Cloudflare Workers的GY_Login环境变量中:")
            print("\n" + "=" * 50)
            print(json.dumps(login_info, ensure_ascii=False))
            print("=" * 50)


if __name__ == "__main__":
    app = GuangyaQRLogin()
    app.run()
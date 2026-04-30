#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
光鸭云盘验证码登录脚本
用于生成登录信息JSON，供Cloudflare Workers使用
"""

import os
import sys
import json
import random
import string
import time
import requests

def generate_random_string(length=32):
    """生成随机字符串"""
    chars = string.ascii_letters + string.digits + "_-"
    return ''.join(random.choice(chars) for _ in range(length))

def generate_refresh_token():
    """生成符合格式的refresh_token"""
    prefix = "gy."
    part1 = generate_random_string(24)
    part2 = generate_random_string(32)
    return f"{prefix}{part1}_{part2}"

def generate_device_id():
    """生成device_id"""
    return f"{generate_random_string(16)}"

def get_account_headers():
    return {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Content-Type": "application/json;charset=UTF-8",
        "Origin": "https://www.guangyapan.com",
        "Referer": "https://www.guangyapan.com/"
    }

def login_sms_init(phone_number, device_id):
    url = "https://account.guangyapan.com/v1/shield/captcha/init"
    headers = get_account_headers()
    data = {
        "client_id": "aMe-8VSlkrbQXpUR",
        "action": "POST:/v1/auth/verification",
        "device_id": device_id,
        "meta": {"phone_number": phone_number},
    }

    try:
        response = requests.post(url, headers=headers, json=data)
        result = response.json()
        print(f"[步骤1] 初始化验证码，响应: {result}")
        if result.get("captcha_token"):
            return result["captcha_token"]
        else:
            print(f"初始化验证码失败: {result}")
            return None
    except Exception as e:
        print(f"初始化验证码出错: {e}")
        return None

def login_sms_send(phone_number, captcha_token, device_id):
    url = "https://account.guangyapan.com/v1/auth/verification"
    headers = get_account_headers()
    headers["x-captcha-token"] = captcha_token
    data = {
        "phone_number": phone_number,
        "target": "ANY",
        "client_id": "aMe-8VSlkrbQXpUR",
    }

    try:
        response = requests.post(url, headers=headers, json=data)
        result = response.json()
        print(f"[步骤2] 发送验证码，响应: {result}")
        if result.get("verification_id"):
            return result["verification_id"]
        else:
            print(f"发送验证码失败: {result}")
            return None
    except Exception as e:
        print(f"发送验证码出错: {e}")
        return None

def login_sms_verify(verification_id, code):
    url = "https://account.guangyapan.com/v1/auth/verification/verify"
    headers = get_account_headers()
    data = {
        "verification_id": verification_id,
        "verification_code": code,
        "client_id": "aMe-8VSlkrbQXpUR",
    }

    try:
        response = requests.post(url, headers=headers, json=data)
        result = response.json()
        print(f"[步骤3] 验证验证码，响应: {result}")
        if result.get("verification_token"):
            return result["verification_token"]
        else:
            print(f"验证验证码失败: {result}")
            return None
    except Exception as e:
        print(f"验证验证码出错: {e}")
        return None

def login_sms_signin(phone_number, code, verification_token, captcha_token, device_id):
    url = "https://account.guangyapan.com/v1/auth/signin"
    headers = get_account_headers()
    headers["x-captcha-token"] = captcha_token
    data = {
        "verification_code": code,
        "verification_token": verification_token,
        "username": phone_number,
        "client_id": "aMe-8VSlkrbQXpUR",
    }

    try:
        response = requests.post(url, headers=headers, json=data)
        result = response.json()
        print(f"[步骤4] 完成登录，响应: {result}")

        if result.get("access_token"):
            login_data = {
                "access_token": result["access_token"],
                "refresh_token": result.get("refresh_token") or generate_refresh_token(),
                "device_id": device_id,
                "token_expires_at": int(time.time()) + result.get("expires_in", 7 * 24 * 3600)
            }
            return login_data
        else:
            print(f"登录失败: {result}")
            return None
    except Exception as e:
        print(f"登录出错: {e}")
        return None

def main():
    """主函数"""
    print("光鸭云盘验证码登录脚本")
    print("=" * 50)

    # 输入手机号
    phone = input("请输入手机号（格式：+86 13800138000）: ").strip()
    if not phone:
        print("手机号不能为空")
        sys.exit(1)

    # 生成device_id
    device_id = generate_device_id()
    print(f"生成的设备ID: {device_id}")

    # 初始化验证码
    print("\n[步骤1] 初始化验证码...")
    captcha_token = login_sms_init(phone, device_id)
    if not captcha_token:
        print("初始化验证码失败，无法继续")
        sys.exit(1)

    # 发送验证码
    print("\n[步骤2] 发送验证码...")
    verification_id = login_sms_send(phone, captcha_token, device_id)
    if not verification_id:
        print("发送验证码失败，无法继续")
        sys.exit(1)

    # 输入验证码
    code = input("\n请输入收到的短信验证码: ").strip()
    if not code:
        print("验证码不能为空")
        sys.exit(1)

    print("\n[步骤3] 验证验证码...")
    verification_token = login_sms_verify(verification_id, code)
    if not verification_token:
        print("验证验证码失败，无法继续")
        sys.exit(1)

    print("\n[步骤4] 完成登录...")
    login_data = login_sms_signin(phone, code, verification_token, captcha_token, device_id)
    if not login_data:
        sys.exit(1)

    # 保存登录信息到JSON文件
    login_info_file = "Gy_login_info.json"
    with open(login_info_file, "w", encoding="utf-8") as f:
        json.dump(login_data, f, ensure_ascii=False, indent=2)

    print("\n" + "=" * 50)
    print("登录成功！")
    print(f"登录信息已保存到: {login_info_file}")
    print("\n请复制以下JSON内容，配置到Cloudflare Workers的GY_Login环境变量中:")
    print("\n" + "=" * 50)
    print(json.dumps(login_data, ensure_ascii=False))
    print("=" * 50)

    print("\n注意:")
    print("1. 登录信息有效期为7天")
    print("2. 请确保在Cloudflare Workers中正确配置GY_Login变量")
    print("3. 如有登录信息过期，请重新运行此脚本获取新的登录信息")

if __name__ == "__main__":
    main()
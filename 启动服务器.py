#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
TikTok数据管理器 - 简化启动脚本
双击即可启动HTTP服务器和数据监控
"""

import os
import sys
import json
import time
from pathlib import Path

# 确保当前目录在Python路径中
current_dir = Path(__file__).parent
sys.path.insert(0, str(current_dir))

def load_config():
    """加载配置文件"""
    config_file = current_dir / "config.json"
    if config_file.exists():
        try:
            with open(config_file, 'r', encoding='utf-8') as f:
                return json.load(f)
        except Exception as e:
            print(f"警告：加载配置文件失败: {e}")
    return {}

def get_data_directory_from_user():
    """从用户获取数据目录路径"""
    print("📁 请指定TikTok账号数据目录")
    print("-" * 50)
    
    # 提供一些常见的选项
    suggestions = [
        "粉丝分类",
        "data/粉丝分类", 
        "../粉丝分类",
        "TikTok数据",
        "账号数据"
    ]
    
    print("常用目录选项：")
    for i, suggestion in enumerate(suggestions, 1):
        exists = "✅" if os.path.exists(suggestion) else "❌"
        print(f"  {i}. {suggestion} {exists}")
    
    print(f"  {len(suggestions) + 1}. 手动输入路径")
    print("")
    
    while True:
        try:
            choice = input(f"请选择 (1-{len(suggestions) + 1}) 或直接输入路径: ").strip()
            
            # 如果直接输入路径
            if not choice.isdigit():
                data_dir = choice
            else:
                choice_num = int(choice)
                if 1 <= choice_num <= len(suggestions):
                    data_dir = suggestions[choice_num - 1]
                elif choice_num == len(suggestions) + 1:
                    data_dir = input("请输入完整路径: ").strip()
                else:
                    print("❌ 无效选择，请重新输入")
                    continue
            
            # 清理路径
            data_dir = data_dir.strip('\'"')  # 移除可能的引号
            
            # 检查路径是否存在
            if os.path.exists(data_dir):
                print(f"✅ 找到目录: {os.path.abspath(data_dir)}")
                return data_dir
            else:
                print(f"⚠️  目录不存在: {data_dir}")
                create = input("是否创建此目录？(y/n): ").lower().strip()
                if create in ['y', 'yes', '是']:
                    if create_example_structure(data_dir):
                        return data_dir
                    else:
                        continue
                else:
                    continue
                    
        except ValueError:
            print("❌ 请输入有效的数字选择")
        except KeyboardInterrupt:
            print("\n\n👋 用户取消操作")
            sys.exit(0)

def check_data_directory(data_dir):
    """检查数据目录结构"""
    if not os.path.exists(data_dir):
        return False
    
    # 检查是否有子目录（地区）
    subdirs = [d for d in os.listdir(data_dir) 
              if os.path.isdir(os.path.join(data_dir, d))]
    
    if not subdirs:
        print(f"⚠️  目录 '{data_dir}' 为空")
        return False
    
    # 统计数据
    total_countries = 0
    total_files = 0
    
    for region in subdirs:
        region_path = os.path.join(data_dir, region)
        countries = [d for d in os.listdir(region_path) 
                    if os.path.isdir(os.path.join(region_path, d))]
        total_countries += len(countries)
        
        for country in countries:
            country_path = os.path.join(region_path, country)
            files = [f for f in os.listdir(country_path) 
                    if f.endswith('.txt')]
            total_files += len(files)
    
    print(f"📊 数据统计: {len(subdirs)} 个地区, {total_countries} 个国家, {total_files} 个文件")
    return True

def create_example_structure(data_dir):
    """创建示例目录结构"""
    try:
        example_structure = {
            f"{data_dir}/欧洲/DE": ["0-500.txt", "500-1000.txt"],
            f"{data_dir}/欧洲/FR": ["0-500.txt", "1000-2000.txt"],
            f"{data_dir}/东南亚/US": ["0-500.txt", "500-1000.txt", "10000+.txt"],
            f"{data_dir}/东南亚/JP": ["0-500.txt"]
        }
        
        for dir_path, files in example_structure.items():
            os.makedirs(dir_path, exist_ok=True)
            for filename in files:
                file_path = os.path.join(dir_path, filename)
                if not os.path.exists(file_path):
                    with open(file_path, 'w', encoding='utf-8') as f:
                        # 写入一些示例数据
                        f.write("# 示例TikTok账号数据\n")
                        f.write("user1\n")
                        f.write("user2\n")
                        f.write("user3\n")
        
        print(f"✅ 示例目录结构已创建: {data_dir}")
        return True
    except Exception as e:
        print(f"❌ 创建示例目录失败: {e}")
        return False

def save_config_with_data_dir(config, data_dir):
    """保存配置文件，包含用户选择的数据目录"""
    config['data_directory'] = data_dir
    config_file = current_dir / "config.json"
    
    try:
        with open(config_file, 'w', encoding='utf-8') as f:
            json.dump(config, f, ensure_ascii=False, indent=2)
        print(f"💾 配置已保存到: {config_file}")
    except Exception as e:
        print(f"⚠️  保存配置失败: {e}")

def main():
    """主函数"""
    print("=" * 60)
    print("🚀 TikTok数据管理器启动中...")
    print("=" * 60)
    
    # 加载配置
    config = load_config()
    
    # 获取数据目录
    saved_data_dir = config.get('data_directory')
    
    if saved_data_dir and os.path.exists(saved_data_dir):
        print(f"💾 找到上次使用的目录: {saved_data_dir}")
        use_saved = input("是否继续使用此目录？(y/n): ").lower().strip()
        if use_saved in ['y', 'yes', '是', '']:
            data_dir = saved_data_dir
        else:
            data_dir = get_data_directory_from_user()
    else:
        data_dir = get_data_directory_from_user()
    
    # 检查数据目录
    if not check_data_directory(data_dir):
        input("\n按回车键退出...")
        return
    
    # 保存配置
    save_config_with_data_dir(config, data_dir)
    
    # 导入并启动服务器
    try:
        from tiktok_data_manager import TikTokDataServer
        
        output_file = config.get('output_file')
        port = config.get('server', {}).get('port')
        
        print("")
        print("🔧 服务器配置")
        print("-" * 30)
        print(f"📁 数据目录: {os.path.abspath(data_dir)}")
        print(f"📄 输出文件: {output_file or '默认路径'}")
        print(f"🌐 服务端口: {port or '自动选择'}")
        print("")
        
        server = TikTokDataServer(data_dir, output_file, port)
        
        print("✅ 服务器配置完成，正在启动...")
        print("")
        
        server.run_forever()
        
    except ImportError as e:
        print(f"❌ 导入模块失败: {e}")
        print("请确保 tiktok_data_manager.py 文件在同一目录中")
    except Exception as e:
        print(f"❌ 启动失败: {e}")
        import traceback
        traceback.print_exc()
    
    input("\n按回车键退出...")

if __name__ == '__main__':
    try:
        main()
    except KeyboardInterrupt:
        print("\n\n👋 服务器已停止，谢谢使用！")
    except Exception as e:
        print(f"\n❌ 程序异常退出: {e}")
        input("按回车键退出...") 
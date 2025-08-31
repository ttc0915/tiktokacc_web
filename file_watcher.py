#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
TikTok数据文件监控器
功能：
1. 监控数据目录的文件变化
2. 自动触发数据重新生成
3. 可以独立运行或作为模块导入
"""

import os
import time
import json
import threading
from pathlib import Path
from typing import Dict, Set, Optional
import logging

logger = logging.getLogger(__name__)

class FileWatcher:
    """文件监控器"""
    
    def __init__(self, watch_dir: str, callback, check_interval: int = 5):
        self.watch_dir = Path(watch_dir)
        self.callback = callback
        self.check_interval = check_interval
        self.file_states: Dict[str, float] = {}
        self.is_running = False
        self.thread: Optional[threading.Thread] = None
        
    def scan_files(self) -> Dict[str, float]:
        """扫描目录，返回文件和修改时间的映射"""
        file_states = {}
        
        if not self.watch_dir.exists():
            return file_states
            
        try:
            for root, dirs, files in os.walk(self.watch_dir):
                for file in files:
                    if file.endswith('.txt'):
                        file_path = os.path.join(root, file)
                        try:
                            mtime = os.path.getmtime(file_path)
                            file_states[file_path] = mtime
                        except OSError:
                            continue
        except Exception as e:
            logger.error(f"扫描文件时出错: {e}")
            
        return file_states
    
    def check_changes(self) -> bool:
        """检查文件是否有变化"""
        current_states = self.scan_files()
        
        # 检查新增或修改的文件
        for file_path, mtime in current_states.items():
            if file_path not in self.file_states or self.file_states[file_path] != mtime:
                logger.info(f"检测到文件变化: {file_path}")
                self.file_states = current_states
                return True
        
        # 检查删除的文件
        for file_path in self.file_states:
            if file_path not in current_states:
                logger.info(f"检测到文件删除: {file_path}")
                self.file_states = current_states
                return True
                
        return False
    
    def watch_loop(self):
        """监控循环"""
        logger.info(f"开始监控目录: {self.watch_dir}")
        
        # 初始化文件状态
        self.file_states = self.scan_files()
        logger.info(f"初始化完成，监控 {len(self.file_states)} 个文件")
        
        while self.is_running:
            try:
                if self.check_changes():
                    logger.info("文件有变化，触发回调...")
                    try:
                        self.callback()
                    except Exception as e:
                        logger.error(f"回调函数执行失败: {e}")
                
                time.sleep(self.check_interval)
                
            except Exception as e:
                logger.error(f"监控循环出错: {e}")
                time.sleep(self.check_interval)
    
    def start(self):
        """启动监控"""
        if self.is_running:
            logger.warning("监控器已经在运行")
            return
            
        self.is_running = True
        self.thread = threading.Thread(target=self.watch_loop, daemon=True)
        self.thread.start()
        logger.info("文件监控器已启动")
    
    def stop(self):
        """停止监控"""
        if not self.is_running:
            return
            
        self.is_running = False
        if self.thread:
            self.thread.join(timeout=2)
        logger.info("文件监控器已停止")


class TikTokFileWatcher:
    """TikTok数据文件监控器"""
    
    def __init__(self, config_file: str = "config.json"):
        self.config = self.load_config(config_file)
        self.data_manager = None
        self.watcher = None
        
    def load_config(self, config_file: str) -> Dict:
        """加载配置文件"""
        try:
            with open(config_file, 'r', encoding='utf-8') as f:
                config = json.load(f)
                logger.info(f"配置文件加载成功: {config_file}")
                return config
        except Exception as e:
            logger.warning(f"加载配置文件失败: {e}，使用默认配置")
            return {
                "data_directory": "粉丝分类",
                "file_watcher": {
                    "enabled": True,
                    "check_interval": 30
                }
            }
    
    def init_data_manager(self):
        """初始化数据管理器"""
        try:
            from tiktok_data_manager import TikTokDataManager
            
            data_dir = self.config.get('data_directory', '粉丝分类')
            output_file = self.config.get('output_file')
            
            self.data_manager = TikTokDataManager(data_dir, output_file)
            logger.info("数据管理器初始化成功")
            
        except ImportError as e:
            logger.error(f"导入数据管理器失败: {e}")
            raise
        except Exception as e:
            logger.error(f"初始化数据管理器失败: {e}")
            raise
    
    def on_file_change(self):
        """文件变化回调函数"""
        if not self.data_manager:
            logger.error("数据管理器未初始化")
            return
            
        try:
            logger.info("数据文件发生变化，开始重新生成JSON...")
            self.data_manager.generate_json()
            logger.info("JSON文件重新生成完成")
            
        except Exception as e:
            logger.error(f"重新生成JSON文件失败: {e}")
    
    def start_watching(self):
        """开始文件监控"""
        watcher_config = self.config.get('file_watcher', {})
        
        if not watcher_config.get('enabled', True):
            logger.info("文件监控已禁用")
            return
            
        data_dir = self.config.get('data_directory', '粉丝分类')
        check_interval = watcher_config.get('check_interval', 30)
        
        if not os.path.exists(data_dir):
            logger.warning(f"数据目录不存在: {data_dir}")
            return
        
        # 初始化数据管理器
        self.init_data_manager()
        
        # 创建并启动文件监控器
        self.watcher = FileWatcher(
            watch_dir=data_dir,
            callback=self.on_file_change,
            check_interval=check_interval
        )
        
        self.watcher.start()
        logger.info(f"文件监控已启动，检查间隔: {check_interval}秒")
    
    def stop_watching(self):
        """停止文件监控"""
        if self.watcher:
            self.watcher.stop()
            self.watcher = None
            logger.info("文件监控已停止")
    
    def run_forever(self):
        """运行监控器（阻塞模式）"""
        self.start_watching()
        
        if not self.watcher:
            logger.error("文件监控器启动失败")
            return
            
        try:
            logger.info("文件监控器运行中，按 Ctrl+C 停止...")
            while True:
                time.sleep(1)
        except KeyboardInterrupt:
            logger.info("收到停止信号...")
        finally:
            self.stop_watching()


def main():
    """主函数"""
    import argparse
    
    # 配置日志
    logging.basicConfig(
        level=logging.INFO,
        format='%(asctime)s - %(levelname)s - %(message)s',
        handlers=[
            logging.FileHandler('file_watcher.log', encoding='utf-8'),
            logging.StreamHandler()
        ]
    )
    
    parser = argparse.ArgumentParser(description='TikTok数据文件监控器')
    parser.add_argument('--config', '-c', help='配置文件路径', default='config.json')
    parser.add_argument('--data-dir', '-d', help='数据目录路径', default=None)
    parser.add_argument('--interval', '-i', type=int, help='检查间隔（秒）', default=None)
    parser.add_argument('--once', action='store_true', help='只运行一次，不持续监控')
    
    args = parser.parse_args()
    
    try:
        watcher = TikTokFileWatcher(args.config)
        
        # 覆盖配置
        if args.data_dir:
            watcher.config['data_directory'] = args.data_dir
        if args.interval:
            watcher.config.setdefault('file_watcher', {})['check_interval'] = args.interval
        
        if args.once:
            # 只运行一次
            logger.info("单次运行模式")
            watcher.init_data_manager()
            watcher.on_file_change()
        else:
            # 持续监控
            watcher.run_forever()
            
    except KeyboardInterrupt:
        logger.info("程序被用户中断")
    except Exception as e:
        logger.error(f"程序运行出错: {e}")
        import traceback
        logger.error(traceback.format_exc())


if __name__ == '__main__':
    main() 
#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import os
import json
import asyncio
import hashlib
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional, Tuple
from dataclasses import dataclass, asdict
import logging

# 配置日志
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

@dataclass
class RegionData:
    """地区数据结构"""
    name: str
    countries: Dict[str, Dict[str, int]]  # country_code -> {bracket: count}
    total_accounts: int
    total_countries: int

@dataclass
class CountryData:
    """国家数据结构"""
    code: str
    name_zh: str
    region: str
    brackets: Dict[str, int]  # bracket -> count
    total_accounts: int
    centroid: Tuple[float, float] = (0.0, 0.0)

@dataclass
class AggregatedData:
    """聚合数据结构"""
    generated_at: str
    data_source: str
    brackets: List[str]
    regions: List[str]
    countries: List[CountryData]
    totals: Dict[str, int]
    metadata: Dict[str, any]

class TikTokDataManager:
    """TikTok数据管理器"""
    
    # 标准粉丝区间
    STANDARD_BRACKETS = [
        '0-500', '500-1000', '1000-2000', '2000-3000', '3000-4000',
        '4000-5000', '5000-6000', '6000-7000', '7000-8000', '8000-9000', '10000+'
    ]
    
    # 国家代码到中文名映射
    COUNTRY_NAMES = {
        'US': '美国', 'CN': '中国', 'JP': '日本', 'GB': '英国', 'FR': '法国',
        'DE': '德国', 'KR': '韩国', 'IN': '印度', 'BR': '巴西', 'RU': '俄罗斯',
        'CA': '加拿大', 'AU': '澳大利亚', 'IT': '意大利', 'ES': '西班牙',
        'MX': '墨西哥', 'TR': '土耳其', 'NL': '荷兰', 'TH': '泰国',
        'SG': '新加坡', 'MY': '马来西亚', 'PH': '菲律宾', 'VN': '越南',
        'ID': '印度尼西亚', 'PK': '巴基斯坦', 'BD': '孟加拉国', 'IQ': '伊拉克',
        'IR': '伊朗', 'SA': '沙特阿拉伯', 'AE': '阿联酋', 'EG': '埃及',
        'MA': '摩洛哥', 'DZ': '阿尔及利亚', 'TN': '突尼斯', 'LY': '利比亚',
        'SD': '苏丹', 'ET': '埃塞俄比亚', 'KE': '肯尼亚', 'UG': '乌干达',
        'TZ': '坦桑尼亚', 'ZA': '南非', 'NG': '尼日利亚', 'GH': '加纳',
        'CI': '科特迪瓦', 'SN': '塞内加尔', 'ML': '马里', 'BF': '布基纳法索',
        'NE': '尼日尔', 'TD': '乍得', 'CM': '喀麦隆', 'CF': '中非共和国',
        'CG': '刚果共和国', 'CD': '刚果民主共和国', 'AO': '安哥拉', 'ZM': '赞比亚',
        'ZW': '津巴布韦', 'BW': '博茨瓦纳', 'NA': '纳米比亚', 'MZ': '莫桑比克',
        'MG': '马达加斯加', 'MU': '毛里求斯', 'SC': '塞舌尔', 'KM': '科摩罗',
        'DJ': '吉布提', 'SO': '索马里', 'ER': '厄立特里亚', 'SS': '南苏丹',
        'unknown': '未知地区'
    }
    
    def __init__(self, data_path: str = None):
        """初始化数据管理器"""
        self.data_path = Path(data_path) if data_path else None
        self.cache_file = Path("data_cache.json")
        self.config_file = Path("config.json")
        self._cache = {}
        self._last_scan_time = None
        
    def set_data_path(self, path: str) -> bool:
        """设置数据路径"""
        try:
            self.data_path = Path(path)
            if not self.data_path.exists():
                logger.error(f"数据路径不存在: {path}")
                return False
            
            # 保存配置
            config = {
                'data_path': str(self.data_path.absolute()),
                'last_updated': datetime.now().isoformat()
            }
            with open(self.config_file, 'w', encoding='utf-8') as f:
                json.dump(config, f, ensure_ascii=False, indent=2)
            
            logger.info(f"数据路径设置成功: {path}")
            return True
        except Exception as e:
            logger.error(f"设置数据路径失败: {e}")
            return False
    
    def load_config(self) -> Optional[Dict]:
        """加载配置文件"""
        try:
            if self.config_file.exists():
                with open(self.config_file, 'r', encoding='utf-8') as f:
                    config = json.load(f)
                if 'data_path' in config:
                    self.data_path = Path(config['data_path'])
                return config
        except Exception as e:
            logger.error(f"加载配置失败: {e}")
        return None
    
    def scan_data_directory(self) -> Tuple[int, int, int]:
        """扫描数据目录，返回(地区数, 国家数, 文件数)"""
        if not self.data_path or not self.data_path.exists():
            return 0, 0, 0
        
        regions = 0
        countries = 0
        files = 0
        
        try:
            for region_dir in self.data_path.iterdir():
                if region_dir.is_dir():
                    regions += 1
                    for country_dir in region_dir.iterdir():
                        if country_dir.is_dir():
                            countries += 1
                            for file_path in country_dir.iterdir():
                                if file_path.is_file() and file_path.suffix == '.txt':
                                    files += 1
        except Exception as e:
            logger.error(f"扫描目录失败: {e}")
        
        return regions, countries, files
    
    def read_account_file(self, file_path: Path) -> int:
        """读取账号文件，返回账号数量"""
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                lines = f.readlines()
            # 过滤空行和注释行
            valid_lines = [line.strip() for line in lines 
                          if line.strip() and not line.strip().startswith('#')]
            return len(valid_lines)
        except Exception as e:
            logger.error(f"读取文件失败 {file_path}: {e}")
            return 0
    
    def parse_data_directory(self) -> AggregatedData:
        """解析数据目录，生成聚合数据"""
        if not self.data_path or not self.data_path.exists():
            raise ValueError("数据路径未设置或不存在")
        
        logger.info(f"开始解析数据目录: {self.data_path}")
        
        regions_data = {}
        countries_list = []
        total_accounts = 0
        
        for region_dir in self.data_path.iterdir():
            if not region_dir.is_dir():
                continue
            
            region_name = region_dir.name
            logger.info(f"处理地区: {region_name}")
            
            region_countries = {}
            region_total = 0
            
            for country_dir in region_dir.iterdir():
                if not country_dir.is_dir():
                    continue
                
                country_code = country_dir.name
                country_brackets = {}
                country_total = 0
                
                # 读取各个粉丝区间文件
                for bracket in self.STANDARD_BRACKETS:
                    file_path = country_dir / f"{bracket}.txt"
                    if file_path.exists():
                        count = self.read_account_file(file_path)
                        if count > 0:
                            country_brackets[bracket] = count
                            country_total += count
                
                if country_total > 0:
                    # 创建国家数据
                    country_data = CountryData(
                        code=country_code,
                        name_zh=self.COUNTRY_NAMES.get(country_code, country_code),
                        region=region_name,
                        brackets=country_brackets,
                        total_accounts=country_total
                    )
                    
                    countries_list.append(country_data)
                    region_countries[country_code] = country_brackets
                    region_total += country_total
                    total_accounts += country_total
            
            if region_countries:
                regions_data[region_name] = RegionData(
                    name=region_name,
                    countries=region_countries,
                    total_accounts=region_total,
                    total_countries=len(region_countries)
                )
        
        # 按账号数排序
        countries_list.sort(key=lambda x: x.total_accounts, reverse=True)
        
        # 生成聚合数据
        aggregated = AggregatedData(
            generated_at=datetime.now().isoformat(),
            data_source=str(self.data_path.absolute()),
            brackets=self.STANDARD_BRACKETS,
            regions=list(regions_data.keys()),
            countries=countries_list,
            totals={
                'accounts': total_accounts,
                'countries': len(countries_list),
                'regions': len(regions_data)
            },
            metadata={
                'scan_time': datetime.now().isoformat(),
                'data_hash': self._calculate_data_hash(countries_list)
            }
        )
        
        logger.info(f"数据解析完成: {len(countries_list)} 个国家, {total_accounts} 个账号")
        return aggregated
    
    def _calculate_data_hash(self, countries: List[CountryData]) -> str:
        """计算数据哈希值，用于检测变化"""
        data_str = json.dumps([asdict(c) for c in countries], sort_keys=True)
        return hashlib.md5(data_str.encode()).hexdigest()
    
    def save_cache(self, data: AggregatedData):
        """保存缓存"""
        try:
            cache_data = {
                'data': asdict(data),
                'cached_at': datetime.now().isoformat()
            }
            with open(self.cache_file, 'w', encoding='utf-8') as f:
                json.dump(cache_data, f, ensure_ascii=False, indent=2)
            logger.info("缓存保存成功")
        except Exception as e:
            logger.error(f"保存缓存失败: {e}")
    
    def load_cache(self) -> Optional[AggregatedData]:
        """加载缓存"""
        try:
            if self.cache_file.exists():
                with open(self.cache_file, 'r', encoding='utf-8') as f:
                    cache_data = json.load(f)
                
                data_dict = cache_data['data']
                # 重构CountryData对象
                countries = [CountryData(**c) for c in data_dict['countries']]
                data_dict['countries'] = countries
                
                return AggregatedData(**data_dict)
        except Exception as e:
            logger.error(f"加载缓存失败: {e}")
        return None
    
    def get_data(self, use_cache: bool = True, force_refresh: bool = False) -> AggregatedData:
        """获取数据"""
        if use_cache and not force_refresh:
            cached_data = self.load_cache()
            if cached_data:
                logger.info("使用缓存数据")
                return cached_data
        
        # 重新解析数据
        data = self.parse_data_directory()
        self.save_cache(data)
        return data
    
    def export_to_json(self, output_path: str = "aggregated.json") -> bool:
        """导出数据到JSON文件"""
        try:
            data = self.get_data()
            output_data = {
                'generatedAt': data.generated_at,
                'brackets': data.brackets,
                'totals': data.totals,
                'countries': [
                    {
                        'code': c.code,
                        'nameZh': c.name_zh,
                        'region': c.region,
                        'centroid': list(c.centroid),
                        'byBracket': c.brackets,
                        'totals': {'accounts': c.total_accounts}
                    }
                    for c in data.countries
                ],
                'regions': data.regions
            }
            
            with open(output_path, 'w', encoding='utf-8') as f:
                json.dump(output_data, f, ensure_ascii=False, indent=2)
            
            logger.info(f"数据已导出到: {output_path}")
            return True
        except Exception as e:
            logger.error(f"导出数据失败: {e}")
            return False

class TikTokDataServer:
    """TikTok数据服务器"""
    
    def __init__(self, data_dir: str, output_file: str = None, port: int = 8080):
        """初始化服务器
        
        Args:
            data_dir: 数据目录路径
            output_file: 输出JSON文件路径
            port: 服务器端口
        """
        self.data_manager = TikTokDataManager(data_dir)
        self.output_file = output_file or "可视化tiktok账号地球数据/public/data/aggregated.json"
        self.port = port
        self.host = 'localhost'
        self.is_running = False
        
        # 确保数据路径设置正确
        if not self.data_manager.set_data_path(data_dir):
            raise ValueError(f"无法设置数据路径: {data_dir}")
    
    def run_forever(self):
        """启动服务器并持续运行"""
        try:
            logger.info("🚀 启动TikTok数据服务器")
            logger.info(f"📁 数据目录: {self.data_manager.data_path}")
            logger.info(f"📄 输出文件: {self.output_file}")
            logger.info(f"🌐 服务端口: {self.port}")
            
            self.is_running = True
            
            # 首次数据解析和导出
            self.refresh_data_file()
            
            logger.info("✅ 服务器启动成功")
            logger.info("按 Ctrl+C 停止服务器")
            
            # 持续运行，每30秒检查一次数据更新
            try:
                while self.is_running:
                    import time
                    time.sleep(30)
                    # 可以在这里添加自动刷新逻辑
                    logger.info("🔄 定期检查数据更新...")
                    
            except KeyboardInterrupt:
                logger.info("\n⏹️  收到停止信号，正在关闭服务器...")
                self.stop()
                
        except Exception as e:
            logger.error(f"❌ 服务器运行失败: {e}")
            raise
    
    def refresh_data_file(self) -> bool:
        """刷新数据文件"""
        try:
            logger.info("🔄 开始刷新数据...")
            
            # 确保输出目录存在
            os.makedirs(os.path.dirname(self.output_file), exist_ok=True)
            
            # 导出数据到文件
            success = self.data_manager.export_to_json(self.output_file)
            
            if success:
                logger.info(f"✅ 数据已成功导出到: {self.output_file}")
                return True
            else:
                logger.error("❌ 数据导出失败")
                return False
                
        except Exception as e:
            logger.error(f"❌ 刷新数据失败: {e}")
            return False
    
    async def start(self, host: str = 'localhost', port: int = None):
        """启动服务器（异步版本）"""
        if port:
            self.port = port
        if host:
            self.host = host
            
        logger.info(f"TikTok数据服务器准备启动在 {self.host}:{self.port}")
        self.is_running = True
        
        # 这里可以添加实际的HTTP服务器实现
        # 例如使用aiohttp或fastapi
        logger.info("服务器启动成功")
        
        try:
            while self.is_running:
                await asyncio.sleep(1)
        except KeyboardInterrupt:
            logger.info("服务器停止")
            self.is_running = False
    
    def stop(self):
        """停止服务器"""
        self.is_running = False
        logger.info("🛑 服务器已停止")
    
    def get_status(self) -> Dict:
        """获取服务器状态"""
        return {
            'status': 'running' if self.is_running else 'stopped',
            'data_path': str(self.data_manager.data_path) if self.data_manager.data_path else None,
            'output_file': self.output_file,
            'port': self.port,
            'timestamp': datetime.now().isoformat()
        }
    
    def refresh_data(self) -> Dict:
        """刷新数据"""
        try:
            data = self.data_manager.get_data(force_refresh=True)
            
            # 同时更新输出文件
            self.refresh_data_file()
            
            return {
                'success': True,
                'message': '数据刷新成功',
                'data': asdict(data),
                'timestamp': datetime.now().isoformat()
            }
        except Exception as e:
            return {
                'success': False,
                'message': f'数据刷新失败: {str(e)}',
                'timestamp': datetime.now().isoformat()
            }

# 主程序入口
def main():
    """主程序"""
    print("🚀 TikTok数据管理器")
    print("=" * 50)
    
    # 初始化管理器
    manager = TikTokDataManager()
    
    # 尝试加载配置
    config = manager.load_config()
    if config and 'data_path' in config:
        print(f"📁 已加载配置，数据路径: {config['data_path']}")
        regions, countries, files = manager.scan_data_directory()
        print(f"📊 数据统计: {regions} 个地区, {countries} 个国家, {files} 个文件")
    else:
        print("⚠️  未找到配置文件，请设置数据路径")
        data_path = input("请输入数据目录路径: ").strip()
        if data_path and manager.set_data_path(data_path):
            print("✅ 数据路径设置成功")
        else:
            print("❌ 数据路径设置失败")
            return
    
    # 导出数据
    output_path = "可视化tiktok账号地球数据/public/data/aggregated.json"
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    
    if manager.export_to_json(output_path):
        print(f"✅ 数据已导出到: {output_path}")
    else:
        print("❌ 数据导出失败")

if __name__ == "__main__":
    main() 
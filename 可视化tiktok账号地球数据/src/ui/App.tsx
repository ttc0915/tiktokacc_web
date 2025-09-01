import React, { useEffect, useMemo, useState, useRef } from 'react';
// @ts-ignore
import ReactECharts from 'echarts-for-react';
import { DataLoader } from './DataLoader';
// import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, LineChart, Line } from 'recharts';

type BracketKey =
	| '0-500'
	| '500-1000'
	| '1000-2000'
	| '2000-3000'
	| '3000-4000'
	| '4000-5000'
	| '5000-6000'
	| '6000-7000'
	| '7000-8000'
	| '8000-9000'
	| '10000+';

type CountryDatum = {
	code: string;
	nameZh: string;
	region: string;
	centroid: [number, number];
	byBracket: Partial<Record<BracketKey, number>>;
	totals: { accounts: number };
};

type Aggregated = {
	generatedAt: string;
	brackets: BracketKey[];
	totals: { accounts: number };
	countries: CountryDatum[];
	regions: string[];
};

const ALL_BRACKETS: BracketKey[] = [
	'0-500',
	'500-1000',
	'1000-2000',
	'2000-3000',
	'3000-4000',
	'4000-5000',
	'5000-6000',
	'6000-7000',
	'7000-8000',
	'8000-9000',
	'10000+'
];

// 地区颜色映射函数
const getRegionColor = (region: string): string => {
	const regionColorMap: Record<string, string> = {
		'EU': '#4a90e2',           // 欧洲 - 蓝色
		'欧洲': '#4a90e2',          // 欧洲 - 蓝色
		'东南亚': '#50c878',         // 东南亚 - 绿色
		'中东': '#ffa500',          // 中东 - 橙色
		'非洲': '#9b59b6',          // 非洲 - 紫色
		'北美': '#1abc9c',          // 北美 - 青色
		'南美': '#f39c12',          // 南美 - 黄色
		'大洋洲': '#e74c3c',        // 大洋洲 - 红色
	};
	
	return regionColorMap[region] || '#6c757d'; // 默认灰色
};

type FilterState = {
	selectedBrackets: Set<BracketKey>;
	selectedRegions: Set<string>;
	query: string;
};

// 错误边界组件
class ErrorBoundary extends React.Component<
	{ children: React.ReactNode },
	{ hasError: boolean; error?: Error }
> {
	constructor(props: { children: React.ReactNode }) {
		super(props);
		this.state = { hasError: false };
	}

	static getDerivedStateFromError(error: Error) {
		return { hasError: true, error };
	}

	componentDidCatch(error: Error, errorInfo: any) {
		console.error('React错误边界捕获错误:', error, errorInfo);
	}

	render() {
		if (this.state.hasError) {
			return (
				<div style={{
					background: '#0f1419',
					color: 'white',
					minHeight: '100vh',
					display: 'flex',
					alignItems: 'center',
					justifyContent: 'center',
					fontFamily: 'Microsoft YaHei, sans-serif'
				}}>
					<div style={{
						background: 'rgba(255, 100, 100, 0.2)',
						border: '1px solid #ff6464',
						borderRadius: '12px',
						padding: '40px',
						maxWidth: '600px',
						textAlign: 'center'
					}}>
						<h2 style={{ color: '#ff6464', margin: '0 0 20px 0' }}>⚠️ 渲染错误</h2>
						<p style={{ marginBottom: '20px' }}>
							页面渲染时发生错误，请检查浏览器控制台获取详细信息。
						</p>
						<pre style={{
							background: 'rgba(255,255,255,0.1)',
							padding: '15px',
							borderRadius: '8px',
							fontSize: '12px',
							textAlign: 'left',
							overflow: 'auto'
						}}>
							{this.state.error?.message || '未知错误'}
						</pre>
						<button
							onClick={() => window.location.reload()}
							style={{
								background: '#ff6464',
								color: 'white',
								border: 'none',
								padding: '12px 24px',
								borderRadius: '6px',
								marginTop: '20px',
								cursor: 'pointer'
							}}
						>
							刷新页面
						</button>
					</div>
				</div>
			);
		}

		return this.props.children;
	}
}

// 目录选择器组件
const DirectorySelector: React.FC<{ onDataLoaded: (data: Aggregated) => void }> = ({ onDataLoaded }) => {
	const [isLoading, setIsLoading] = useState(false);
	const [error, setError] = useState<string>('');
	const [debugInfo, setDebugInfo] = useState<string[]>([]);

	const addDebugInfo = (info: string) => {
		setDebugInfo(prev => [...prev, `${new Date().toLocaleTimeString()}: ${info}`]);
	};

	const handleDirectorySelect = async () => {
		try {
			setIsLoading(true);
			setError('');
			setDebugInfo([]);
			
			// 检查浏览器支持
			if (!('showDirectoryPicker' in window)) {
				setError('您的浏览器不支持目录选择API，请使用Chrome 88+或Edge 88+');
				return;
			}

			addDebugInfo('开始选择目录...');
			// @ts-ignore
			const dirHandle = await window.showDirectoryPicker();
			addDebugInfo(`选择的目录: ${dirHandle.name}`);
			
			const data = await parseDirectoryData(dirHandle);
			addDebugInfo(`解析完成: ${data.countries.length} 个国家，${data.regions.length} 个区域`);
			
			// 添加更详细的调试信息
			console.log('准备传递的数据:', data);
			
			if (data.countries.length === 0) {
				setError('未找到有效的账号数据。请确认目录结构：粉丝分类/{区域名}/{国家代码}/{粉丝区间}.txt');
				return;
			}
			
			// 在传递数据前添加延迟，让用户看到调试信息
			setTimeout(() => {
				console.log('正在调用onDataLoaded...');
				onDataLoaded(data);
			}, 1000);
			
		} catch (error: any) {
			console.error('选择目录失败:', error);
			if (error.name === 'AbortError') {
				setError('用户取消了目录选择');
			} else {
				setError(`目录选择失败: ${error.message}`);
			}
		} finally {
			setIsLoading(false);
		}
	};

	const parseDirectoryData = async (dirHandle: any): Promise<Aggregated> => {
		const countries: CountryDatum[] = [];
		const regions = new Set<string>();
		let totalAccounts = 0;
		let processedFiles = 0;

		addDebugInfo('开始解析目录结构...');

		for await (const [regionName, regionHandle] of dirHandle.entries()) {
			if (regionHandle.kind !== 'directory') {
				addDebugInfo(`跳过非目录: ${regionName}`);
				continue;
			}
			
			addDebugInfo(`处理区域: ${regionName}`);
			regions.add(regionName);

			for await (const [countryCode, countryHandle] of regionHandle.entries()) {
				if (countryHandle.kind !== 'directory') {
					addDebugInfo(`跳过非目录: ${regionName}/${countryCode}`);
					continue;
				}

				addDebugInfo(`处理国家: ${regionName}/${countryCode}`);
				console.log(`[数据解析] 创建国家数据: ${countryCode} → 地区: ${regionName}`);
				const countryData: CountryDatum = {
					code: countryCode,
					nameZh: countryCode, // TODO: 获取中文名
					region: regionName,
					centroid: [0, 0],
					byBracket: {},
					totals: { accounts: 0 }
				};

				for await (const [fileName, fileHandle] of countryHandle.entries()) {
					if (fileHandle.kind !== 'file' || !fileName.endsWith('.txt')) {
						continue;
					}
					
					const bracket = fileName.replace('.txt', '') as BracketKey;
					if (!ALL_BRACKETS.includes(bracket)) {
						addDebugInfo(`跳过未知区间文件: ${fileName}`);
						continue;
					}

					try {
						const file = await fileHandle.getFile();
						const content = await file.text();
						const lineCount = content.split('\n').filter((line: string) => line.trim() && !line.startsWith('#')).length;
						
						countryData.byBracket[bracket] = lineCount;
						countryData.totals.accounts += lineCount;
						totalAccounts += lineCount;
						processedFiles++;
						
						if (lineCount > 0) {
							addDebugInfo(`${regionName}/${countryCode}/${bracket}: ${lineCount} 个账号`);
						}
					} catch (error) {
						addDebugInfo(`读取文件失败: ${regionName}/${countryCode}/${fileName}`);
						console.warn(`读取文件失败: ${fileName}`, error);
					}
				}

				if (countryData.totals.accounts > 0) {
					console.log(`[数据解析] 推入国家: ${countryData.code} → 地区: ${countryData.region} → 总账号: ${countryData.totals.accounts}`);
					countries.push(countryData);
				} else {
					console.log(`[数据解析] 跳过空国家: ${countryData.code} → 地区: ${countryData.region} → 总账号: 0`);
				}
			}
		}

		addDebugInfo(`解析完成: 处理了 ${processedFiles} 个文件`);
		
		// 按地区统计国家分布
		const countryByRegion = new Map<string, string[]>();
		countries.forEach(c => {
			if (!countryByRegion.has(c.region)) {
				countryByRegion.set(c.region, []);
			}
			countryByRegion.get(c.region)!.push(c.code);
		});
		
		console.log(`[parseDirectoryData] 各地区的国家分布:`);
		for (const [region, countryCodes] of countryByRegion.entries()) {
			console.log(`  ${region}: ${countryCodes.length}个国家 - ${countryCodes.slice(0, 15).join(', ')}${countryCodes.length > 15 ? '...' : ''}`);
		}

		const result = {
			generatedAt: new Date().toISOString(),
			brackets: ALL_BRACKETS,
			totals: { accounts: totalAccounts },
			countries: countries.sort((a, b) => b.totals.accounts - a.totals.accounts),
			regions: Array.from(regions)
		};

		// 详细记录最终结果
		console.log('数据解析结果:', {
			totalCountries: result.countries.length,
			totalAccounts: result.totals.accounts,
			regions: result.regions,
			sampleCountries: result.countries.slice(0, 3)
		});

		return result;
	};

	const handleFileInput = async (event: React.ChangeEvent<HTMLInputElement>) => {
		const files = event.target.files;
		if (!files) return;

		try {
			setIsLoading(true);
			setError('');
			setDebugInfo([]);
			
			addDebugInfo(`选择了 ${files.length} 个文件`);
			
			const data = await parseFileList(Array.from(files));
			addDebugInfo(`解析完成: ${data.countries.length} 个国家，${data.regions.length} 个区域`);
			
			if (data.countries.length === 0) {
				setError('未找到有效的账号数据。请确认选择了正确的文件');
				return;
			}
			
			onDataLoaded(data);
		} catch (error: any) {
			setError(`文件解析失败: ${error.message}`);
		} finally {
			setIsLoading(false);
		}
	};

	const parseFileList = async (files: File[]): Promise<Aggregated> => {
		const countries: CountryDatum[] = [];
		const regions = new Set<string>();
		let totalAccounts = 0;

		const countryMap = new Map<string, CountryDatum>();

		for (const file of files) {
			if (!file.name.endsWith('.txt')) continue;
			
			// 解析文件路径: 粉丝分类/区域/国家/区间.txt
			const pathParts = file.webkitRelativePath.split('/');
			if (pathParts.length < 4) continue;
			
			const regionName = pathParts[pathParts.length - 3];
			const countryCode = pathParts[pathParts.length - 2];
			const bracket = file.name.replace('.txt', '') as BracketKey;
			
			if (!ALL_BRACKETS.includes(bracket)) continue;
			
			regions.add(regionName);
			
			const key = `${regionName}-${countryCode}`;
			let countryData = countryMap.get(key);
			if (!countryData) {
				countryData = {
					code: countryCode,
					nameZh: countryCode,
					region: regionName,
					centroid: [0, 0],
					byBracket: {},
					totals: { accounts: 0 }
				};
				countryMap.set(key, countryData);
			}

			try {
				const content = await file.text();
				const lineCount = content.split('\n').filter((line: string) => line.trim() && !line.startsWith('#')).length;
				
				countryData.byBracket[bracket] = lineCount;
				countryData.totals.accounts += lineCount;
				totalAccounts += lineCount;
				
				if (lineCount > 0) {
					addDebugInfo(`${regionName}/${countryCode}/${bracket}: ${lineCount} 个账号`);
				}
			} catch (error) {
				addDebugInfo(`读取文件失败: ${file.name}`);
			}
		}

		countries.push(...Array.from(countryMap.values()).filter(c => c.totals.accounts > 0));

		// 按地区统计国家分布
		const countryByRegion = new Map<string, string[]>();
		countries.forEach(c => {
			if (!countryByRegion.has(c.region)) {
				countryByRegion.set(c.region, []);
			}
			countryByRegion.get(c.region)!.push(c.code);
		});
		
		console.log(`[数据解析完成] 各地区的国家分布:`);
		for (const [region, countryCodes] of countryByRegion.entries()) {
			console.log(`  ${region}: ${countryCodes.length}个国家 - ${countryCodes.slice(0, 10).join(', ')}${countryCodes.length > 10 ? '...' : ''}`);
		}

		return {
			generatedAt: new Date().toISOString(),
			brackets: ALL_BRACKETS,
			totals: { accounts: totalAccounts },
			countries: countries.sort((a, b) => b.totals.accounts - a.totals.accounts),
			regions: Array.from(regions)
		};
	};

	return (
		<div style={{
			position: 'fixed',
			top: 0,
			left: 0,
			right: 0,
			bottom: 0,
			backgroundColor: 'rgba(0, 20, 40, 0.95)',
			display: 'flex',
			alignItems: 'center',
			justifyContent: 'center',
			zIndex: 1000,
			padding: '20px'
		}}>
			<div style={{
				background: 'linear-gradient(135deg, #1e3c72 0%, #2a5298 100%)',
				padding: '40px',
				borderRadius: '20px',
				border: '2px solid #4a90e2',
				boxShadow: '0 20px 40px rgba(0, 0, 0, 0.3)',
				color: 'white',
				maxWidth: '600px',
				maxHeight: '80vh',
				overflow: 'auto'
			}}>
				<h1 style={{ marginBottom: '20px', fontSize: '24px', fontWeight: '300', textAlign: 'center' }}>
					TikTok 数据大屏
				</h1>
				<p style={{ marginBottom: '30px', opacity: 0.8, lineHeight: 1.6, textAlign: 'center' }}>
					请选择包含"粉丝分类"数据的目录<br/>
					目录结构：粉丝分类/{'{'}东南亚,中东,欧洲的号{'}'}/国家代码/粉丝区间.txt
				</p>

				<div style={{ display: 'flex', gap: '15px', marginBottom: '20px', flexWrap: 'wrap' }}>
					<button
						onClick={handleDirectorySelect}
						disabled={isLoading}
						style={{
							background: isLoading ? '#666' : 'linear-gradient(45deg, #4a90e2, #357abd)',
							color: 'white',
							border: 'none',
							padding: '12px 30px',
							borderRadius: '8px',
							fontSize: '14px',
							cursor: isLoading ? 'not-allowed' : 'pointer',
							flex: 1
						}}
					>
						{isLoading ? '正在加载...' : '选择目录 (推荐)'}
					</button>

					<label style={{
						background: 'linear-gradient(45deg, #50c878, #45b16a)',
						color: 'white',
						border: 'none',
						padding: '12px 30px',
						borderRadius: '8px',
						fontSize: '14px',
						cursor: 'pointer',
						flex: 1,
						textAlign: 'center'
					}}>
						选择文件 (备用)
						<input
							type="file"
							multiple
							{...({ webkitdirectory: "" } as any)}
							onChange={handleFileInput}
							disabled={isLoading}
							style={{ display: 'none' }}
						/>
					</label>
				</div>

				{error && (
					<div style={{
						background: 'rgba(255, 100, 100, 0.2)',
						border: '1px solid #ff6464',
						borderRadius: '8px',
						padding: '12px',
						marginBottom: '15px',
						fontSize: '14px'
					}}>
						❌ {error}
					</div>
				)}

				{debugInfo.length > 0 && (
					<div style={{
						background: 'rgba(255, 255, 255, 0.1)',
						border: '1px solid rgba(255, 255, 255, 0.2)',
						borderRadius: '8px',
						padding: '12px',
						maxHeight: '200px',
						overflow: 'auto',
						fontSize: '12px',
						fontFamily: 'monospace'
					}}>
						<div style={{ marginBottom: '8px', fontWeight: 'bold' }}>调试信息:</div>
						{debugInfo.map((info, i) => (
							<div key={i} style={{ marginBottom: '4px', opacity: 0.8 }}>
								{info}
							</div>
						))}
					</div>
				)}

				<div style={{ fontSize: '12px', opacity: 0.6, textAlign: 'center', marginTop: '15px' }}>
					💡 如果"选择目录"不可用，请使用Chrome/Edge浏览器，或点击"选择文件"上传整个文件夹
				</div>
			</div>
		</div>
	);
};

// 统计卡片组件
const StatCard: React.FC<{ title: string; value: string | number; subtitle?: string; color?: string }> = ({ 
	title, value, subtitle, color = '#4a90e2' 
}) => (
	<div style={{
		background: 'linear-gradient(135deg, rgba(74, 144, 226, 0.1) 0%, rgba(42, 82, 152, 0.1) 100%)',
		border: `1px solid ${color}`,
		borderRadius: '12px',
		padding: '24px',
		color: 'white',
		boxShadow: '0 8px 25px rgba(0, 0, 0, 0.1)'
	}}>
		<div style={{ fontSize: '14px', opacity: 0.7, marginBottom: '8px' }}>{title}</div>
		<div style={{ fontSize: '32px', fontWeight: 'bold', color: color, marginBottom: '4px' }}>
			{typeof value === 'number' ? value.toLocaleString() : value}
		</div>
		{subtitle && <div style={{ fontSize: '12px', opacity: 0.6 }}>{subtitle}</div>}
	</div>
);

// 简单图表组件
const SimpleChart: React.FC<{
	title: string;
	data: Array<{ name: string; value: number }>;
}> = ({ title, data }) => {
	const colors = ['#4a90e2', '#50c878', '#ffa500', '#ff6b6b', '#9b59b6', '#1abc9c', '#f39c12'];
	
	const total = data.reduce((sum, item) => sum + item.value, 0);
	
	return (
		<div style={{
			background: 'linear-gradient(135deg, rgba(74, 144, 226, 0.1), rgba(80, 200, 120, 0.05))',
			backdropFilter: 'blur(10px)',
			border: '1px solid rgba(74, 144, 226, 0.2)',
			borderRadius: '20px',
			padding: '30px',
			position: 'relative'
		}}>
			<div style={{
				display: 'flex',
				alignItems: 'center',
				gap: '12px',
				marginBottom: '25px'
			}}>
				<div style={{
					width: '40px',
					height: '40px',
					background: 'linear-gradient(135deg, #4a90e2, #50c878)',
					borderRadius: '12px',
					display: 'flex',
					alignItems: 'center',
					justifyContent: 'center',
					fontSize: '20px'
				}}>
					📊
				</div>
				<h4 style={{ 
					margin: 0, 
					color: 'white', 
					fontSize: '18px', 
					fontWeight: '600' 
				}}>
					{title}
				</h4>
			</div>
			
			<div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
				{data.slice(0, 8).map((item, index) => {
					const percentage = total > 0 ? (item.value / total * 100).toFixed(1) : '0';
					const color = colors[index % colors.length];
					
					return (
						<div key={item.name} style={{
							background: `linear-gradient(135deg, ${color}15, ${color}08)`,
							border: `1px solid ${color}30`,
							borderRadius: '12px',
							padding: '16px',
							display: 'flex',
							alignItems: 'center',
							gap: '12px',
							position: 'relative'
						}}>
							{/* 背景进度条 */}
							<div style={{
								position: 'absolute',
								top: 0,
								left: 0,
								height: '100%',
								width: `${percentage}%`,
								background: `linear-gradient(90deg, ${color}10, transparent)`,
								borderRadius: '12px'
							}} />
							
							<div style={{
								width: '32px',
								height: '32px',
								borderRadius: '10px',
								background: `linear-gradient(135deg, ${color}, ${color}cc)`,
								display: 'flex',
								alignItems: 'center',
								justifyContent: 'center',
								fontWeight: 'bold',
								fontSize: '12px',
								color: 'white',
								position: 'relative',
								zIndex: 1,
								boxShadow: `0 3px 10px ${color}30`
							}}>
								{index + 1}
							</div>
							
							<div style={{ 
								flex: 1, 
								fontSize: '14px', 
								fontWeight: '500', 
								color: 'white',
								position: 'relative',
								zIndex: 1
							}}>
								{item.name}
							</div>
							
							<div style={{ 
								fontSize: '16px', 
								fontWeight: 'bold', 
								color: color,
								position: 'relative',
								zIndex: 1
							}}>
								{item.value.toLocaleString()}
							</div>
							
							<div style={{ 
								fontSize: '12px', 
								opacity: 0.8, 
								width: '45px', 
								textAlign: 'right',
								color: 'white',
								position: 'relative',
								zIndex: 1
							}}>
								{percentage}%
							</div>
						</div>
					);
				})}
			</div>
		</div>
	);
};

// 国家详情页面组件
const CountryDetailPage: React.FC<{
	country: CountryDatum;
	onBack: () => void;
	isMobile: boolean;
}> = ({ country, onBack, isMobile }) => {
	
	// 页面加载时滚动到顶部，并强化样式重置
	React.useEffect(() => {
		// 完全移除所有默认边距和填充，修复手机白框问题
		document.body.style.margin = '0';
		document.body.style.padding = '0';
		document.documentElement.style.margin = '0';
		document.documentElement.style.padding = '0';
		document.body.style.width = '100%';
		document.body.style.overflowX = 'hidden';
		document.documentElement.style.width = '100%';
		document.documentElement.style.overflowX = 'hidden';
		
		// 立即尝试滚动到顶部
		const scrollToTop = () => {
			window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
			document.documentElement.scrollTop = 0;
			document.body.scrollTop = 0;
		};
		
		// 立即执行
		scrollToTop();
		
		// 延迟执行，确保DOM完全渲染
		const timer = setTimeout(scrollToTop, 50);
		const timer2 = setTimeout(scrollToTop, 200);
		
		return () => {
			clearTimeout(timer);
			clearTimeout(timer2);
		};
	}, []);
	
	// 计算粉丝区间数据，按账号数排序
	const bracketDetails = ALL_BRACKETS
		.map(bracket => ({
			bracket,
			count: country.byBracket[bracket] || 0
		}))
		.filter(item => item.count > 0)
		.sort((a, b) => {
			// 按照粉丝区间从低到高排序
			const getMinValue = (bracket: string) => {
				if (bracket === '10000+') return 10000;
				return parseInt(bracket.split('-')[0]);
			};
			return getMinValue(a.bracket) - getMinValue(b.bracket);
		});

	const colors = ['#4a90e2', '#50c878', '#ffa500', '#ff6b6b', '#9b59b6', '#1abc9c', '#f39c12'];

	return (
		<div style={{
			background: 'linear-gradient(135deg, #0f1419 0%, #1a2332 50%, #0f1419 100%)',
			minHeight: '100vh',
			width: '100%',
			margin: 0,
			padding: 0,
			color: 'white',
			fontFamily: 'Microsoft YaHei, sans-serif',
			overflow: 'visible',
			position: 'relative' // 确保正常的文档流
		}}>
			{/* 顶部导航栏 - 简化设计 */}
			<header style={{
				position: 'sticky',
				top: 0,
				zIndex: 100,
				background: 'rgba(15, 20, 25, 0.95)',
				backdropFilter: 'blur(20px)',
				borderBottom: '1px solid rgba(74, 144, 226, 0.2)',
				padding: isMobile ? '12px 16px' : '16px 24px'
			}}>
				<div style={{
					display: 'flex',
					alignItems: 'center',
					gap: isMobile ? '12px' : '16px',
					maxWidth: '1200px',
					margin: '0 auto'
				}}>
					<button
						{...createTouchHandler(onBack)}
						style={{
							background: 'linear-gradient(135deg, rgba(74, 144, 226, 0.2), rgba(74, 144, 226, 0.1))',
							border: '1px solid rgba(74, 144, 226, 0.3)',
							borderRadius: '12px',
							padding: isMobile ? '10px 14px' : '10px 16px',
							color: 'white',
							cursor: 'pointer',
							fontSize: isMobile ? '14px' : '14px',
							display: 'flex',
							alignItems: 'center',
							gap: '6px',
							transition: 'all 0.3s ease',
							fontWeight: '500',
							minHeight: isMobile ? '44px' : 'auto' // 确保移动端触摸目标足够大
						}}
					>
						← 返回主页
					</button>
					<div style={{ flex: 1 }}>
						<div style={{
							display: 'flex',
							alignItems: 'center',
							gap: '8px',
							marginBottom: '2px'
						}}>
							<h1 style={{ 
								margin: 0, 
								fontSize: isMobile ? '18px' : '22px', 
								fontWeight: '600',
								background: 'linear-gradient(135deg, #4a90e2, #50c878)',
								WebkitBackgroundClip: 'text',
								WebkitTextFillColor: 'transparent'
							}}>
								{country.nameZh}
							</h1>
							<span style={{
								background: 'linear-gradient(135deg, #4a90e2, #357abd)',
								color: 'white',
								padding: '2px 8px',
								borderRadius: '6px',
								fontSize: isMobile ? '11px' : '12px',
								fontWeight: '500'
							}}>
								{country.code}
							</span>
						</div>
						<div style={{ 
							fontSize: isMobile ? '11px' : '13px', 
							opacity: 0.7,
							display: 'flex',
							alignItems: 'center',
							gap: '6px'
						}}>
							<span>{country.region}</span>
							<span>•</span>
							<span>{country.totals.accounts.toLocaleString()} 个账号</span>
						</div>
					</div>
				</div>
			</header>

			{/* 内容区域 - 简化滚动 */}
			<div style={{ 
				padding: isMobile ? '16px' : '24px',
				maxWidth: '1200px',
				margin: '0 auto',
				paddingBottom: isMobile ? '80px' : '60px'
			}}>
				{/* 概览卡片 */}
				<div style={{
					background: 'linear-gradient(135deg, rgba(74, 144, 226, 0.1), rgba(80, 200, 120, 0.05))',
					backdropFilter: 'blur(10px)',
					borderRadius: '20px',
					border: '1px solid rgba(74, 144, 226, 0.2)',
					padding: isMobile ? '20px' : '30px',
					marginBottom: isMobile ? '20px' : '30px',
					position: 'relative'
				}}>
					<div style={{
						display: 'flex',
						alignItems: 'center',
						gap: '12px',
						marginBottom: isMobile ? '16px' : '20px'
					}}>
						<div style={{
							width: '40px',
							height: '40px',
							background: 'linear-gradient(135deg, #4a90e2, #50c878)',
							borderRadius: '12px',
							display: 'flex',
							alignItems: 'center',
							justifyContent: 'center',
							fontSize: '20px'
						}}>
							📊
						</div>
						<h2 style={{ 
							margin: 0, 
							fontSize: isMobile ? '18px' : '22px',
							fontWeight: '600',
							color: 'white'
						}}>
							账号分布概览
						</h2>
					</div>
					
					<div style={{
						display: 'grid',
						gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(4, 1fr)',
						gap: isMobile ? '12px' : '20px'
					}}>
						<div style={{
							background: 'linear-gradient(135deg, rgba(74, 144, 226, 0.2), rgba(74, 144, 226, 0.1))',
							borderRadius: '16px',
							padding: isMobile ? '16px' : '20px',
							textAlign: 'center',
							border: '1px solid rgba(74, 144, 226, 0.3)'
						}}>
							<div style={{ 
								fontSize: isMobile ? '20px' : '28px', 
								fontWeight: 'bold', 
								color: '#4a90e2',
								marginBottom: '4px'
							}}>
								{country.totals.accounts.toLocaleString()}
							</div>
							<div style={{ fontSize: isMobile ? '11px' : '13px', opacity: 0.8, color: 'white' }}>
								总账号数
							</div>
						</div>
						
						<div style={{
							background: 'linear-gradient(135deg, rgba(80, 200, 120, 0.2), rgba(80, 200, 120, 0.1))',
							borderRadius: '16px',
							padding: isMobile ? '16px' : '20px',
							textAlign: 'center',
							border: '1px solid rgba(80, 200, 120, 0.3)'
						}}>
							<div style={{ 
								fontSize: isMobile ? '20px' : '28px', 
								fontWeight: 'bold', 
								color: '#50c878',
								marginBottom: '4px'
							}}>
								{bracketDetails.length}
							</div>
							<div style={{ fontSize: isMobile ? '11px' : '13px', opacity: 0.8, color: 'white' }}>
								活跃区间
							</div>
						</div>
						
						<div style={{
							background: 'linear-gradient(135deg, rgba(255, 165, 0, 0.2), rgba(255, 165, 0, 0.1))',
							borderRadius: '16px',
							padding: isMobile ? '16px' : '20px',
							textAlign: 'center',
							border: '1px solid rgba(255, 165, 0, 0.3)'
						}}>
							<div style={{ 
								fontSize: isMobile ? '20px' : '28px', 
								fontWeight: 'bold', 
								color: '#ffa500',
								marginBottom: '4px'
							}}>
								{Math.round(country.totals.accounts / bracketDetails.length).toLocaleString()}
							</div>
							<div style={{ fontSize: isMobile ? '11px' : '13px', opacity: 0.8, color: 'white' }}>
								平均每区间
							</div>
						</div>
						
						<div style={{
							background: 'linear-gradient(135deg, rgba(155, 89, 182, 0.2), rgba(155, 89, 182, 0.1))',
							borderRadius: '16px',
							padding: isMobile ? '16px' : '20px',
							textAlign: 'center',
							border: '1px solid rgba(155, 89, 182, 0.3)',
							...(isMobile ? { gridColumn: 'span 2' } : {})
						}}>
							<div style={{ 
								fontSize: isMobile ? '16px' : '20px', 
								fontWeight: 'bold', 
								color: '#9b59b6',
								marginBottom: '4px'
							}}>
								{country.region}
							</div>
							<div style={{ fontSize: isMobile ? '11px' : '13px', opacity: 0.8, color: 'white' }}>
								所属区域
							</div>
						</div>
					</div>
				</div>

				{/* 粉丝区间详情 */}
				<div style={{
					background: 'linear-gradient(135deg, rgba(26, 35, 50, 0.8), rgba(15, 20, 25, 0.9))',
					backdropFilter: 'blur(10px)',
					borderRadius: '20px',
					border: '1px solid rgba(74, 144, 226, 0.2)',
					padding: isMobile ? '20px' : '30px'
				}}>
					<div style={{
						display: 'flex',
						alignItems: 'center',
						gap: '12px',
						marginBottom: isMobile ? '20px' : '30px'
					}}>
						<div style={{
							width: '40px',
							height: '40px',
							background: 'linear-gradient(135deg, #50c878, #4a90e2)',
							borderRadius: '12px',
							display: 'flex',
							alignItems: 'center',
							justifyContent: 'center',
							fontSize: '20px'
						}}>
							📈
						</div>
						<h3 style={{ 
							margin: 0, 
							fontSize: isMobile ? '18px' : '22px',
							fontWeight: '600',
							color: 'white'
						}}>
							粉丝区间分布详情
						</h3>
					</div>
					
					<div style={{
						display: 'grid',
						gridTemplateColumns: '1fr',
						gap: isMobile ? '12px' : '16px'
					}}>
						{bracketDetails.map((item, index) => {
							const percentage = (item.count / country.totals.accounts * 100).toFixed(1);
							const color = colors[index % colors.length];
							
							return (
								<div 
									key={item.bracket} 
									style={{
										background: `linear-gradient(135deg, ${color}15, ${color}08)`,
										border: `1px solid ${color}40`,
										borderRadius: '16px',
										padding: isMobile ? '16px' : '20px',
										display: 'flex',
										alignItems: 'center',
										gap: isMobile ? '12px' : '16px',
										position: 'relative'
									}}
								>
									{/* 背景进度条 */}
									<div style={{
										position: 'absolute',
										top: 0,
										left: 0,
										height: '100%',
										width: `${percentage}%`,
										background: `linear-gradient(90deg, ${color}10, transparent)`,
										borderRadius: '16px'
									}} />
									
									<div style={{
										width: isMobile ? '50px' : '60px',
										height: isMobile ? '50px' : '60px',
										borderRadius: '16px',
										background: `linear-gradient(135deg, ${color}, ${color}cc)`,
										display: 'flex',
										alignItems: 'center',
										justifyContent: 'center',
										fontWeight: 'bold',
										fontSize: isMobile ? '14px' : '16px',
										color: 'white',
										position: 'relative',
										zIndex: 1,
										boxShadow: `0 4px 15px ${color}30`
									}}>
										#{index + 1}
									</div>
									
									<div style={{ flex: 1, position: 'relative', zIndex: 1 }}>
										<div style={{ 
											fontWeight: '600', 
											fontSize: isMobile ? '15px' : '18px',
											marginBottom: '6px',
											color: 'white'
										}}>
											{item.bracket} 粉丝区间
										</div>
										<div style={{ 
											fontSize: isMobile ? '12px' : '14px', 
											opacity: 0.8,
											marginBottom: '10px',
											color: 'white'
										}}>
											{item.count.toLocaleString()} 个账号 • 占比 {percentage}%
										</div>
										<div style={{
											background: 'rgba(255, 255, 255, 0.1)',
											borderRadius: '8px',
											height: '6px',
											overflow: 'hidden'
										}}>
											<div style={{
												background: `linear-gradient(90deg, ${color}, ${color}aa)`,
												height: '100%',
												width: `${percentage}%`,
												borderRadius: '8px'
											}} />
										</div>
									</div>
									
									<div style={{ 
										fontSize: isMobile ? '18px' : '24px', 
										fontWeight: 'bold', 
										color: color,
										textAlign: 'center',
										position: 'relative',
										zIndex: 1
									}}>
										{item.count}
									</div>
								</div>
							);
						})}
					</div>
				</div>
			</div>
		</div>
	);
};

// 国家详情页面组件已经单独定义，点击时跳转到详情页面

// 移动端触摸事件处理工具
const createTouchHandler = (onActivate: () => void) => {
	let touchStartTime = 0;
	let touchStartPos = { x: 0, y: 0 };
	
	return {
		onTouchStart: (e: React.TouchEvent) => {
			touchStartTime = Date.now();
			const touch = e.touches[0];
			touchStartPos = { x: touch.clientX, y: touch.clientY };
		},
		onTouchEnd: (e: React.TouchEvent) => {
			const touchEndTime = Date.now();
			const touch = e.changedTouches[0];
			const touchEndPos = { x: touch.clientX, y: touch.clientY };
			
			// 检查是否是快速轻触（不是长按或拖拽）
			const touchDuration = touchEndTime - touchStartTime;
			const touchDistance = Math.sqrt(
				Math.pow(touchEndPos.x - touchStartPos.x, 2) + 
				Math.pow(touchEndPos.y - touchStartPos.y, 2)
			);
			
			if (touchDuration < 500 && touchDistance < 10) {
				e.stopPropagation(); // 不影响页面滚动，只阻止事件冒泡
				onActivate();
			}
		},
		onClick: onActivate
	};
};

// 自定义Hook，用于媒体查询
const useMediaQuery = (query: string) => {
	const [matches, setMatches] = useState(false);
	
	useEffect(() => {
		const media = window.matchMedia(query);
		
		// 立即设置初始值
		setMatches(media.matches);
		
		// 监听媒体查询变化
		const listener = (e: MediaQueryListEvent) => {
			setMatches(e.matches);
		};
		
		// 兼容新旧API
		if (media.addEventListener) {
			media.addEventListener('change', listener);
		} else {
			// 兼容旧版本浏览器
			media.addListener(listener);
		}
		
		return () => {
			if (media.removeEventListener) {
				media.removeEventListener('change', listener);
			} else {
				media.removeListener(listener);
			}
		};
	}, [query]);
	
	return matches;
};

// 营销弹窗组件
const MarketingModal: React.FC<{ isOpen: boolean; onClose: () => void }> = ({ isOpen, onClose }) => {
	if (!isOpen) return null;

	const handleTelegramClick = () => {
		window.open('https://t.me/ttc0915', '_blank');
	};

	return (
		<div style={{
			position: 'fixed',
			top: 0,
			left: 0,
			right: 0,
			bottom: 0,
			backgroundColor: 'rgba(0, 0, 0, 0.7)',
			display: 'flex',
			alignItems: 'center',
			justifyContent: 'center',
			zIndex: 9999,
			padding: '20px'
		}}>
			<div style={{
				background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
				padding: '40px',
				borderRadius: '20px',
				border: '2px solid #4a90e2',
				boxShadow: '0 25px 50px rgba(0, 0, 0, 0.5)',
				color: 'white',
				maxWidth: '500px',
				width: '100%',
				textAlign: 'center',
				position: 'relative',
				animation: 'modalSlideIn 0.3s ease-out'
			}}>
				{/* 关闭按钮 */}
				<button
					{...createTouchHandler(onClose)}
					style={{
						position: 'absolute',
						top: '15px',
						right: '15px',
						background: 'rgba(255, 255, 255, 0.2)',
						border: 'none',
						borderRadius: '50%',
						width: '30px',
						height: '30px',
						color: 'white',
						cursor: 'pointer',
						fontSize: '18px',
						display: 'flex',
						alignItems: 'center',
						justifyContent: 'center',
						transition: 'all 0.3s ease'
					}}
					onMouseEnter={(e) => {
						e.currentTarget.style.background = 'rgba(255, 255, 255, 0.3)';
					}}
					onMouseLeave={(e) => {
						e.currentTarget.style.background = 'rgba(255, 255, 255, 0.2)';
					}}
				>
					×
				</button>

				{/* 图标 */}
				<div style={{
					fontSize: '60px',
					marginBottom: '20px'
				}}>
					📱
				</div>

				{/* 标题 */}
				<h2 style={{
					margin: '0 0 20px 0',
					fontSize: '24px',
					fontWeight: '700',
					background: 'linear-gradient(45deg, #fff, #e3f2fd)',
					WebkitBackgroundClip: 'text',
					WebkitTextFillColor: 'transparent'
				}}>
					🔥 出售 TikTok 全球账号
				</h2>

				{/* 描述 */}
				<p style={{
					margin: '0 0 30px 0',
					fontSize: '16px',
					lineHeight: '1.6',
					opacity: 0.9
				}}>
					✨ 提供微软令牌接码登录<br/>
					🌍 覆盖全球各个地区<br/>
					⚡ 专业服务，安全可靠
				</p>

				{/* 按钮组 */}
				<div style={{
					display: 'flex',
					gap: '15px',
					justifyContent: 'center',
					flexWrap: 'wrap'
				}}>
					<button
						{...createTouchHandler(handleTelegramClick)}
						style={{
							background: 'linear-gradient(45deg, #0088cc, #229ed9)',
							color: 'white',
							border: 'none',
							padding: '12px 30px',
							borderRadius: '25px',
							fontSize: '16px',
							fontWeight: '600',
							cursor: 'pointer',
							display: 'flex',
							alignItems: 'center',
							gap: '8px',
							transition: 'all 0.3s ease',
							boxShadow: '0 4px 15px rgba(0, 136, 204, 0.4)'
						}}
						onMouseEnter={(e) => {
							e.currentTarget.style.transform = 'translateY(-2px)';
							e.currentTarget.style.boxShadow = '0 6px 20px rgba(0, 136, 204, 0.6)';
						}}
						onMouseLeave={(e) => {
							e.currentTarget.style.transform = 'translateY(0)';
							e.currentTarget.style.boxShadow = '0 4px 15px rgba(0, 136, 204, 0.4)';
						}}
					>
						📞 联系 @ttc0915
					</button>

					<button
						{...createTouchHandler(onClose)}
						style={{
							background: 'rgba(255, 255, 255, 0.2)',
							color: 'white',
							border: '1px solid rgba(255, 255, 255, 0.3)',
							padding: '12px 30px',
							borderRadius: '25px',
							fontSize: '16px',
							fontWeight: '600',
							cursor: 'pointer',
							transition: 'all 0.3s ease'
						}}
						onMouseEnter={(e) => {
							e.currentTarget.style.background = 'rgba(255, 255, 255, 0.3)';
						}}
						onMouseLeave={(e) => {
							e.currentTarget.style.background = 'rgba(255, 255, 255, 0.2)';
						}}
					>
						稍后再看
					</button>
				</div>

				{/* 小字提示 */}
				<div style={{
					marginTop: '20px',
					fontSize: '12px',
					opacity: 0.7
				}}>
					💡 优质账号资源，欢迎咨询
				</div>
			</div>

			<style>
				{`
					@keyframes modalSlideIn {
						from {
							opacity: 0;
							transform: scale(0.8) translateY(-20px);
						}
						to {
							opacity: 1;
							transform: scale(1) translateY(0);
						}
					}
				`}
			</style>
		</div>
	);
};

// 主应用组件
const MainApp: React.FC = () => {
	const [data, setData] = useState<Aggregated | null>(null);
	const [selectedCountry, setSelectedCountry] = useState<CountryDatum | null>(null);
	const [dataError, setDataError] = useState<string | null>(null);
	const [filters, setFilters] = useState<FilterState>({
		selectedBrackets: new Set(ALL_BRACKETS),
		selectedRegions: new Set<string>(),
		query: ''
	});
	
	// 页面状态：'main' 为主页面，'detail' 为详情页面
	const [currentPage, setCurrentPage] = useState<'main' | 'detail'>('main');
	
	// 营销弹窗状态
	const [showMarketingModal, setShowMarketingModal] = useState(true);

	// 地球图表引用
	const chartRef = useRef<HTMLDivElement>(null);

	const isMobile = useMediaQuery('(max-width: 768px)');

	// 数据加载处理
	const handleDataLoaded = (newData: Aggregated) => {
		console.log('MainApp收到数据:', newData);
		try {
			setData(newData);
			setDataError(null);
			console.log('数据设置成功');
		} catch (error) {
			console.error('设置数据时出错:', error);
		}
	};

	// 数据加载错误处理
	const handleDataError = (error: string) => {
		console.error('数据加载错误:', error);
		setDataError(error);
	};

	// 初始化选中所有区域 - 只在数据首次加载时执行
	const [hasInitialized, setHasInitialized] = useState(false);
	useEffect(() => {
		if (data && !hasInitialized) {
			console.log('初始化区域选择:', data.regions);
			setFilters(f => ({ ...f, selectedRegions: new Set(data.regions) }));
			setHasInitialized(true);
		}
	}, [data, hasInitialized]);

	// 计算选择地区的变化键，确保依赖精确触发
	const selectedRegionsKey = useMemo(() => Array.from(filters.selectedRegions).sort().join('|'), [filters.selectedRegions]);

	// 计算过滤后的国家数据 - 必须在条件判断之前调用
	const filteredCountries = useMemo(() => {
		if (!data) return [];
		
		return data.countries.filter(country => {
			// 区域筛选
			if (filters.selectedRegions.size > 0 && !filters.selectedRegions.has(country.region)) {
				return false;
			}

			// 搜索筛选（国家名称或代码）
			if (filters.query) {
				const query = filters.query.toLowerCase();
				return (
					country.nameZh.toLowerCase().includes(query) ||
					country.code.toLowerCase().includes(query)
				);
			}

			return true;
		}).sort((a, b) => b.totals.accounts - a.totals.accounts);
	}, [data, selectedRegionsKey, filters.query]);

	// 区域数据
	const regionData = useMemo(() => {
		if (!data) return [];
		
		const regionCounts = filteredCountries.reduce((acc, country) => {
			acc[country.region] = (acc[country.region] || 0) + country.totals.accounts;
			return acc;
		}, {} as Record<string, number>);

		return Object.entries(regionCounts).map(([name, value]) => ({ name, value }));
	}, [filteredCountries]);

	// 粉丝区间数据
	const bracketData = useMemo(() => {
		if (!data) return [];
		
		const bracketCounts = filteredCountries.reduce((acc, country) => {
			ALL_BRACKETS.forEach(bracket => {
				const count = country.byBracket[bracket] || 0;
				acc[bracket] = (acc[bracket] || 0) + count;
			});
			return acc;
		}, {} as Record<string, number>);

		return Object.entries(bracketCounts)
			.filter(([, value]) => value > 0)
			.map(([name, value]) => ({ name, value }));
	}, [filteredCountries]);

	// 如果没有数据，显示加载状态
	if (!data) {
		return (
			<>
				{/* 营销弹窗 */}
				<MarketingModal 
					isOpen={showMarketingModal} 
					onClose={() => setShowMarketingModal(false)} 
				/>
				
				<DataLoader onDataLoaded={handleDataLoaded} onError={handleDataError} />
				<div style={{ 
					background: 'linear-gradient(135deg, #0f1419 0%, #1a2332 50%, #0f1419 100%)',
					minHeight: '100vh',
					color: 'white',
					display: 'flex',
					alignItems: 'center',
					justifyContent: 'center',
					fontSize: '18px'
				}}>
					{dataError ? `数据加载错误: ${dataError}` : '正在加载数据...'}
				</div>
			</>
		);
	}

	// 如果是详情页面且有选中的国家，显示详情页面
	if (currentPage === 'detail' && selectedCountry) {
		return (
			<>
				{/* 营销弹窗 */}
				<MarketingModal 
					isOpen={showMarketingModal} 
					onClose={() => setShowMarketingModal(false)} 
				/>
				
				<CountryDetailPage
					country={selectedCountry}
					onBack={() => {
						setCurrentPage('main');
						setSelectedCountry(null);
					}}
					isMobile={isMobile}
				/>
			</>
		);
	}

	// 计算顶级国家（按账号数排序）
	const topCountries = [...data.countries]
		.sort((a, b) => b.totals.accounts - a.totals.accounts);

	// 主页面渲染
	return (
		<>
			{/* 营销弹窗 */}
			<MarketingModal 
				isOpen={showMarketingModal} 
				onClose={() => setShowMarketingModal(false)} 
			/>
			
			{/* 数据加载器组件 (在后台运行) */}
			<DataLoader onDataLoaded={handleDataLoaded} onError={handleDataError} />
			
			<div style={{ 
				background: 'linear-gradient(135deg, #0f1419 0%, #1a2332 50%, #0f1419 100%)',
				minHeight: '100vh', // 确保背景覆盖全屏
				color: 'white',
				fontFamily: 'Microsoft YaHei, sans-serif',
				margin: 0,
				padding: 0,
				width: '100%',
				position: 'relative' // 确保正常的文档流
			}}>
				{/* 顶部标题栏 - 现代化设计 */}
				<header style={{
					position: 'sticky',
					top: 0,
					zIndex: 100,
					background: 'rgba(15, 20, 25, 0.95)',
					backdropFilter: 'blur(20px)',
					borderBottom: '1px solid rgba(74, 144, 226, 0.2)',
					padding: isMobile ? '15px 20px' : '20px 40px',
					width: '100%',
					boxSizing: 'border-box'
				}}>
					<div style={{ maxWidth: isMobile ? '100%' : 'none', margin: '0 auto' }}>
						<h1 style={{ 
							margin: 0, 
							fontSize: isMobile ? '22px' : '28px', 
							fontWeight: '600',
							textAlign: 'center',
							background: 'linear-gradient(135deg, #4a90e2, #50c878)',
							WebkitBackgroundClip: 'text',
							WebkitTextFillColor: 'transparent',
							marginBottom: '8px'
						}}>
							TikTok 账号分布数据大屏
						</h1>
						<div style={{ textAlign: 'center', opacity: 0.7, fontSize: isMobile ? '12px' : '14px' }}>
							数据更新时间：{new Date(data.generatedAt).toLocaleString()}
						</div>
						<div style={{ textAlign: 'center', marginTop: '4px', opacity: 0.5, fontSize: isMobile ? '10px' : '12px' }}>
							原始数据: {data.countries.length} 个国家, {data.totals.accounts} 个账号, {data.regions.length} 个区域
						</div>
					</div>
				</header>

				{/* 控制面板 - 现代化设计 */}
				<div style={{ 
					padding: isMobile ? '20px' : '30px 40px', 
					maxWidth: isMobile ? '100%' : 'none', 
					margin: '0 auto',
					width: '100%',
					boxSizing: 'border-box'
				}}>
					{/* 如果没有数据，显示提示 */}
					{data.countries.length === 0 && (
						<div style={{
							background: 'linear-gradient(135deg, rgba(255, 193, 7, 0.1), rgba(255, 193, 7, 0.05))',
							backdropFilter: 'blur(10px)',
							border: '1px solid rgba(255, 193, 7, 0.3)',
							borderRadius: '20px',
							padding: '30px',
							marginBottom: '30px',
							textAlign: 'center'
						}}>
							<h3 style={{ color: '#ffc107', margin: '0 0 15px 0', fontSize: '20px' }}>⚠️ 未找到账号数据</h3>
							<p style={{ margin: '0 0 20px 0', opacity: 0.8, lineHeight: 1.6 }}>
								请检查目录结构是否正确：粉丝分类/{'{'}区域名{'}'}/{'{'}国家代码{'}'}/{'{'}粉丝区间{'}'}   .txt
								<br/>例如：粉丝分类/东南亚/US/0-500.txt
							</p>
							<button
								onClick={() => {
									setData(null);
									setDataError(null);
								}}
								style={{
									background: 'linear-gradient(135deg, #ffc107, #e6940a)',
									color: '#000',
									border: 'none',
									padding: '12px 24px',
									borderRadius: '12px',
									cursor: 'pointer',
									fontSize: '14px',
									fontWeight: '600'
								}}
							>
								重新选择数据
							</button>
						</div>
					)}

					<div style={{
						background: 'linear-gradient(135deg, rgba(74, 144, 226, 0.1), rgba(80, 200, 120, 0.05))',
						backdropFilter: 'blur(10px)',
						border: '1px solid rgba(74, 144, 226, 0.2)',
						borderRadius: '20px',
						padding: isMobile ? '20px' : '30px',
						marginBottom: '30px'
					}}>
						<div style={{ 
							display: 'flex', 
							flexDirection: isMobile ? 'column' : 'row',
							gap: '20px', 
							alignItems: isMobile ? 'stretch' : 'flex-end'
						}}>
							<div style={{ flex: 1 }}>
								<label style={{ 
									display: 'block', 
									marginBottom: '12px', 
									fontSize: '16px', 
									fontWeight: '600',
									color: 'white'
								}}>选择区域：</label>
								<div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
									{data.regions.length > 0 ? (
																			data.regions.map(region => {
										const active = filters.selectedRegions.has(region);
										const handleRegionToggle = () => {
											setFilters(f => {
												const next = new Set(f.selectedRegions);
												if (next.has(region)) next.delete(region);
												else next.add(region);
												return { ...f, selectedRegions: next };
											});
										};
										return (
											<button
												key={region}
												type="button"
												{...createTouchHandler(handleRegionToggle)}
												style={{
													padding: isMobile ? '10px 18px' : '8px 16px',
													borderRadius: '12px',
													border: `1px solid ${active ? 'rgba(74, 144, 226, 0.5)' : 'rgba(255, 255, 255, 0.2)'}`,
													background: active 
														? 'linear-gradient(135deg, rgba(74, 144, 226, 0.3), rgba(74, 144, 226, 0.2))' 
														: 'rgba(255, 255, 255, 0.05)',
													color: 'white',
													cursor: 'pointer',
													fontSize: isMobile ? '15px' : '14px',
													fontWeight: '500',
													transition: 'all 0.3s ease',
													minHeight: isMobile ? '44px' : 'auto'
												}}
											>
												{region}
											</button>
										);
									})
									) : (
										<div style={{ color: '#ff6b6b', fontSize: '14px' }}>未找到区域数据</div>
									)}
								</div>
							</div>
							
							<div style={{ minWidth: isMobile ? '100%' : '250px' }}>
								<label style={{ 
									display: 'block', 
									marginBottom: '12px', 
									fontSize: '16px', 
									fontWeight: '600',
									color: 'white'
								}}>搜索国家：</label>
								<input
									placeholder="输入国家名或代码"
									value={filters.query}
									onChange={(e) => setFilters(f => ({ ...f, query: e.target.value }))}
									style={{
										background: 'rgba(255, 255, 255, 0.1)',
										backdropFilter: 'blur(10px)',
										border: '1px solid rgba(74, 144, 226, 0.3)',
										borderRadius: '12px',
										padding: '10px 16px',
										color: 'white',
										fontSize: '14px',
										width: '100%',
										boxSizing: 'border-box'
									}}
								/>
							</div>
							
							<button
								{...createTouchHandler(() => {
									setData(null);
									setDataError(null);
								})}
								style={{
									background: 'linear-gradient(135deg, #ff6b6b, #ee5a52)',
									color: 'white',
									border: 'none',
									padding: isMobile ? '12px 24px' : '10px 20px',
									borderRadius: '12px',
									cursor: 'pointer',
									fontSize: isMobile ? '15px' : '14px',
									fontWeight: '600',
									minWidth: isMobile ? '140px' : '120px',
									minHeight: isMobile ? '44px' : 'auto'
								}}
							>
								重新加载数据
							</button>
						</div>
					</div>

					{/* 统计卡片 - 现代化设计 */}
					<div style={{ 
						display: 'grid', 
						gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', 
						gap: '20px', 
						marginBottom: '40px' 
					}}>
						<div style={{
							background: 'linear-gradient(135deg, rgba(74, 144, 226, 0.2), rgba(74, 144, 226, 0.1))',
							backdropFilter: 'blur(10px)',
							borderRadius: '20px',
							border: '1px solid rgba(74, 144, 226, 0.3)',
							padding: '30px',
							textAlign: 'center',
							position: 'relative'
						}}>
							<div style={{
								width: '50px',
								height: '50px',
								background: 'linear-gradient(135deg, #4a90e2, #357abd)',
								borderRadius: '16px',
								display: 'flex',
								alignItems: 'center',
								justifyContent: 'center',
								fontSize: '24px',
								margin: '0 auto 15px auto'
							}}>
								📊
							</div>
							<h3 style={{ margin: '0 0 10px 0', fontSize: '16px', opacity: 0.9, fontWeight: '600' }}>总账号数</h3>
							<div style={{ fontSize: '32px', fontWeight: 'bold', color: '#4a90e2', marginBottom: '8px' }}>
								{filteredCountries.reduce((sum, c) => sum + c.totals.accounts, 0).toLocaleString()}
							</div>
							<div style={{ fontSize: '13px', opacity: 0.7 }}>全部筛选条件下</div>
						</div>
						
						<div style={{
							background: 'linear-gradient(135deg, rgba(80, 200, 120, 0.2), rgba(80, 200, 120, 0.1))',
							backdropFilter: 'blur(10px)',
							borderRadius: '20px',
							border: '1px solid rgba(80, 200, 120, 0.3)',
							padding: '30px',
							textAlign: 'center'
						}}>
							<div style={{
								width: '50px',
								height: '50px',
								background: 'linear-gradient(135deg, #50c878, #3da85f)',
								borderRadius: '16px',
								display: 'flex',
								alignItems: 'center',
								justifyContent: 'center',
								fontSize: '24px',
								margin: '0 auto 15px auto'
							}}>
								🌍
							</div>
							<h3 style={{ margin: '0 0 10px 0', fontSize: '16px', opacity: 0.9, fontWeight: '600' }}>覆盖国家</h3>
							<div style={{ fontSize: '32px', fontWeight: 'bold', color: '#50c878', marginBottom: '8px' }}>
								{filteredCountries.length}
							</div>
							<div style={{ fontSize: '13px', opacity: 0.7 }}>个国家/地区</div>
						</div>
						
						<div style={{
							background: 'linear-gradient(135deg, rgba(255, 165, 0, 0.2), rgba(255, 165, 0, 0.1))',
							backdropFilter: 'blur(10px)',
							borderRadius: '20px',
							border: '1px solid rgba(255, 165, 0, 0.3)',
							padding: '30px',
							textAlign: 'center'
						}}>
							<div style={{
								width: '50px',
								height: '50px',
								background: 'linear-gradient(135deg, #ffa500, #e6940a)',
								borderRadius: '16px',
								display: 'flex',
								alignItems: 'center',
								justifyContent: 'center',
								fontSize: '24px',
								margin: '0 auto 15px auto'
							}}>
								📈
							</div>
							<h3 style={{ margin: '0 0 10px 0', fontSize: '16px', opacity: 0.9, fontWeight: '600' }}>平均每国</h3>
							<div style={{ fontSize: '32px', fontWeight: 'bold', color: '#ffa500', marginBottom: '8px' }}>
								{filteredCountries.length > 0 ? Math.round(filteredCountries.reduce((sum, c) => sum + c.totals.accounts, 0) / filteredCountries.length).toLocaleString() : 0}
							</div>
							<div style={{ fontSize: '13px', opacity: 0.7 }}>账号数量</div>
						</div>
					</div>

					{/* 图表区域 - 现代化设计 */}
					{regionData.length > 0 && bracketData.length > 0 ? (
						<div style={{ 
							display: 'grid', 
							gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', 
							gap: '30px', 
							marginBottom: '40px' 
						}}>
							<SimpleChart title="区域账号分布" data={regionData} />
							<SimpleChart title="粉丝区间分布" data={bracketData} />
						</div>
					) : (
						<div style={{ 
							background: 'linear-gradient(135deg, rgba(255, 193, 7, 0.1), rgba(255, 193, 7, 0.05))',
							backdropFilter: 'blur(10px)',
							border: '1px solid rgba(255, 193, 7, 0.3)',
							borderRadius: '20px',
							padding: '40px',
							marginBottom: '40px',
							textAlign: 'center'
						}}>
							<div style={{ fontSize: '48px', marginBottom: '16px' }}>📊</div>
							<div style={{ color: '#ffc107', fontSize: '18px', marginBottom: '8px' }}>暂无图表数据</div>
							<div style={{ fontSize: '14px', opacity: 0.7 }}>
								请检查筛选条件或数据内容
							</div>
						</div>
					)}

					{/* 国家排行榜 - 现代化设计 */}
					<div style={{
						background: 'linear-gradient(135deg, rgba(26, 35, 50, 0.8), rgba(15, 20, 25, 0.9))',
						backdropFilter: 'blur(10px)',
						borderRadius: '20px',
						border: '1px solid rgba(74, 144, 226, 0.2)',
						padding: isMobile ? '25px' : '35px'
					}}>
						<div style={{
							display: 'flex',
							alignItems: 'center',
							gap: '12px',
							marginBottom: '25px'
						}}>
							<div style={{
								width: '50px',
								height: '50px',
								background: 'linear-gradient(135deg, #50c878, #4a90e2)',
								borderRadius: '16px',
								display: 'flex',
								alignItems: 'center',
								justifyContent: 'center',
								fontSize: '24px'
							}}>
								🏆
							</div>
							<div>
								<h3 style={{ margin: 0, color: 'white', fontSize: isMobile ? '20px' : '24px', fontWeight: '600' }}>
									{filters.selectedRegions.size === data.regions.length ? '全部地区' : Array.from(filters.selectedRegions).join('、')} 账号排行榜
								</h3>
								<div style={{ fontSize: '14px', color: 'rgba(255, 255, 255, 0.7)', marginTop: '4px' }}>
									当前筛选：{Array.from(filters.selectedRegions).join('、')} | 共{filteredCountries.length}个国家 • 💡 点击国家查看详细分布
								</div>
							</div>
						</div>
						
						{filteredCountries.length > 0 ? (
							<div style={{ 
								display: 'grid', 
								gridTemplateColumns: `repeat(auto-fit, minmax(${isMobile ? '300px' : '350px'}, 1fr))`, 
								gap: '16px' 
							}}>
								{filteredCountries
									.filter(country => filters.selectedRegions.has(country.region))
									.map((country, index) => {
										const color = getRegionColor(country.region);
										const handleCountryClick = () => {
											setSelectedCountry(country);
											setCurrentPage('detail');
										};
										return (
											<div 
												key={`${country.region}-${country.code}`} 
												{...createTouchHandler(handleCountryClick)}
												style={{
													background: `linear-gradient(135deg, ${color}15, ${color}08)`,
													border: `1px solid ${color}40`,
													borderRadius: '16px',
													padding: isMobile ? '18px' : '20px',
													display: 'flex',
													alignItems: 'center',
													gap: '16px',
													cursor: 'pointer',
													transition: 'all 0.3s ease',
													position: 'relative',
													minHeight: isMobile ? '70px' : 'auto'
												}}
												onMouseEnter={(e) => {
													if (!isMobile) {
														e.currentTarget.style.transform = 'translateY(-3px)';
														e.currentTarget.style.boxShadow = `0 10px 30px ${color}20`;
													}
												}}
												onMouseLeave={(e) => {
													if (!isMobile) {
														e.currentTarget.style.transform = 'translateY(0)';
														e.currentTarget.style.boxShadow = 'none';
													}
												}}
											>
												<div style={{
													width: '50px',
													height: '50px',
													borderRadius: '16px',
													background: `linear-gradient(135deg, ${color}, ${color}cc)`,
													display: 'flex',
													alignItems: 'center',
													justifyContent: 'center',
													fontWeight: 'bold',
													fontSize: '16px',
													color: 'white',
													boxShadow: `0 4px 15px ${color}30`
												}}>
													#{index + 1}
												</div>
												<div style={{ flex: 1 }}>
													<div style={{ 
														fontWeight: '600', 
														fontSize: isMobile ? '16px' : '18px',
														marginBottom: '4px',
														color: 'white'
													}}>
														{country.nameZh} ({country.code})
													</div>
													<div style={{ 
														fontSize: isMobile ? '13px' : '14px', 
														opacity: 0.8,
														color: 'white'
													}}>
														{country.region} • {country.totals.accounts.toLocaleString()} 账号
													</div>
												</div>
												<div style={{ 
													fontSize: '24px',
													opacity: 0.6,
													color: color
												}}>
													→
												</div>
											</div>
										);
									})}
							</div>
						) : (
							<div style={{ textAlign: 'center', padding: '60px 20px', opacity: 0.7 }}>
								<div style={{ fontSize: '64px', marginBottom: '20px' }}>📋</div>
								<div style={{ fontSize: '20px', marginBottom: '10px', color: 'white' }}>暂无排行数据</div>
								<div style={{ fontSize: '14px', opacity: 0.7 }}>请调整筛选条件或检查数据内容</div>
							</div>
						)}
					</div>
				</div>
			</div>
		</>
	);
};

// 导出带错误边界的主组件
export const App: React.FC = () => {
	return (
		<ErrorBoundary>
			<MainApp />
		</ErrorBoundary>
	);
};


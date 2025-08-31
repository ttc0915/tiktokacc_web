import React, { useState, useEffect, useCallback } from 'react';

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

interface DataLoaderProps {
	onDataLoaded: (data: Aggregated) => void;
	onError: (error: string) => void;
}

interface LoadingState {
	isLoading: boolean;
	source: 'api' | 'file' | 'manual' | null;
	lastUpdate: Date | null;
	error: string | null;
}

const API_BASE_URL = 'http://localhost:8080';
const LOCAL_DATA_URL = '/data/aggregated.json';

export const DataLoader: React.FC<DataLoaderProps> = ({ onDataLoaded, onError }) => {
	const [loadingState, setLoadingState] = useState<LoadingState>({
		isLoading: false,
		source: null,
		lastUpdate: null,
		error: null
	});
	
	const [autoRefresh, setAutoRefresh] = useState(false);
	const [refreshInterval, setRefreshInterval] = useState(30); // 秒
	const [apiAvailable, setApiAvailable] = useState<boolean | null>(null);

	// 检查API是否可用
	const checkApiAvailability = useCallback(async (): Promise<boolean> => {
		try {
			const response = await fetch(`${API_BASE_URL}/api/status`, {
				method: 'GET',
				mode: 'cors'
			});
			
			if (response.ok) {
				console.log('API服务可用');
				return true;
			}
			return false;
		} catch (error) {
			console.log('API不可用，将使用本地文件:', error);
			return false;
		}
	}, []);

	// 从API获取数据
	const loadFromAPI = useCallback(async (refresh = false): Promise<Aggregated> => {
		const endpoint = refresh ? '/api/refresh' : '/api/data';
		const response = await fetch(`${API_BASE_URL}${endpoint}`, {
			method: 'GET',
			mode: 'cors',
			cache: 'no-cache'
		});
		
		if (!response.ok) {
			throw new Error(`API请求失败: ${response.status} ${response.statusText}`);
		}
		
		const result = await response.json();
		return refresh ? result.data : result;
	}, []);

	// 从本地文件获取数据
	const loadFromFile = useCallback(async (): Promise<Aggregated> => {
		const response = await fetch(LOCAL_DATA_URL, {
			cache: 'no-cache'
		});
		
		if (!response.ok) {
			throw new Error(`加载本地文件失败: ${response.status}`);
		}
		
		return await response.json();
	}, []);

	// 主要的数据加载函数
	const loadData = useCallback(async (source: 'api' | 'file' | 'auto' = 'auto', refresh = false) => {
		setLoadingState(prev => ({ ...prev, isLoading: true, error: null }));
		
		try {
			let data: Aggregated;
			let actualSource: 'api' | 'file';
			
			if (source === 'auto') {
				// 自动选择数据源
				const isApiAvailable = await checkApiAvailability();
				setApiAvailable(isApiAvailable);
				
				if (isApiAvailable) {
					console.log('使用API获取数据...');
					data = await loadFromAPI(refresh);
					actualSource = 'api';
				} else {
					console.log('API不可用，使用本地文件...');
					data = await loadFromFile();
					actualSource = 'file';
				}
			} else if (source === 'api') {
				data = await loadFromAPI(refresh);
				actualSource = 'api';
				setApiAvailable(true);
			} else {
				data = await loadFromFile();
				actualSource = 'file';
			}
			
			// 验证数据格式
			if (!data || !data.countries || !Array.isArray(data.countries)) {
				throw new Error('数据格式不正确');
			}
			
			console.log(`数据加载成功 (${actualSource}):`, {
				countries: data.countries.length,
				accounts: data.totals.accounts,
				regions: data.regions.length,
				generatedAt: data.generatedAt
			});
			
			setLoadingState({
				isLoading: false,
				source: actualSource,
				lastUpdate: new Date(),
				error: null
			});
			
			onDataLoaded(data);
			
		} catch (error: any) {
			console.error('数据加载失败:', error);
			const errorMessage = error.message || '未知错误';
			
			setLoadingState(prev => ({
				...prev,
				isLoading: false,
				error: errorMessage
			}));
			
			onError(errorMessage);
			
			// 如果API失败，尝试加载本地文件作为后备
			if (source === 'api' || source === 'auto') {
				try {
					console.log('尝试后备方案：加载本地文件...');
					const fallbackData = await loadFromFile();
					setLoadingState({
						isLoading: false,
						source: 'file',
						lastUpdate: new Date(),
						error: `API失败，已切换到本地文件: ${errorMessage}`
					});
					onDataLoaded(fallbackData);
					setApiAvailable(false);
				} catch (fallbackError: any) {
					console.error('后备加载也失败:', fallbackError);
					setApiAvailable(false);
				}
			}
		}
	}, [checkApiAvailability, loadFromAPI, loadFromFile, onDataLoaded, onError]);

	// 手动刷新数据
	const refreshData = useCallback(() => {
		if (loadingState.source === 'api') {
			loadData('api', true);
		} else {
			loadData('auto');
		}
	}, [loadData, loadingState.source]);

	// 自动刷新逻辑
	useEffect(() => {
		if (!autoRefresh || loadingState.source !== 'api') return;
		
		const interval = setInterval(() => {
			console.log('自动刷新数据...');
			loadData('api', true);
		}, refreshInterval * 1000);
		
		return () => clearInterval(interval);
	}, [autoRefresh, refreshInterval, loadData, loadingState.source]);

	// 初始化数据加载
	useEffect(() => {
		loadData('auto');
	}, [loadData]);

	return null;
}; 
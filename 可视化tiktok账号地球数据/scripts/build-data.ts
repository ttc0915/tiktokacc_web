import fs from 'fs';
import path from 'path';
import countriesLib from 'i18n-iso-countries';
// @ts-ignore
import countriesGeo from 'world-countries';
import zh from 'i18n-iso-countries/langs/zh.json';

countriesLib.registerLocale(zh as any);

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

type CountryAgg = {
	code: string;
	nameZh: string;
	region: string;
	centroid: [number, number];
	byBracket: Partial<Record<BracketKey, number>>;
	totals: { accounts: number };
};

const ROOT = path.resolve(__dirname, '..');
const DATA_DIR = process.env.DATA_DIR || path.resolve(ROOT, '..', '粉丝分类');
const OUTPUT = path.resolve(ROOT, 'public/data/aggregated.json');

function readLines(file: string): string[] {
	try {
		const raw = fs.readFileSync(file, 'utf-8');
		return raw
			.split(/\r?\n/)
			.map((l) => l.trim())
			.filter((l) => l.length > 0 && !l.startsWith('#'));
	} catch {
		return [];
	}
}

function getCentroid(code: string): [number, number] {
	try {
		const feature: any = (countriesGeo as any[]).find((c) => c.cca2 === code);
		if (!feature) return [0, 0];
		const latlng = feature.latlng as [number, number] | undefined;
		if (latlng && latlng.length === 2) {
			const [lat, lng] = latlng;
			return [lng, lat];
		}
	} catch {}
	return [0, 0];
}

function getNameZh(code: string): string {
	try {
		const name = countriesLib.getName(code, 'zh');
		if (name) return name;
	} catch {}
	return code;
}

function ensureDir(dir: string) {
	fs.mkdirSync(dir, { recursive: true });
}

function main() {
	if (!fs.existsSync(DATA_DIR)) {
		console.warn('数据目录不存在:', DATA_DIR);
		console.log('生成示例数据用于部署预览...');
		
		// 生成示例数据
		const sampleCountries: CountryAgg[] = [
			{
				code: 'GB',
				nameZh: '英国',
				region: 'EU',
				centroid: [-3.436, 55.378],
				byBracket: { '0-500': 15000, '500-1000': 12000, '1000-2000': 10000, '2000-3000': 8000, '10000+': 6544 },
				totals: { accounts: 51544 }
			},
			{
				code: 'PK',
				nameZh: '巴基斯坦',
				region: '东南亚',
				centroid: [69.345, 30.375],
				byBracket: { '0-500': 8000, '500-1000': 5000, '1000-2000': 4000, '2000-3000': 2000, '10000+': 1181 },
				totals: { accounts: 20181 }
			},
			{
				code: 'NL',
				nameZh: '荷兰',
				region: 'EU',
				centroid: [5.291, 52.132],
				byBracket: { '0-500': 4000, '500-1000': 2500, '1000-2000': 1500, '2000-3000': 800, '10000+': 241 },
				totals: { accounts: 9041 }
			},
			{
				code: 'AU',
				nameZh: '澳大利亚',
				region: '东南亚',
				centroid: [133.775, -25.274],
				byBracket: { '0-500': 4000, '500-1000': 2400, '1000-2000': 1500, '2000-3000': 800, '10000+': 272 },
				totals: { accounts: 8972 }
			},
			{
				code: 'FR',
				nameZh: '法国',
				region: 'EU',
				centroid: [2.213, 46.227],
				byBracket: { '0-500': 3500, '500-1000': 2200, '1000-2000': 1500, '2000-3000': 900, '10000+': 430 },
				totals: { accounts: 8530 }
			},
			{
				code: 'IQ',
				nameZh: '伊拉克',
				region: '中东',
				centroid: [43.679, 33.223],
				byBracket: { '0-500': 3500, '500-1000': 2000, '1000-2000': 1400, '2000-3000': 900, '10000+': 320 },
				totals: { accounts: 8120 }
			},
			{
				code: 'TR',
				nameZh: '土耳其',
				region: '东南亚',
				centroid: [35.243, 38.963],
				byBracket: { '0-500': 3000, '500-1000': 1800, '1000-2000': 1200, '2000-3000': 800, '10000+': 321 },
				totals: { accounts: 7121 }
			},
			{
				code: 'SA',
				nameZh: '沙特阿拉伯',
				region: '中东',
				centroid: [45.079, 23.885],
				byBracket: { '0-500': 3000, '500-1000': 1700, '1000-2000': 1200, '2000-3000': 800, '10000+': 361 },
				totals: { accounts: 7061 }
			}
		];
		
		const totalAccounts = sampleCountries.reduce((s, c) => s + c.totals.accounts, 0);
		const regions = Array.from(new Set(sampleCountries.map(c => c.region)));
		
		const sampleData = {
			generatedAt: new Date().toISOString(),
			brackets: ALL_BRACKETS,
			totals: { accounts: totalAccounts },
			countries: sampleCountries.sort((a, b) => b.totals.accounts - a.totals.accounts),
			regions: regions
		};
		
		ensureDir(path.dirname(OUTPUT));
		fs.writeFileSync(OUTPUT, JSON.stringify(sampleData, null, 2), 'utf-8');
		console.log('示例数据文件已生成:', OUTPUT);
		console.log(`总计: ${totalAccounts} 个账号, ${sampleCountries.length} 个国家, ${regions.length} 个区域`);
		return;
	}

	const countryAggMap = new Map<string, CountryAgg>();
	const regions = new Set<string>();

	const regionDirs = fs
		.readdirSync(DATA_DIR, { withFileTypes: true })
		.filter((d) => d.isDirectory())
		.map((d) => d.name);

	for (const regionName of regionDirs) {
		regions.add(regionName);
		const regionDir = path.join(DATA_DIR, regionName);
		
		const countries = fs
			.readdirSync(regionDir, { withFileTypes: true })
			.filter((d) => d.isDirectory())
			.map((d) => d.name);

		for (const code of countries) {
			const countryDir = path.join(regionDir, code);
			const agg: CountryAgg = countryAggMap.get(code) ?? {
				code,
				nameZh: getNameZh(code),
				region: regionName,
				centroid: getCentroid(code),
				byBracket: {},
				totals: { accounts: 0 }
			};

			for (const bracket of ALL_BRACKETS) {
				const file = path.join(countryDir, `${bracket}.txt`);
				const lines = fs.existsSync(file) ? readLines(file) : [];
				agg.byBracket[bracket] = (agg.byBracket[bracket] ?? 0) + lines.length;
				agg.totals.accounts += lines.length;
			}

			countryAggMap.set(code, agg);
		}
	}

	const countries = Array.from(countryAggMap.values());
	const totalAccounts = countries.reduce((s, c) => s + c.totals.accounts, 0);

	const out = {
		generatedAt: new Date().toISOString(),
		brackets: ALL_BRACKETS,
		totals: { accounts: totalAccounts },
		countries: countries.sort((a, b) => b.totals.accounts - a.totals.accounts),
		regions: Array.from(regions)
	};

	ensureDir(path.dirname(OUTPUT));
	fs.writeFileSync(OUTPUT, JSON.stringify(out, null, 2), 'utf-8');
	console.log('数据聚合完成:', OUTPUT);
	console.log(`总计: ${totalAccounts} 个账号, ${countries.length} 个国家, ${regions.size} 个区域`);
}

main();


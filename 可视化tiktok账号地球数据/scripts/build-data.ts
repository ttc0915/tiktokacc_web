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
		console.log('生成空数据文件...');
		
		// 生成空数据
		const emptyData = {
			generatedAt: new Date().toISOString(),
			brackets: ALL_BRACKETS,
			totals: { accounts: 0 },
			countries: [],
			regions: []
		};
		
		ensureDir(path.dirname(OUTPUT));
		fs.writeFileSync(OUTPUT, JSON.stringify(emptyData, null, 2), 'utf-8');
		console.log('空数据文件已生成:', OUTPUT);
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


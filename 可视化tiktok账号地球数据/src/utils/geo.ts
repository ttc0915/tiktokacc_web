import countriesLib from 'i18n-iso-countries';
import zh from 'i18n-iso-countries/langs/zh.json';
import countriesGeo from 'world-countries';

countriesLib.registerLocale(zh as any);

export function getCountryNameZh(code: string): string {
	try {
		const upper = (code || '').toUpperCase();
		const name = countriesLib.getName(upper, 'zh');
		return name || upper;
	} catch {
		return code;
	}
}

export function getCountryCentroid(code: string): [number, number] {
	try {
		const upper = (code || '').toUpperCase();
		const feature: any = (countriesGeo as any[]).find((c) => c.cca2 === upper);
		const latlng = feature?.latlng as [number, number] | undefined;
		if (latlng && latlng.length === 2) {
			const [lat, lng] = latlng;
			return [lng, lat];
		}
	} catch {}
	return [0, 0];
}


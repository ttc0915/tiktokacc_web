import { defineConfig } from 'vite';
import path from 'path';

export default defineConfig(({ mode }) => ({
	base: mode === 'production' ? '/tiktokacc_web/' : '/',
	server: {
		host: '0.0.0.0', // 支持局域网访问
		port: 5173,
		open: true
	},
	build: {
		sourcemap: true
	},
	resolve: {
		alias: {
			'@': path.resolve(__dirname, 'src')
		}
	}
}));


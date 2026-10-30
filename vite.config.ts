import { sveltekit } from '@sveltejs/kit/vite';
import tailwindcss from '@tailwindcss/vite';
import basicSsl from '@vitejs/plugin-basic-ssl';
import path from 'path';
import { existsSync, readFileSync } from 'node:fs';
import { defineConfig } from 'vite';

export default defineConfig({
	server: {
		https:
			existsSync('.certs/dev.pem') && existsSync('.certs/dev-key.pem')
				? {
						cert: readFileSync('.certs/dev.pem'),
						key: readFileSync('.certs/dev-key.pem')
					}
				: undefined,
		proxy: {
			'/mirror-pair': { target: 'http://127.0.0.1:3000' },
			'/mirror-ws': { target: 'ws://127.0.0.1:3000', ws: true }
		}
	},
	plugins: [
		...(existsSync('.certs/dev.pem') && existsSync('.certs/dev-key.pem')
			? []
			: [
					{
						...basicSsl({ name: 'manar-dev', certDir: '.certs/basic-ssl' }),
						apply: 'serve' as const
					}
				]),
		tailwindcss(),
		sveltekit()
	],
	resolve: {
		alias: {
			$lib: path.resolve('./src/lib')
		}
	}
});

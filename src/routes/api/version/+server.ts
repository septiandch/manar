import { json } from '@sveltejs/kit';
import { readFile } from 'node:fs/promises';
export async function GET() {
	const version = await readFile('.release-commit', 'utf8')
		.then((v) => v.trim())
		.catch(() => null);
	return json({ version }, { headers: { 'Cache-Control': 'no-store' } });
}

import { TIMED_PRAYERS, IQAMAH_PRAYERS } from '$lib/types/config';
import { json } from '@sveltejs/kit';
import fs from 'fs/promises';
import path from 'path';
import { _notify } from '../events/+server';
import type { RequestHandler } from './$types';

const DATA_DIR = path.resolve('data');
const UPLOAD_DIR = path.resolve('static/uploads');
const CONFIG_FILE = path.join(DATA_DIR, 'config.json');
const ALLOWED_LOGO_EXT = /^\.(jpg|jpeg|png|webp|svg)$/i;
const MAX_LOGO_SIZE = 5 * 1024 * 1024;

async function ensureDirs() {
	await fs.mkdir(DATA_DIR, { recursive: true });
	await fs.mkdir(UPLOAD_DIR, { recursive: true });
}

function isNumeric(value: any): boolean {
	if (typeof value === 'string') {
		return /^-?\d+(\.\d+)?$/.test(value);
	} else {
		return false;
	}
}

/* ───────────── GET CONFIG ───────────── */
export const GET: RequestHandler = async () => {
	try {
		const data = await fs.readFile(CONFIG_FILE, 'utf-8');
		return json(JSON.parse(data));
	} catch {
		return json(null);
	}
};

/* ───────────── SAVE CONFIG ───────────── */
export const POST: RequestHandler = async ({ request }) => {
	await ensureDirs();

	const form = await request.formData();
	const data: Record<string, any> = {};
	// Validate overrides before any file writes. Old configs may omit these fields.
	const timingKeys = [
		...TIMED_PRAYERS.map((prayer) => ({ key: `adjustment${prayer}`, min: -180 })),
		...IQAMAH_PRAYERS.map((prayer) => ({ key: `iqamah${prayer}`, min: 0 }))
	];
	for (const { key, min } of timingKeys) {
		if (!form.has(key)) continue;
		const raw = form.get(key);
		const value = typeof raw === 'string' && raw.trim() !== '' ? Number(raw) : NaN;
		if (!Number.isInteger(value) || value < min || value > 180) {
			return json(
				{ error: `${key} must be a whole number between ${min} and 180 minutes.` },
				{ status: 400 }
			);
		}
		form.set(key, String(value));
	}

	// ───── Load existing config ─────
	let existing: any = {};
	try {
		const raw = await fs.readFile(CONFIG_FILE, 'utf-8');
		existing = JSON.parse(raw);
	} catch {}

	for (const [key, value] of form.entries()) {
		// ───── Handle File ─────
		if (value instanceof File) {
			// If no file uploaded, keep existing value
			if (value.size === 0) {
				data[key] = existing[key] ?? null;
				continue;
			}

			const ext = path.extname(value.name);
			if (key !== 'logo' || !ALLOWED_LOGO_EXT.test(ext) || value.size > MAX_LOGO_SIZE) {
				return json({ error: 'Invalid logo file' }, { status: 400 });
			}

			const fileName = `logo${ext.toLowerCase()}`;
			const filePath = path.join(UPLOAD_DIR, fileName);

			const buffer = Buffer.from(await value.arrayBuffer());
			await fs.writeFile(filePath, buffer);

			data[key] = `/uploads/${fileName}`;
		}
		// ───── Handle Text ─────
		else if (typeof value === 'string') {
			data[key] = isNumeric(value) ? Number(value) : value;
		}
	}

	const payload = {
		...existing,
		...data,
		updatedAt: new Date().toISOString()
	};

	await fs.writeFile(CONFIG_FILE, JSON.stringify(payload, null, 2));

	_notify();

	return json({ success: true, data: payload });
};

/**
 * @module date-util
 * Parse common EXIF date/time formats into epoch seconds (UTC).
 *
 * Recognized:
 * - "YYYY:MM:DD hh:mm:ss" (EXIF spec)
 * - "YYYY-MM-DDThh:mm:ssZ" or with ±hh:mm offsets
 *
 * Returns `undefined` when input can't be parsed.
 */

/**
 * @description Parses an EXIF date string into epoch seconds.
 * @param {string} input - The EXIF date string to parse.
 * @return {number | undefined} The epoch seconds if parsing is successful, otherwise undefined.
 */
export function parseExifDateToEpochSeconds(input: string): number | undefined {
	if (!input) {
		return undefined;
	}

	const spec = /^(\d{4}):(\d{2}):(\d{2}) (\d{2}):(\d{2}):(\d{2})$/;
	const m1 = spec.exec(input);

	if (m1) {
		const y = Number(m1[1]),
			mo = Number(m1[2]),
			d = Number(m1[3]);
		const h = Number(m1[4]),
			mi = Number(m1[5]),
			s = Number(m1[6]);
		const ms = Date.UTC(y, mo - 1, d, h, mi, s, 0);
		return Math.floor(ms / 1000);
	}

	const iso =
		/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(Z|([+-])(\d{2}):?(\d{2}))$/;

	const m2 = iso.exec(input);

	if (m2) {
		const y = Number(m2[1]),
			mo = Number(m2[2]),
			d = Number(m2[3]);
		const h = Number(m2[4]),
			mi = Number(m2[5]),
			s = Number(m2[6]);
		const isZ = m2[7] === "Z";
		const sign = m2[8] === "-" ? -1 : 1;
		const offH = Number(m2[9] || 0),
			offM = Number(m2[10] || 0);
		let sec = Date.UTC(y, mo - 1, d, h, mi, s) / 1000;
		if (!isZ) sec -= sign * (offH * 3600 + offM * 60);
		return sec;
	}

	const t = Date.parse(input);

	if (!Number.isNaN(t)) {
		return Math.floor(t / 1000);
	}

	return undefined;
}

import { ENDING_DEX_KEY } from './constants.js';
import { BADGE_MAP } from './ui.js';

export function saveEndingClear (ending, playerName) {
	if (!ending?.ending_id) return;
	const badge = BADGE_MAP[ending.ending_id] || { cls: 'normal', text: ending.title || '' };
	const stats  = ending.stats || {};
	const record = {
		ending_id:       ending.ending_id,
		title:           ending.title  || '',
		badge_cls:       badge.cls,
		badge_text:      badge.text,
		final_affinity:  ending.final_affinity ?? null,
		stats: {
			total_chats:       stats.total_chats       ?? null,
			max_affinity:      stats.max_affinity       ?? null,
			min_affinity:      stats.min_affinity       ?? null,
			events_triggered:  Array.isArray (stats.events_triggered) ? stats.events_triggered : []
		},
		player_name: playerName || '플레이어',
		cleared_at:  new Date ().toISOString ()
	};
	const dex = getEndingDex ();
	dex[ending.ending_id] = record;
	try {
		localStorage.setItem (ENDING_DEX_KEY, JSON.stringify (dex));
	} catch (e) {
		console.warn ('[ending-dex] localStorage write 실패:', e);
	}
}

export function getEndingDex () {
	try {
		const raw = localStorage.getItem (ENDING_DEX_KEY);
		return raw ? JSON.parse (raw) : {};
	} catch (e) {
		return {};
	}
}

export function isEndingUnlocked (ending_id) {
	return Object.prototype.hasOwnProperty.call (getEndingDex (), ending_id);
}

export function clearEndingDex () {
	try { localStorage.removeItem (ENDING_DEX_KEY); } catch (e) {}
}

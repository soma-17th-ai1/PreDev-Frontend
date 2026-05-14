import { monogatari } from './engine.js';
import { fetchSessionMe } from './api.js';
import { hasLocalAutoSave } from './save.js';
import { handleNewGame, handleResume, handleSomaQuit, handleDevStart } from './game-flow.js';
import { promptAffinityInput } from './ui.js';
import { API_BASE, ENDING_META, SCENE_LABEL, EVENT_LABELS, escapeDialogText, sceneUrl } from './constants.js';
import { getEndingDex } from './ending-dex.js';
import { BADGE_MAP } from './ui.js';

monogatari.registerListener ('soma-new', {
	callback: function () {
		console.debug ('[soma-new] click → handleNewGame()');
		handleNewGame ();
		return true;
	}
});
monogatari.registerListener ('soma-resume', {
	callback: function () {
		console.debug ('[soma-resume] click → handleResume()');
		handleResume ();
		return true;
	}
});
monogatari.registerListener ('soma-quit', {
	callback: function () {
		console.debug ('[soma-quit] click → handleSomaQuit()');
		handleSomaQuit ();
		return true;
	}
});

const MainMenu = monogatari.component ('main-menu');

class SomaMainMenu extends MainMenu {
	render () {
		return `
			<div data-ui="main-brand" aria-hidden="true">
				<span data-ui="main-kicker">SOMA x First Love</span>
                <strong data-ui="main-title">커널을 좋아하는<br>옆자리의 그녀</strong>
			</div>
			<div data-content="wrapper">
                <button type="button" data-action="soma-resume" data-soma-button="resume" hidden>이어 하기</button>
                <button type="button" data-action="soma-new"    data-soma-button="new">새 게임</button>
                <button type="button" data-action="open-screen" data-open="ending-list">엔딩 리스트</button>
                <button type="button" data-action="open-screen" data-open="help">도움말</button>
			</div>
		`;
	}

	async didMount () {
		console.debug ('[soma-menu] didMount — registering refresh');
		await this._refreshSomaMenu ();
	}

	async _refreshSomaMenu () {
		try {
			const [me, localHasSave] = await Promise.all ([fetchSessionMe (), hasLocalAutoSave ()]);
			const beReady   = !!(me?.has_session && me?.is_started !== false);
			const canResume = beReady || localHasSave;
			const resumeBtn = this.querySelector ('[data-soma-button="resume"]');
			const newBtn    = this.querySelector ('[data-soma-button="new"]');
			if (resumeBtn) resumeBtn.hidden = !canResume;
			if (newBtn)    newBtn.textContent = canResume ? '새 게임 (이전 진행 삭제)' : '새 게임';
		} catch (e) {}
	}
}
SomaMainMenu.tag = 'main-menu';
monogatari.registerComponent (SomaMainMenu);

const SettingsScreen = monogatari.component ('settings-screen');
class SomaSettingsScreen extends SettingsScreen {
	render () {
		return `
			<div class="row row--center padded settings-quit-row">
				<button type="button" data-action="soma-quit" class="settings-quit-btn">메인 메뉴로</button>
			</div>
		`;
	}
}
SomaSettingsScreen.tag = 'settings-screen';
monogatari.registerComponent (SomaSettingsScreen);

// 개발용 단축키: 메인 화면에서 Ctrl+Shift+D → LLMChatInit 즉시 진입
document.addEventListener ('keydown', function (e) {
	if (!e.ctrlKey || !e.shiftKey || e.key !== 'D') return;
	if (document.body.classList.contains ('game-active')) return;
	e.preventDefault ();
	console.debug ('[dev-key] Ctrl+Shift+D → handleDevStart()');
	handleDevStart ();
});

// 인게임 확인용 단축키: Ctrl+Y → 호감도 입력 → API로 엔딩 점프
document.addEventListener ('keydown', async function (e) {
	if (!e.ctrlKey || e.shiftKey || e.altKey || (e.key !== 'y' && e.key !== 'Y')) return;
	if (!document.body.classList.contains ('game-active')) return;
	e.preventDefault ();
	const affinity = await promptAffinityInput ();
	if (affinity === null || isNaN (affinity)) return;
	let data;
	try {
		const res = await fetch (`${API_BASE}/dev/force-ending`, {
			method: 'POST',
			credentials: 'include',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify ({ affinity }),
		});
		if (!res.ok) { console.warn ('[dev-key] force-ending API 실패:', res.status); return; }
		const json = await res.json ();
		data = json?.data;
	} catch (err) {
		console.warn ('[dev-key] force-ending 요청 오류:', err);
		return;
	}
	const sceneId = data?.ending_scene;
	if (!sceneId) { console.warn ('[dev-key] ending_scene 없음:', data); return; }
	console.debug ('[dev-key] Ctrl+Y → ' + sceneId + ' (affinity=' + affinity + ')');
	const game = monogatari.storage ('game') || {};
	monogatari.storage ({ game: Object.assign ({}, game, { current_scene_id: sceneId }) });
	monogatari.state ({ label: 'Ending', step: -1 });
	try { monogatari.proceed ({ userInitiated: false, skip: false, autoPlay: false }); }
	catch (err) { console.warn ('[dev-key] proceed 실패:', err); }
});

export function refreshSomaMainMenu () {
	document.querySelectorAll ('main-menu').forEach (el => {
		if (typeof el._refreshSomaMenu === 'function') el._refreshSomaMenu ();
	});
}

// ─── 자물쇠 SVG ──────────────────────────────────────────────────────────────
const LOCK_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" class="ending-dex__lock-icon"><path d="M18 10V7A6 6 0 0 0 6 7v3H4v12h16V10h-2ZM8 7a4 4 0 0 1 8 0v3H8V7Zm4 9a2 2 0 1 1 0-4 2 2 0 0 1 0 4Z"/></svg>`;

// ─── 엔딩 리스트 라이트박스 ────────────────────────────────────────────────────
function openDexLightbox (src, caption) {
	const backdrop = document.createElement ('div');
	backdrop.className = 'ending-dex__lightbox';
	backdrop.innerHTML = `
		<div class="ending-dex__lightbox-inner">
			<img class="ending-dex__lightbox-img" src="${src}" alt="${escapeDialogText (caption)}">
			<p class="ending-dex__lightbox-caption">${escapeDialogText (caption)}</p>
			<button class="ending-dex__lightbox-close" aria-label="닫기">✕</button>
		</div>
	`;
	document.body.appendChild (backdrop);
	requestAnimationFrame (() => backdrop.classList.add ('ending-dex__lightbox--visible'));

	const close = () => {
		backdrop.classList.remove ('ending-dex__lightbox--visible');
		setTimeout (() => { if (backdrop.parentNode) backdrop.parentNode.removeChild (backdrop); }, 300);
		document.removeEventListener ('keydown', onKey);
	};
	const onKey = (e) => { if (e.key === 'Escape') close (); };
	backdrop.addEventListener ('click', (e) => { if (e.target === backdrop) close (); });
	backdrop.querySelector ('.ending-dex__lightbox-close').addEventListener ('click', close);
	document.addEventListener ('keydown', onKey);
}

// ─── 엔딩 상세 오버레이 (카드 클릭 시) ─────────────────────────────────────────
function openEndingDetail (record) {
	const meta  = ENDING_META[record.ending_id] || { scenes: [] };
	const stats = record.stats || {};
	const badge = BADGE_MAP[record.ending_id] || { cls: 'normal', text: record.badge_text || '' };

	const eventTexts = (stats.events_triggered || [])
		.map (id => EVENT_LABELS[id]?.text)
		.filter (Boolean);
	const eventsHtml = eventTexts.length
		? `<div class="ending-dex__detail-events">${eventTexts.map (t => `<span class="ending-dex__event-chip">${escapeDialogText (t)}</span>`).join ('')}</div>`
		: '';

	const imagesHtml = meta.scenes.map (sceneKey => {
		const url     = sceneUrl (sceneKey);
		const caption = SCENE_LABEL[sceneKey] || sceneKey;
		return url
			? `<img class="ending-dex__detail-thumb" src="${url}" alt="${escapeDialogText (caption)}" data-src="${url}" data-caption="${escapeDialogText (caption)}" tabindex="0">`
			: '';
	}).join ('');

	const clearedAt = record.cleared_at
		? new Date (record.cleared_at).toLocaleString ('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
		: '???';

	const affinityClass = typeof record.final_affinity === 'number'
		? (record.final_affinity >= 1 ? ' end-credits__stat-value--pos' : record.final_affinity < 0 ? ' end-credits__stat-value--neg' : '')
		: '';

	const backdrop = document.createElement ('div');
	backdrop.className = 'ending-dex__detail-backdrop';
	backdrop.innerHTML = `
		<div class="ending-dex__detail">
			<button class="ending-dex__detail-close" aria-label="닫기">✕</button>
			<div class="ending-dex__detail-badge ending-dex__card-badge--${badge.cls}">${badge.text}</div>
			<h3 class="ending-dex__detail-title">${escapeDialogText (record.player_name)}의 이야기</h3>
			<p class="ending-dex__detail-date">${clearedAt} 클리어</p>
			<div class="ending-dex__detail-stats">
				<div class="ending-dex__detail-stat"><span class="ending-dex__stat-label">최종 호감도</span><span class="ending-dex__stat-value${affinityClass}">${record.final_affinity ?? '?'}</span></div>
				<div class="ending-dex__detail-stat"><span class="ending-dex__stat-label">총 대화 횟수</span><span class="ending-dex__stat-value">${stats.total_chats ?? '?'}회</span></div>
				<div class="ending-dex__detail-stat"><span class="ending-dex__stat-label">최고 호감도</span><span class="ending-dex__stat-value">${stats.max_affinity ?? '?'}</span></div>
				<div class="ending-dex__detail-stat"><span class="ending-dex__stat-label">최저 호감도</span><span class="ending-dex__stat-value">${stats.min_affinity ?? '?'}</span></div>
			</div>
			${eventsHtml}
			${imagesHtml ? `<div class="ending-dex__detail-images">${imagesHtml}</div>` : ''}
		</div>
	`;
	document.body.appendChild (backdrop);
	requestAnimationFrame (() => backdrop.classList.add ('ending-dex__detail-backdrop--visible'));

	const close = () => {
		backdrop.classList.remove ('ending-dex__detail-backdrop--visible');
		setTimeout (() => { if (backdrop.parentNode) backdrop.parentNode.removeChild (backdrop); }, 300);
		document.removeEventListener ('keydown', onKey);
	};
	const onKey = (e) => { if (e.key === 'Escape') close (); };
	backdrop.addEventListener ('click', (e) => { if (e.target === backdrop) close (); });
	backdrop.querySelector ('.ending-dex__detail-close').addEventListener ('click', close);
	backdrop.querySelectorAll ('.ending-dex__detail-thumb').forEach (img => {
		img.addEventListener ('click', () => openDexLightbox (img.dataset.src, img.dataset.caption));
		img.addEventListener ('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') openDexLightbox (img.dataset.src, img.dataset.caption); });
	});
	document.addEventListener ('keydown', onKey);
}

// ─── SomaEndingListScreen ────────────────────────────────────────────────────
const CreditsScreen = monogatari.component ('credits-screen');

class SomaEndingListScreen extends CreditsScreen {
	_buildContent () {
		const dex      = getEndingDex ();
		const endingIds = Object.keys (ENDING_META).sort ((a, b) => ENDING_META[a].order - ENDING_META[b].order);

		// (a) 카드 그리드
		const cardsHtml = endingIds.map (id => {
			const record  = dex[id];
			const unlocked = !!record;
			const badge    = BADGE_MAP[id] || { cls: 'normal', text: '???' };
			if (unlocked) {
				const clearedAt = new Date (record.cleared_at).toLocaleString ('ko-KR', {
					year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit'
				});
				const affinityClass = typeof record.final_affinity === 'number'
					? (record.final_affinity >= 1 ? ' ending-dex__card-affinity--pos' : record.final_affinity < 0 ? ' ending-dex__card-affinity--neg' : '')
					: '';
				return `
					<button class="ending-dex__card ending-dex__card--${badge.cls}" data-ending-id="${id}" aria-label="${badge.text} 상세 보기">
						<span class="ending-dex__card-badge ending-dex__card-badge--${badge.cls}">${badge.text}</span>
						<span class="ending-dex__card-affinity${affinityClass}">호감도 ${record.final_affinity ?? '?'}</span>
						<span class="ending-dex__card-date">${clearedAt}</span>
					</button>`;
			} else {
				return `
					<div class="ending-dex__card ending-dex__card--locked" aria-label="미해금 엔딩">
						${LOCK_SVG}
						<span class="ending-dex__card-badge ending-dex__card-badge--locked">???</span>
					</div>`;
			}
		}).join ('');

		// (b) 이미지 컬렉션 (모든 scenes 평탄화)
		const allImages = endingIds.flatMap (id => {
			const unlocked = !!dex[id];
			return ENDING_META[id].scenes.map (sceneKey => ({ id, sceneKey, unlocked }));
		});
		const imagesHtml = allImages.map (({ id, sceneKey, unlocked }) => {
			const caption = SCENE_LABEL[sceneKey] || sceneKey;
			if (unlocked) {
				const url = sceneUrl (sceneKey);
				return url
					? `<button class="ending-dex__image" data-src="${url}" data-caption="${escapeDialogText (caption)}" aria-label="${escapeDialogText (caption)} 원본 보기">
							<img src="${url}" alt="${escapeDialogText (caption)}" loading="lazy">
							<span class="ending-dex__image-caption">${escapeDialogText (caption)}</span>
						</button>`
					: '';
			} else {
				return `<div class="ending-dex__image ending-dex__image--locked" aria-label="미해금 이미지">
							${LOCK_SVG}
							<span class="ending-dex__image-caption">???</span>
						</div>`;
			}
		}).join ('');

		return `
			<div class="ending-dex__header">
				<h2 class="ending-dex__title">엔딩 리스트</h2>
				<p class="ending-dex__subtitle">${Object.keys (dex).length} / ${endingIds.length} 해금</p>
			</div>
			<div class="ending-dex__section">
				<h3 class="ending-dex__section-title">엔딩 기록</h3>
				<div class="ending-dex__cards">${cardsHtml}</div>
			</div>
			<div class="ending-dex__section">
				<h3 class="ending-dex__section-title">이미지 컬렉션</h3>
				<div class="ending-dex__images">${imagesHtml}</div>
			</div>
			<div class="ending-dex__footer">
				<button type="button" data-action="open-screen" data-open="main" class="ending-dex__back-btn">메인 메뉴로</button>
			</div>
		`;
	}

	render () {
		return `<div class="ending-dex__scroll">${this._buildContent ()}</div>`;
	}

	_refreshContent () {
		const scroll = this.querySelector ('.ending-dex__scroll');
		if (!scroll) return;
		scroll.innerHTML = this._buildContent ();

		this.querySelectorAll ('.ending-dex__card[data-ending-id]').forEach (btn => {
			btn.addEventListener ('click', () => {
				const dex = getEndingDex ();
				const record = dex[btn.dataset.endingId];
				if (record) openEndingDetail (record);
			});
		});

		this.querySelectorAll ('.ending-dex__image[data-src]').forEach (btn => {
			btn.addEventListener ('click', () => {
				openDexLightbox (btn.dataset.src, btn.dataset.caption);
			});
		});
	}

	didMount () {
		this._refreshContent ();
		document.addEventListener ('soma:refresh-ending-list', () => this._refreshContent ());
		return super.didMount ();
	}
}

SomaEndingListScreen.tag = 'ending-list-screen';
monogatari.registerComponent (SomaEndingListScreen);

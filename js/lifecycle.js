import { installScriptAutoSaveHook } from './save.js';
import { cleanupCustomUI, handleSomaQuit } from './game-flow.js';
import { isLogViewerOpen, closeLogViewer } from './ui.js';
import { refreshSomaMainMenu } from './menu.js';
import { bgm } from './audio.js';
import { isEndingUnlocked } from './ending-dex.js';

function _syncDistractionFree () {
	const monogatari = window.Monogatari?.default;
	const isHidden = !!(monogatari?.global?.('distraction_free'));
	if (document.body) document.body.classList.toggle ('distraction-free', isHidden);
}

function _installLifecycleHooks () {
	if (!document.body) return;
	installScriptAutoSaveHook ();

	// soma:refresh-menu 커스텀 이벤트 — game-flow 가 순환 dep 없이 menu 갱신 요청할 때 사용.
	document.addEventListener ('soma:refresh-menu', () => refreshSomaMainMenu ());

	document.addEventListener ('click', (e) => {
		const path = e.composedPath ? e.composedPath () : [];
		const hit = path.some (el => el?.getAttribute?.('data-action') === 'distraction-free')
			|| !!e.target?.closest?.('[data-action="distraction-free"]');
		if (hit) {
			setTimeout (_syncDistractionFree, 0);
		}
	}, true);
	document.addEventListener ('keydown', (e) => {
		if (e.key === 'h' || e.key === 'H') {
			if (e.target?.matches?.('input, textarea, select')) return;
			setTimeout (_syncDistractionFree, 0);
		}
	});

	// ESC 키 → 세팅이 아닌 confirmQuit 모달. 캡처 페이즈로 Monogatari 보다 먼저 처리.
	document.addEventListener ('keydown', (e) => {
		if (e.key !== 'Escape') return;
		if (!document.body.classList.contains ('game-active')) return;
		e.preventDefault ();
		e.stopImmediatePropagation ();
		if (isLogViewerOpen ()) {
			closeLogViewer ();
			return;
		}
		const modal = document.querySelector ('.confirm-modal--visible');
		if (modal) {
			modal.querySelector ('.confirm-modal__btn--cancel')?.click ();
			return;
		}
		handleSomaQuit ();
	}, true);

	if (typeof MutationObserver === 'undefined') return;
	let _mainScreenWasVisible = false;
	let _gameWasActive        = false;
	const observer = new MutationObserver (() => {
		const mainScreen = document.querySelector ('[data-screen="main"]');
		const gameScreen = document.querySelector ('[data-screen="game"]');
		if (!mainScreen || !gameScreen) return;
		const mainNowVisible = mainScreen.offsetParent !== null;
		const gameNowVisible = gameScreen.offsetParent !== null;
		const gameNowActive  = document.body.classList.contains ('game-active');
		if (mainNowVisible && !gameNowVisible && gameNowActive) {
			cleanupCustomUI ();
		}
		if (mainNowVisible && !_mainScreenWasVisible) {
			bgm (isEndingUnlocked ('ENDING_MARRIAGE') ? 'marr' : 'menu');
			refreshSomaMainMenu ();
		}
		// game-active 클래스 추가(상승 엣지)만 감지 — classList.add 멱등성으로 중복 발화 없음.
		if (gameNowActive && !_gameWasActive) {
			bgm (null);
		}
		_mainScreenWasVisible = mainNowVisible;
		_gameWasActive        = gameNowActive;
	});
	observer.observe (document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['class', 'open', 'data-screen'] });

	const mainScreenEl = document.querySelector ('[data-screen="main"]');
	if (mainScreenEl) {
		let wasActive = mainScreenEl.classList.contains ('active');
		const focusedObs = new MutationObserver (() => {
			const isActive = mainScreenEl.classList.contains ('active');
			if (isActive && !wasActive) refreshSomaMainMenu ();
			wasActive = isActive;
		});
		focusedObs.observe (mainScreenEl, { attributes: true, attributeFilter: ['class'] });
	}
}

export function ensureMainBtn () {
	if (document.getElementById ('soma-main-btn')) return;
	const quickMenu = document.querySelector ('quick-menu');
	if (!quickMenu) return;
	const btn = document.createElement ('button');
	btn.id = 'soma-main-btn';
	btn.type = 'button';
	btn.setAttribute ('aria-label', '메인 메뉴로');
	btn.innerHTML = '<span class="fas fa-home"></span><span data-string>Main</span>';
	btn.addEventListener ('click', (e) => {
		e.preventDefault ();
		e.stopPropagation ();
		handleSomaQuit ();
	});
	const hideBtn = quickMenu.querySelector ('[data-action="distraction-free"]');
	if (hideBtn) hideBtn.insertAdjacentElement ('afterend', btn);
	else quickMenu.appendChild (btn);
}

if (document.readyState === 'loading') {
	document.addEventListener ('DOMContentLoaded', _installLifecycleHooks, { once: true });
} else {
	_installLifecycleHooks ();
}

// textarea Enter → submit (LLM 입력창)
document.addEventListener ('keydown', function (e) {
	if (!e.target.matches?.('.llm-input textarea')) return;
	if (e.key !== 'Enter' || e.shiftKey) return;
	if (e.isComposing || e.keyCode === 229) return;
	e.preventDefault ();
	const form = e.target.closest ('text-input');
	if (form) {
		const btn = form.querySelector ('button');
		if (btn) btn.click ();
	}
});

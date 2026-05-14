// 다중 트랙 BGM 컨트롤러.
// 트랙별로 별도 HTMLAudioElement 를 유지하므로 동시 재생/독립 정지 가능.
// 브라우저 autoplay 정책으로 play() 가 거절되면 첫 user gesture 까지 대기 후 재시도.

import { isEndingUnlocked } from './ending-dex.js';

const SRC = {
	menu:      'assets/sounds/default.mp3',
	gwanganli: 'assets/sounds/gwanganli.mp3',
	marr:      'assets/sounds/marr.mp3',
};

const _els     = {};
const _desired = {};
const _pending = {};

function ensure (key) {
	if (_els[key]) return _els[key];
	const a = new Audio (SRC[key]);
	a.loop   = true;
	a.volume = 0.5;
	_els[key] = a;
	return a;
}

function attempt (key) {
	if (!_desired[key]) return;
	const a = ensure (key);
	const p = a.play ();
	if (p && typeof p.catch === 'function') {
		p.catch (() => {
			if (_pending[key]) return;
			_pending[key] = true;
			const onGesture = () => {
				document.removeEventListener ('pointerdown', onGesture, true);
				document.removeEventListener ('keydown',     onGesture, true);
				_pending[key] = false;
				if (_desired[key]) attempt (key);
			};
			document.addEventListener ('pointerdown', onGesture, true);
			document.addEventListener ('keydown',     onGesture, true);
		});
	}
}

export function playBgm (key = 'menu') {
	if (!SRC[key]) { console.warn ('[audio] unknown bgm key:', key); return; }
	_desired[key] = true;
	attempt (key);
}

// 메인 메뉴용 — 결혼 엔딩 해금 상태면 marr.mp3, 아니면 default.mp3.
// 다른 트랙(gwanganli 등)이 잔여 재생 중일 수 있으니 모두 정지 후 선택 트랙만 재생.
export function playMenuBgm () {
	const key = isEndingUnlocked ('ENDING_MARRIAGE') ? 'marr' : 'menu';
	Object.keys (SRC).forEach (k => { if (k !== key) stopBgm (k); });
	playBgm (key);
}

// 키 생략 시 모든 트랙 정지.
export function stopBgm (key) {
	if (key) {
		_desired[key] = false;
		const a = _els[key];
		if (!a) return;
		try { a.pause (); } catch (e) {}
		try { a.currentTime = 0; } catch (e) {}
		return;
	}
	Object.keys (SRC).forEach (k => stopBgm (k));
}

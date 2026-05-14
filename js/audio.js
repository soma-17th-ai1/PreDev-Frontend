// 단일 트랙 BGM 매니저.
// bgm(key) 로 트랙 전환, bgm(null) 로 정지.
// 전환·정지 시 이전 트랙은 rAF 타임스탬프 기반 페이드 아웃 (FADE_MS).

const SRC = {
	menu:      'assets/sounds/default.mp3',
	gwanganli: 'assets/sounds/gwanganli.mp3',
	marr:      'assets/sounds/marr.mp3',
};

const FADE_MS = 800;
const VOLUME  = 0.7;

let _player     = null;  // 현재 재생 중인 Audio
let _fadingOut  = null;  // 페이드 중인 Audio — 동시 재생 방지용
let _currentKey = null;
let _rafId      = null;

function _cancelFade () {
	if (_rafId !== null) { cancelAnimationFrame (_rafId); _rafId = null; }
	if (_fadingOut) { _fadingOut.pause (); _fadingOut.currentTime = 0; _fadingOut = null; }
}

function _fadeOut (audio, onDone) {
	_fadingOut     = audio;
	const startVol = audio.volume;
	const start    = performance.now ();

	function tick (now) {
		const t = Math.min ((now - start) / FADE_MS, 1);
		audio.volume = startVol * (1 - t);
		if (t < 1) {
			_rafId = requestAnimationFrame (tick);
		} else {
			_rafId     = null;
			_fadingOut = null;
			audio.pause ();
			audio.currentTime = 0;
			onDone?.();
		}
	}
	_rafId = requestAnimationFrame (tick);
}

function _play (key) {
	const a = new Audio (SRC[key]);
	a.loop   = true;
	a.volume = VOLUME;
	_player  = a;

	const p = a.play ();
	if (p?.catch) {
		p.catch (() => {
			// 브라우저 autoplay 정책 거절 → 첫 user gesture 대기 후 재시도.
			const retry = () => {
				document.removeEventListener ('pointerdown', retry, true);
				document.removeEventListener ('keydown',     retry, true);
				if (_currentKey === key) a.play ().catch (() => {});
			};
			document.addEventListener ('pointerdown', retry, true);
			document.addEventListener ('keydown',     retry, true);
		});
	}
}

export function bgm (key = null) {
	if (key === _currentKey) return;

	const old   = _player;
	_currentKey = key;
	_player     = null;

	_cancelFade ();

	if (old) {
		_fadeOut (old, key ? () => { if (_currentKey === key) _play (key); } : null);
	} else if (key) {
		_play (key);
	}
}

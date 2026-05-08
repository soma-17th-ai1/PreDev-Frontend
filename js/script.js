
monogatari.action ('message').messages ({
	'Help': {
		title: 'Help',
		subtitle: 'Some useful Links',
		body: `
			<p><a href='https://developers.monogatari.io/documentation/'>Documentation</a> - Everything you need to know.</p>
			<p><a href='https://monogatari.io/demo/'>Demo</a> - A simple Demo.</p>
		`
	}
});

monogatari.action ('notification').notifications ({
	'Welcome': {
		title: 'Welcome',
		body: 'This is the Monogatari VN Engine',
		icon: ''
	}
});

monogatari.action ('particles').particles ({

});

monogatari.action ('canvas').objects ({

});

monogatari.configuration ('credits', {

});

monogatari.assets ('gallery', {
	'sera_first': '\uc774\uc138\ub77c \uccab\ub4f1\uc7a5.png'
});

monogatari.assets ('music', {

});

monogatari.assets ('voices', {

});

monogatari.assets ('sounds', {

});

monogatari.assets ('videos', {

});

monogatari.assets ('images', {
	'sera_first': '\uc774\uc138\ub77c \uccab\ub4f1\uc7a5.png'
});

monogatari.assets ('scenes', {
	'blank_white':     'blank_white.svg',
	'fade_black':      'fade_black.svg',
	'bedroom_dawn':    'bedroom_dawn.svg',
	'apartment_door':  'apartment_door.svg',
	'train_interior':  'train_interior.svg',
	'posttower_lobby': 'entrance.png',
	'elevator_panel':  'entrance.png',
	'center_hall':     'entrance.png',
	's1_room':         'entrance.png'
});

monogatari.characters ({
	'p': {
		name: '{{player.name}}',
		color: '#8ad8ff'
	},
	'y': {
		name: '{{sera.name}}',
		color: '#ffb7d8',
		directory: '\uc774\uc138\ub77c_\ud45c\uc815/\uc774\uc138\ub77c_\ud45c\uc815',
		sprites: {
			calm: '\ud3c9\uc628.png',
			happy: '\ud589\ubcf5.png',
			shy: '\uc218\uc90d\uc74c.png',
			sad: '\uc2ac\ud514.png',
			angry: '\ud654\ub0a8.png',
			disgust: '\ud610\uc624.png',
			excited: '\ud765\ubd84(\uc88b\uc740\uc758\ubbf8).png'
		}
	}
});


monogatari.translation ('English', {
	'Send': 'Send',
	'Back': 'Back',
	'보내기': '보내기',
	'↑': '↑'
});

const API_BASE = 'http://127.0.0.1:8000/api/v1';

const SAVE_SLOT_PREFIX = 'SaveLabel';
const SAVE_SLOT_ID = 1;
const SAVE_SLOT_KEY = 'Save_1';
const SAVE_SLOT_NAME = 'In Progress';
const DIALOG_LOG_LIMIT = 120;
// 자동 저장 트리거 라벨 — Start/NewGame 빌드업 + LLMChat 채팅 모두 포함.
// LLMChat 을 빠뜨리면 채팅 도중 quit 시 마지막 저장이 빌드업 시점에 머물러 dialog-log 유실 등 발생.
const SCRIPT_AUTOSAVE_LABELS = new Set (['Start', 'NewGame', 'LLMChat']);
const CHAT_RESUME_LABELS = new Set (['LLMChat']);
const RESUME_SLOT_SAVE_DELAY_MS = 180;

function finiteNumber (value, fallback = 0) {
	if (typeof value === 'number' && Number.isFinite (value)) return value;
	if (typeof value === 'string' && value.trim () !== '') {
		const n = Number (value);
		if (Number.isFinite (n)) return n;
	}
	return fallback;
}

const SERA_SPRITE_MAP = {
	NEUTRAL:   'calm',
	HAPPY:     'happy',
	EXCITED:   'excited',
	SHY:       'shy',
	SAD:       'sad',
	ANGRY:     'angry',
	DISGUSTED: 'disgust',
	FURIOUS:   'angry'
};
const SERA_SPRITE_FILE = {
	calm:    '\ud3c9\uc628.png',
	happy:   '\ud589\ubcf5.png',
	excited: '\ud765\ubd84(\uc88b\uc740\uc758\ubbf8).png',
	shy:     '\uc218\uc90d\uc74c.png',
	sad:     '\uc2ac\ud514.png',
	angry:   '\ud654\ub0a8.png',
	disgust: '\ud610\uc624.png'
};
const SERA_FADE_MS = {
	NEUTRAL: 350, HAPPY: 450, EXCITED: 350, SHY: 400, SAD: 400,
	ANGRY: 180, DISGUSTED: 180, FURIOUS: 180
};

function spriteUrl (spriteKey) {
	const file = SERA_SPRITE_FILE[spriteKey] || SERA_SPRITE_FILE.calm;
	return `assets/characters/\uc774\uc138\ub77c_\ud45c\uc815/\uc774\uc138\ub77c_\ud45c\uc815/${encodeURI (file)}`;
}

// 빌드업 배경은 더 이상 setSceneBackground 인라인 그라데이션이 아니라 monogatari assets/scenes 의 SVG.
// script 안에서 'show scene <key> with fadeIn' 으로 호출하면 monogatari 가 state.scene 에 자동 트래킹 →
// loadFromSlot 의 onLoad 가 자동 복원. 별도 storage.visuals.bg 트래킹 불필요.
//
// scene key → SVG 파일 매핑은 monogatari.assets('scenes', {...}) 에 등록 (파일 상단).

function escapeDialogText (text) {
	return String (text)
		.replace (/&/g, '&amp;')
		.replace (/</g, '&lt;')
		.replace (/>/g, '&gt;')
		.replace (/"/g, '&quot;')
		.replace (/'/g, '&#039;')
		.replace (/\r?\n/g, '<br>');
}

// 배경은 monogatari 'show scene' 액션이 담당. 인라인 setSceneBackground 헬퍼는 더 이상 필요 없다 —
// state.scene 이 자동 트래킹돼 loadFromSlot 의 onLoad 가 마지막 'show scene' 을 자동 재적용한다.
// (이전 버전에서는 인라인 그라데이션을 썼는데 monogatari save/load 와 어긋나 resume 시 배경이 사라지는 문제가 있었음.)
// (또한 setSceneBackground 안에서 monogatari.run('show scene ...') 을 호출하면 default advance=true 가
//  script step 을 자동 진행시켜 Start[0] 도중 NewGame 으로 점프해버리는 race 도 있었음.)

let _introLogoEl = null;
function showIntroLogo () {
	return new Promise (async (resolve) => {
		if (_introLogoEl) {
			_introLogoEl.remove ();
			_introLogoEl = null;
		}
		document.body.classList.add ('intro-active');
		const overlay = document.createElement ('div');
		overlay.className = 'intro-logo';
		overlay.innerHTML = `
			<div class="intro-logo__inner">
				<img src="assets/logo/game_logo.jpeg" alt="커널을 좋아하는 옆자리의 그녀" />
				<div class="intro-logo__subtitle">Software Maestro &times; First Love</div>
			</div>
		`;
		document.body.appendChild (overlay);
		_introLogoEl = overlay;

		void overlay.offsetWidth;
		overlay.classList.add ('intro-logo--visible');
		await new Promise (r => setTimeout (r, 2500));
		await new Promise (r => setTimeout (r, 2000));
		overlay.classList.add ('intro-logo--leaving');
		await new Promise (r => setTimeout (r, 1500));
		if (overlay.parentNode) overlay.parentNode.removeChild (overlay);
		_introLogoEl = null;
		document.body.classList.remove ('intro-active');
		resolve ();
	});
}



let _seraCurrentSprite = null;
function updateSeraSprite (emotion) {
	const spriteKey = SERA_SPRITE_MAP[emotion] || 'calm';
	const savedCharEl = document.querySelector ('[data-character="y"]');
	const domSprite = savedCharEl?.getAttribute?.('data-sprite') || null;
	if (_seraCurrentSprite === spriteKey && domSprite !== spriteKey) _seraCurrentSprite = null;
	if (_seraCurrentSprite === spriteKey) return;
	_seraCurrentSprite = spriteKey;

	const charEl = document.querySelector ('[data-character="y"]');
	if (!charEl) return;

	const url = spriteUrl (spriteKey);
	const fadeMs = SERA_FADE_MS[emotion] ?? 350;

	const newImg = document.createElement ('img');
	newImg.src = url;
	newImg.alt = 'Sera';
	newImg.className = 'sera-sprite-fade-in';
	newImg.style.transition = `opacity ${fadeMs}ms ease`;

	if (charEl.tagName === 'IMG') {
		const parent = charEl.parentElement;
		if (!parent) return;
		newImg.setAttribute ('data-character', 'y');
		newImg.setAttribute ('data-sprite', spriteKey);
		newImg.style.cssText = charEl.style.cssText + `; opacity: 0; transition: opacity ${fadeMs}ms ease`;
		newImg.className = charEl.className;
		parent.insertBefore (newImg, charEl);
		requestAnimationFrame (() => {
			newImg.style.opacity = '1';
			charEl.style.opacity = '0';
			charEl.style.transition = `opacity ${fadeMs}ms ease`;
		});
		setTimeout (() => {
			if (charEl.parentNode) charEl.parentNode.removeChild (charEl);
		}, fadeMs + 50);
	} else {
		const oldImg = charEl.querySelector ('img');
		if (oldImg) oldImg.src = url;
		charEl.setAttribute ('data-sprite', spriteKey);
	}
}

function showThinkingDots () {
	const sayEl = document.querySelector ('[data-ui="say"]');
	if (!sayEl) return;
    sayEl.innerHTML = '<span class="thinking-dots" aria-label="Thinking"><i></i><i></i><i></i></span>';
}
function hideThinkingDots () {
	const sayEl = document.querySelector ('[data-ui="say"]');
	const dots = sayEl?.querySelector ('.thinking-dots');
	if (dots) sayEl.innerHTML = '';
}

function flashAffinityVignette (delta) {
	if (typeof delta !== 'number' || Math.abs (delta) < 5) return;
	const game = document.querySelector ('[data-screen="game"]') || document.body;
	const v = document.createElement ('div');
	v.className = 'affinity-vignette';
	if (delta >= 10)        v.dataset.tone = 'love';
	else if (delta >= 5)    v.dataset.tone = 'warm';
	else if (delta > -10)   v.dataset.tone = 'cool';
	else                    v.dataset.tone = 'severe';
	game.appendChild (v);
	if (delta <= -50) v.classList.add ('affinity-vignette--shake');
	requestAnimationFrame (() => v.classList.add ('affinity-vignette--visible'));
	setTimeout (() => v.classList.add ('affinity-vignette--leaving'), 600);
	setTimeout (() => { if (v.parentNode) v.parentNode.removeChild (v); }, 1300);
}

let _suggestionsStrip = null;
async function fetchAndRenderSuggestions () {
	clearSuggestions ();
	let suggestions = [];
	try {
		const res = await fetch (`${API_BASE}/chat/suggestions`, {
			method: 'GET',
			credentials: 'include'
		});
		if (res.ok) {
			const json = await res.json ();
			suggestions = json?.data?.suggestions || [];
		}
	} catch (e) {
	}
	if (suggestions.length === 0) return;
	renderSuggestionsStrip (suggestions);
}

function renderSuggestionsStrip (suggestions) {
	const game = document.querySelector ('[data-screen="game"]') || document.body;
	const strip = document.createElement ('div');
	strip.className = 'llm-suggestions';
	strip.innerHTML = '<div class="llm-suggestions__label">💡 이렇게 말해볼까요?</div>';
	const list = document.createElement ('div');
	list.className = 'llm-suggestions__list';
	suggestions.forEach (s => {
		const chip = document.createElement ('button');
		chip.type = 'button';
		chip.className = 'llm-suggestions__chip';
		chip.textContent = s;
		chip.addEventListener ('click', (ev) => {
			ev.preventDefault ();
			ev.stopPropagation ();
			const ta = document.querySelector ('text-input.llm-input textarea');
			if (ta) {
				ta.value = s;
				ta.dispatchEvent (new Event ('input', { bubbles: true }));
				ta.focus ();
			}
		});
		list.appendChild (chip);
	});
	const refresh = document.createElement ('button');
	refresh.type = 'button';
	refresh.className = 'llm-suggestions__refresh';
	refresh.title = 'Refresh suggestions';
	refresh.setAttribute ('aria-label', 'Refresh suggestions');
	refresh.textContent = 'R';
	refresh.addEventListener ('click', (ev) => {
		ev.preventDefault ();
		ev.stopPropagation ();
		fetchAndRenderSuggestions ();
	});
	list.appendChild (refresh);
	strip.appendChild (list);
	game.appendChild (strip);
	_suggestionsStrip = strip;
}

function clearSuggestions () {
	if (_suggestionsStrip && _suggestionsStrip.parentNode) {
		_suggestionsStrip.parentNode.removeChild (_suggestionsStrip);
	}
	_suggestionsStrip = null;
	document.querySelectorAll ('.llm-suggestions').forEach (n => n.remove ());
}

const EVENT_LABELS = {
	EVENT_LIKE_P30:  { sign: '+', text: 'Affinity 30' },
	EVENT_LIKE_P50:  { sign: '+', text: 'Affinity 50' },
	EVENT_LIKE_P70:  { sign: '+', text: 'Affinity 70' },
	EVENT_LIKE_P100: { sign: '+', text: 'Affinity 100' },
	EVENT_DISLIKE_M30: { sign: 'down', text: 'Affinity -30' },
	EVENT_DISLIKE_M50: { sign: 'down', text: 'Affinity -50' },
	EVENT_DISLIKE_M70: { sign: 'down', text: 'Affinity -70' }
};
function showEventToast (eventId) {
	const meta = EVENT_LABELS[eventId];
	if (!meta) return;
	const root = document.body;
	const toast = document.createElement ('div');
	toast.className = 'event-toast' + (meta.sign === '+' ? ' event-toast--like' : ' event-toast--dislike');
	toast.innerHTML = `<span class="event-toast__sign">${meta.sign}</span><span class="event-toast__body">${meta.text}</span>`;
	root.appendChild (toast);
	requestAnimationFrame (() => toast.classList.add ('event-toast--visible'));
	setTimeout (() => toast.classList.add ('event-toast--leaving'), 1900);
	setTimeout (() => { if (toast.parentNode) toast.parentNode.removeChild (toast); }, 2500);
}

async function fetchSceneIntroDialogues () {
	try {
		const res = await fetch (`${API_BASE}/scenes/current`, { credentials: 'include' });
		if (!res.ok) return null;
		const json = await res.json ();
		return json?.data || null;
	} catch (e) { return null; }
}

function typewriteAndAwait (text, opts = {}) {
	const sayEl = document.querySelector ('[data-ui="say"]');
	const whoEl = document.querySelector ('[data-ui="who"]');
	if (!sayEl) return Promise.resolve ();
	if (whoEl) whoEl.textContent = opts.who || '';
	sayEl.innerHTML = '';
	sayEl.classList.remove ('say--awaiting');

	return new Promise ((resolve) => {
		let i = 0;
		let skip = false;
		const onInteract = (e) => {
			if (e.type === 'keydown') {
				if (e.isComposing || e.keyCode === 229) return;
				if (!['Enter', ' ', 'ArrowRight'].includes (e.key)) return;
				if (e.target?.matches?.('textarea, input')) return;
				e.preventDefault ();
			}
			if (e.type === 'click' && e.target?.closest?.('text-input, button, select, input, textarea, .llm-suggestions')) return;
			if (i < text.length) {
				skip = true;
			} else {
				cleanup ();
				if (!opts.silentLog) {
					pushDialogLog ({
						id: opts.id || (opts.who ? 'y' : 'narrator'),
						name: opts.who || '',
						color: opts.color || (opts.who === 'Sera' ? '#ffb7d8' : '#fff'),
						dialog: escapeDialogText (text)
					});
				}
				resolve ();
			}
		};
		const cleanup = () => {
			document.removeEventListener ('click', onInteract);
			document.removeEventListener ('keydown', onInteract);
			sayEl.classList.remove ('say--awaiting');
		};
		document.addEventListener ('click', onInteract);
		document.addEventListener ('keydown', onInteract);

		(async () => {
			while (i < text.length) {
				const ch = text[i++];
				sayEl.innerHTML = escapeDialogText (text.slice (0, i));
				let dwell = 0;
				if (/[.!?]/.test (ch)) dwell = 70;
				else if (ch === ',' || ch === ';') dwell = 180;
				else if (/[, ]/.test (ch)) dwell = 35;
				if (!skip) await new Promise (r => setTimeout (r, 30 + dwell));
			}
			sayEl.classList.add ('say--awaiting');
		}) ();
	});
}

const _playedSceneIntros = new Set ();
async function playSceneIntroIfPending (storageRef) {
	const llm = storageRef.storage ('llm') || {};
	const game = storageRef.storage ('game') || {};
	const target = llm.next_scene_id;
	if (!target || /^SCENE_ENDING_/.test (target)) return;
	if (target === game.current_scene_id || _playedSceneIntros.has (target)) {
		storageRef.storage ({ llm: Object.assign ({}, llm, { next_scene_id: '' }) });
		return;
	}
	const meta = await fetchSceneIntroDialogues ();
	if (!meta || !Array.isArray (meta.intro_dialogues) || meta.intro_dialogues.length === 0) {
		storageRef.storage ({ llm: Object.assign ({}, llm, { next_scene_id: '' }) });
		return;
	}
	_playedSceneIntros.add (target);
	storageRef.storage ({
		game: Object.assign ({}, game, { current_scene_id: target }),
		llm: Object.assign ({}, llm, { next_scene_id: '' })
	});
	for (const d of meta.intro_dialogues) {
		if (d.type === 'character') {
			if (d.emotion) updateSeraSprite (d.emotion);
			await typewriteAndAwait (d.text || '', { who: d.name || 'Sera' });
		} else {
			await typewriteAndAwait (d.text || '', { who: '' });
		}
	}
}

async function fetchEndingContent () {
	try {
		const res = await fetch (`${API_BASE}/game/ending`, { credentials: 'include' });
		if (!res.ok) return null;
		const json = await res.json ();
		return json?.data || null;
	} catch (e) { return null; }
}

const ENDING_IMAGE_MAP = {
	ENDING_INSTANT_BAD:        null,
	ENDING_BAD:                null,
	ENDING_NORMAL_NO_CONTACT:  null,
	ENDING_NORMAL_CONTACT:     null,
	ENDING_HAPPY:              null,
	ENDING_MARRIAGE:           null
};
let _endingImageEl = null;
async function showEndingImageIfAvailable (endingId) {
	const url = ENDING_IMAGE_MAP[endingId];
	if (!url) return;
	const visuals = document.querySelector ('[data-screen="game"] [data-content="visuals"]') || document.body;
	if (_endingImageEl) _endingImageEl.remove ();
	_endingImageEl = document.createElement ('div');
	_endingImageEl.className = 'cg-overlay ending-cg';
	_endingImageEl.style.backgroundImage = `url("${encodeURI (url)}")`;
	visuals.appendChild (_endingImageEl);
	void _endingImageEl.offsetWidth;
	_endingImageEl.classList.add ('cg-overlay--visible');
}

let _sessionBootstrapped = false;
async function bootstrapSessionOnce (playerName) {
	if (_sessionBootstrapped) return;
	try {
		const meRes = await fetch (`${API_BASE}/sessions/me`, { credentials: 'include' });
		const meJson = meRes.ok ? await meRes.json () : null;
		const hasSession = !!(meJson?.data?.has_session);
		if (!hasSession) {
			await fetch (`${API_BASE}/sessions`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				credentials: 'include',
				body: JSON.stringify ({ force_reset: false })
			});
		}
		await fetch (`${API_BASE}/sessions/me/start`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			credentials: 'include',
			body: JSON.stringify ({ player_name: playerName })
		});
		_sessionBootstrapped = true;
	} catch (e) {
		console.warn ('[session] bootstrap failed (BE 미가용?):', e.message || e);
	}
}

async function fetchSessionMe () {
	try {
		const res = await fetch (`${API_BASE}/sessions/me`, { credentials: 'include' });
		if (!res.ok) return null;
		const json = await res.json ();
		return json?.data || null;
	} catch (e) { return null; }
}

async function postSessionsCreate (forceReset) {
	const res = await fetch (`${API_BASE}/sessions`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		credentials: 'include',
		body: JSON.stringify ({ force_reset: !!forceReset })
	});
	return res;
}

async function fetchResume () {
	try {
		const res = await fetch (`${API_BASE}/sessions/me/resume`, { credentials: 'include' });
		if (!res.ok) return { ok: false, status: res.status };
		const json = await res.json ();
		return { ok: true, data: json?.data || null };
	} catch (e) { return { ok: false, status: 0 }; }
}

function applyBackendResumeState (beResume) {
	const state = beResume?.state || beResume;
	if (!state) return null;
	const prevGame   = monogatari.storage ('game')   || {};
	const prevLLM    = monogatari.storage ('llm')    || {};
	const prevPlayer = monogatari.storage ('player') || {};
	const gameState = {
		affinity:         finiteNumber (state.affinity, finiteNumber (prevGame.affinity, 0)),
		affinity_delta:   0,
		progress:         finiteNumber (state.progress, finiteNumber (prevGame.progress, 0)),
		chat_count:       finiteNumber (state.chat_count, finiteNumber (prevGame.chat_count, 0)),
		current_scene_id: state.current_scene_id || prevGame.current_scene_id || 'SCENE_FIRST_MEET'
	};
	monogatari.storage ({
		player: { name: state.player_name || prevPlayer.name || 'Player' },
		sera:   { name: 'Sera' },
		game: Object.assign ({}, prevGame, gameState),
		llm: Object.assign ({}, prevLLM, {
			emotion:    state.emotion || prevLLM.emotion || 'NEUTRAL',
			shouldEnd: !!state.is_ended
		})
	});
	return gameState;
}

function patchSaveDataWithBackendResume (saveData, beResume) {
	const state = beResume?.state || beResume;
	const storage = saveData?.game?.storage;
	if (!state || !storage) return false;
	const prevGame   = storage.game   || {};
	const prevLLM    = storage.llm    || {};
	const prevPlayer = storage.player || {};
	storage.player = { name: state.player_name || prevPlayer.name || 'Player' };
	storage.sera = { name: 'Sera' };
	storage.game = Object.assign ({}, prevGame, {
		affinity:         finiteNumber (state.affinity, finiteNumber (prevGame.affinity, 0)),
		affinity_delta:   0,
		progress:         finiteNumber (state.progress, finiteNumber (prevGame.progress, 0)),
		chat_count:       finiteNumber (state.chat_count, finiteNumber (prevGame.chat_count, 0)),
		current_scene_id: state.current_scene_id || prevGame.current_scene_id || 'SCENE_FIRST_MEET'
	});
	storage.llm = Object.assign ({}, prevLLM, {
		emotion:    state.emotion || prevLLM.emotion || 'NEUTRAL',
		shouldEnd: !!state.is_ended
	});
	// 배경은 monogatari state.scene 으로 자동 트래킹되므로 별도 storage 트래킹 불필요.
	return true;
}

async function patchLocalSaveSlotWithBackendResume (beResume) {
	try {
		const saveData = await monogatari.Storage.get (SAVE_SLOT_KEY);
		if (patchSaveDataWithBackendResume (saveData, beResume)) {
			await monogatari.Storage.set (SAVE_SLOT_KEY, saveData);
		}
	} catch (e) {
	}
}

async function _confirmReset () {
	return new Promise ((resolve) => {
		const overlay = document.createElement ('div');
		overlay.className = 'confirm-modal';
		overlay.innerHTML = `
			<div class="confirm-modal__panel" role="alertdialog">
                <div class="confirm-modal__title">Reset existing session?</div>
                <div class="confirm-modal__body">This will clear the current session and local save slot. Start over?</div>
				<div class="confirm-modal__buttons">
                    <button type="button" class="confirm-modal__btn confirm-modal__btn--cancel">Cancel</button>
                    <button type="button" class="confirm-modal__btn confirm-modal__btn--ok">Start Over</button>
				</div>
			</div>
		`;
		document.body.appendChild (overlay);
		void overlay.offsetWidth;
		overlay.classList.add ('confirm-modal--visible');
		const close = (decision) => {
			overlay.classList.remove ('confirm-modal--visible');
			setTimeout (() => { if (overlay.parentNode) overlay.parentNode.removeChild (overlay); }, 250);
			resolve (decision);
		};
		overlay.querySelector ('.confirm-modal__btn--cancel').addEventListener ('click', () => close (false));
		overlay.querySelector ('.confirm-modal__btn--ok').addEventListener ('click', () => close (true));
	});
}

async function _hasLocalAutoSave () {
	try {
		const data = await monogatari.Storage.get (SAVE_SLOT_KEY);
		if (!data) return false;
		if (data.game && data.game.state && data.game.state.label) return true;
		if (data.Engine && data.Engine.Label) return true;
		return false;
	} catch (e) {
		return false;
	}
}

function _loadAndAwaitRestoration (slotKey) {
	return new Promise ((resolve, reject) => {
		const targets = [
			document.querySelector ('visual-novel'),
			document.querySelector ('#monogatari'),
			document.body,
			window
		].filter ((target, index, list) => target && list.indexOf (target) === index);
		let settled = false;
		let safety = null;
		const cleanup = () => {
			targets.forEach (target => target.removeEventListener ('didLoadGame', onDidLoad));
			if (safety) clearTimeout (safety);
		};
		const finish = () => { if (settled) return; settled = true; cleanup (); resolve (); };
		const onDidLoad = () => finish ();
		targets.forEach (target => target.addEventListener ('didLoadGame', onDidLoad, { once: true }));
		safety = setTimeout (() => {
			console.warn ('[resume] didLoadGame timeout');
			finish ();
		}, 2500);
		monogatari.loadFromSlot (slotKey).catch (e => {
			cleanup ();
			settled = true;
			reject (e);
		});
	});
}

let _resumeSlotSaveTimer = null;
let _savingResumeSlot = false;
function saveResumeSlot (reason = 'manual') {
	if (_savingResumeSlot) return;
	_savingResumeSlot = true;
	try {
		const label = monogatari.state ('label') || '(none)';
		const step = monogatari.state ('step');
		const sceneAtSave = monogatari.state ('scene') || '(none)';
		const charsAtSave = (monogatari.state ('characters') || []).length;
		console.debug ('[auto-save]', SAVE_SLOT_KEY, '| label:', label, '| step:', step, '| scene:', sceneAtSave, '| characters:', charsAtSave, '| reason:', reason);
		monogatari.saveTo (SAVE_SLOT_PREFIX, SAVE_SLOT_ID, SAVE_SLOT_NAME);
	} catch (e) {
		console.warn ('[save] auto-save 실패:', e);
	} finally {
		_savingResumeSlot = false;
	}
}

function _shouldAutoSaveScriptState (label = monogatari.state ('label')) {
	return SCRIPT_AUTOSAVE_LABELS.has (label) && monogatari.global ('playing') === true;
}

function _scheduleScriptAutoSave (reason = 'script-state') {
	if (!_shouldAutoSaveScriptState ()) return;
	if (_resumeSlotSaveTimer) clearTimeout (_resumeSlotSaveTimer);
	_resumeSlotSaveTimer = setTimeout (() => {
		_resumeSlotSaveTimer = null;
		if (_shouldAutoSaveScriptState ()) saveResumeSlot (reason);
	}, RESUME_SLOT_SAVE_DELAY_MS);
}

// 디바운스를 거치지 않고 즉시 1회 저장. (debounced 타이머가 fire 되기 전에 인터럽트가 와도 직전 상태 보존.)
function flushResumeSlotSave (reason = 'flush') {
	if (_resumeSlotSaveTimer) {
		clearTimeout (_resumeSlotSaveTimer);
		_resumeSlotSaveTimer = null;
	}
	if (_shouldAutoSaveScriptState ()) saveResumeSlot (reason);
}

let _scriptAutoSaveInstalled = false;
function _installScriptAutoSaveHook () {
	if (_scriptAutoSaveInstalled) return;
	const target = document.querySelector ('visual-novel');
	if (!target) {
		setTimeout (_installScriptAutoSaveHook, 100);
		return;
	}
	_scriptAutoSaveInstalled = true;
	target.addEventListener ('didUpdateState', (event) => {
		const nextState = event?.detail?.newState || {};
		const label = nextState.label || monogatari.state ('label');
		if (!SCRIPT_AUTOSAVE_LABELS.has (label)) return;
		_scheduleScriptAutoSave ('script-state');
	});
	window.addEventListener ('beforeunload', () => flushResumeSlotSave ('beforeunload'));

	// Quit 직전 강제 저장 — 엔진의 'quit' 리스너가 confirm 후 'end' 액션을 실행하기 전에 fire 되므로
	// 여기서 동기적으로 flush 하면 마지막 채팅까지 슬롯에 들어간다.
	// (engine 의 'end' 액션은 resetGame() 으로 in-memory storage 를 비워 그 다음에 saveTo 해도 빈 데이터만 저장됨.)
	monogatari.registerListener ('quit', {
		callback: function () {
			flushResumeSlotSave ('quit');
			return true; // 엔진 quit 리스너의 propagation 차단되지 않게 truthy 반환
		}
	});
}

async function _engineStart () {
	try {
		monogatari.global ('playing', true);
		await monogatari.onStart ();
	} catch (e) {
		console.warn ('[engine-start] onStart 실패:', e);
	}
	document.querySelectorAll ('#monogatari [data-screen]').forEach (el => {
		if (typeof el.setState === 'function') el.setState ({ open: false });
	});
	const gameScreen = document.querySelector ('#monogatari [data-screen="game"]');
	if (gameScreen && typeof gameScreen.setState === 'function') gameScreen.setState ({ open: true });
	const labels = monogatari.label ();
	const step   = monogatari.state ('step');
	if (labels && labels[step]) {
		try { await monogatari.run (labels[step]); }
		catch (e) { console.warn ('[engine-start] run 실패:', e); }
	}
}

async function handleNewGame () {
	console.debug ('[new-game] handleNewGame entry');
	try {
		cleanupCustomUI ();
		const me = await fetchSessionMe ();
		const beHasSession = !!(me?.has_session);
		const localHasSave = await _hasLocalAutoSave ();
		if (beHasSession || localHasSave) {
			const ok = await _confirmReset ();
			if (!ok) return;
		}
		try {
			const res = await postSessionsCreate (true);
			if (!res.ok) console.warn ('[new-game] /sessions 응답 비정상:', res.status);
		} catch (e) {
			console.warn ('[new-game] /sessions 호출 실패 (BE 미가용?):', e);
		}
		try { await monogatari.Storage.remove (SAVE_SLOT_KEY); } catch (e) {  }
		try { await monogatari.Storage.remove ('AutoSave_1'); } catch (e) {}
		try { await monogatari.resetGame (); } catch (e) {  }
		monogatari.state ({ step: 0, label: 'Start' });
		_sessionBootstrapped = false;
		console.debug ('[new-game] starting engine');
		await _engineStart ();
	} catch (err) {
		console.error ('[new-game] unhandled error in handleNewGame:', err);
		alert ('새 게임 시작 중 오류가 발생했어요. 콘솔을 확인해주세요.\n\n' + (err?.message || err));
	}
}

async function handleResume () {
	console.debug ('[resume] handleResume entry');
	try {
		document.querySelectorAll ('text-input').forEach (n => n.remove ());

		const [me, hasLocal] = await Promise.all ([fetchSessionMe (), _hasLocalAutoSave ()]);
		console.debug ('[resume] fetchSessionMe:', me, '| _hasLocalAutoSave:', hasLocal);
		const beReady = !!(me?.has_session && me?.is_started !== false);

		if (!beReady && !hasLocal) {
			alert ('No resumable session was found.');
			_refreshSomaMainMenu ();
			return;
		}

		let beResume = null;
		if (beReady) {
			const r = await fetchResume ();
			if (r.ok) {
				beResume = r.data;
				console.debug ('[resume] /sessions/me/resume response:', beResume);
				// 즉시 HUD 페인트 — loadFromSlot 가 끝나기 전에 BE state 의 affinity/progress 를 화면에 보여줘서
				// "첫 resume 에서 옛 값이 잠시 보였다가 나중에 갱신" 증상을 차단.
				const beState = beResume?.state || {};
				const beAffinity = finiteNumber (beState.affinity, undefined);
				const beProgress = finiteNumber (beState.progress, undefined);
				if (typeof beAffinity === 'number' || typeof beProgress === 'number') {
					setGameActive (true);
					ensureHUD ();
					updateHUD ({ progress: beProgress, affinity: beAffinity });
					console.debug ('[resume] painted backend state immediately:', { affinity: beAffinity, progress: beProgress });
				}
			} else {
				console.warn ('[resume] /sessions/me/resume status=', r.status);
			}
		}

		// BE state 즉시 반영 — loadFromSlot 가 끝난 뒤 storage 가 BE 값으로 덮이도록
		// 슬롯 자체를 패치한다. (그 이후 applyBackendResumeState 가 in-memory 에 한 번 더 덮어 쓴다.)
		let loadedFromSlot = false;
		if (hasLocal) {
			try {
				if (beResume?.state) await patchLocalSaveSlotWithBackendResume (beResume);
				console.debug ('[resume] calling loadFromSlot with key:', SAVE_SLOT_KEY);
				await _loadAndAwaitRestoration (SAVE_SLOT_KEY);
				loadedFromSlot = true;
				console.debug ('[resume] loadFromSlot complete | label:', monogatari.state ('label'), '| step:', monogatari.state ('step'), '| scene:', monogatari.state ('scene'));
			} catch (e) {
				console.warn ('[resume] loadFromSlot 실패:', e);
				if (!beResume) { alert ('Could not load the saved game.'); return; }
			}
		}

	_sessionBootstrapped = !!beResume;

	if (loadedFromSlot) {
		const restoredLabel = monogatari.state ('label') || 'Start';
		const restoredStep = monogatari.state ('step') || 0;
		const resumeIntoChat = CHAT_RESUME_LABELS.has (restoredLabel);
		if (!resumeIntoChat) {
			setGameActive (true);
			monogatari.global ('playing', true);
			pendingStreamResponse = null;
			document.querySelectorAll ('#monogatari [data-screen]').forEach (el => {
				if (typeof el.setState === 'function') el.setState ({ open: false });
			});
			const gameScreen = document.querySelector ('#monogatari [data-screen="game"]');
			if (gameScreen && typeof gameScreen.setState === 'function') gameScreen.setState ({ open: true });
			// 배경 복원은 monogatari onLoad 의 Scene action 이 자동 처리 (state.scene 기반).
			const labels = monogatari.label ();
			if (labels && labels[restoredStep]) monogatari.run (labels[restoredStep]);
			return;
		}

		if (beResume?.state) {
			applyBackendResumeState (beResume);
		}
		setGameActive (true);
		monogatari.global ('playing', true);
		pendingStreamResponse = null;
		const prevLLM = monogatari.storage ('llm') || {};
		const prevBoot = monogatari.storage ('boot') || {};
		monogatari.storage ({
			llm: Object.assign ({}, prevLLM, {
				prompt: '',
				response: '',
				event_id: '',
				next_scene_id: '',
				shouldEnd: false
			}),
			boot: Object.assign ({}, prevBoot, {
				mode: 'loaded-slot',
				recent_messages: Array.isArray (beResume?.recent_messages) ? beResume.recent_messages : []
			})
		});
		monogatari.state ({ label: 'LLMChat', step: 0 });
		document.querySelectorAll ('#monogatari [data-screen]').forEach (el => {
			if (typeof el.setState === 'function') el.setState ({ open: false });
		});
		const gameScreen = document.querySelector ('#monogatari [data-screen="game"]');
		if (gameScreen && typeof gameScreen.setState === 'function') gameScreen.setState ({ open: true });
		const labels = monogatari.label ();
		const step   = monogatari.state ('step');
		if (labels && labels[step]) monogatari.run (labels[step]);
		return;
	}

	try { await monogatari.resetGame (); } catch (e) {  }
	if (beResume) {
		const state  = beResume.state || {};
		const recent = Array.isArray (beResume.recent_messages) ? beResume.recent_messages : [];
		monogatari.storage ({
			player: { name: state.player_name || 'Player' },
			sera:   { name: 'Sera' },
			game: {
				affinity:         finiteNumber (state.affinity, 0),
				affinity_delta:   0,
				progress:         finiteNumber (state.progress, 0),
				chat_count:       finiteNumber (state.chat_count, 0),
				current_scene_id: state.current_scene_id || 'SCENE_FIRST_MEET'
			},
			llm: {
				prompt: '', response: '',
				emotion: state.emotion || 'NEUTRAL',
				event_id: '', next_scene_id: '',
				shouldEnd: !!state.is_ended
			},
			boot: { mode: 'resume', recent_messages: recent, scene_title: (beResume.scene && beResume.scene.title) || '' }
		});
	}
	monogatari.state ({ step: 0, label: 'LLMChat' });
	await _engineStart ();
	} catch (err) {
		console.error ('[resume] unhandled error in handleResume:', err);
		alert ('이어 하기 처리 중 오류가 발생했어요. 콘솔을 확인해주세요.\n\n' + (err?.message || err));
	}
}


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

const MainMenu = monogatari.component ('main-menu');

class SomaMainMenu extends MainMenu {
	render () {
		return `
			<div data-ui="main-brand" aria-hidden="true">
				<span data-ui="main-kicker">SOMA x First Love</span>
                <strong data-ui="main-title">Kernel Side Story</strong>
			</div>
			<div data-content="wrapper">
                <button type="button" data-action="soma-resume" data-soma-button="resume" hidden>Resume</button>
                <button type="button" data-action="soma-new"    data-soma-button="new">New Game</button>
                <button type="button" data-action="open-screen" data-open="settings">Settings</button>
                <button type="button" data-action="open-screen" data-open="help">Help</button>
			</div>
		`;
	}

	async didMount () {
		console.debug ('[soma-menu] didMount ??registering refresh');
		await this._refreshSomaMenu ();
	}

	async _refreshSomaMenu () {
		try {
			const [me, hasLocal] = await Promise.all ([fetchSessionMe (), _hasLocalAutoSave ()]);
			const beReady   = !!(me?.has_session && me?.is_started !== false);
			const canResume = beReady || hasLocal;
			const resumeBtn = this.querySelector ('[data-soma-button="resume"]');
			const newBtn    = this.querySelector ('[data-soma-button="new"]');
			if (resumeBtn) resumeBtn.hidden = !canResume;
			if (newBtn)    newBtn.textContent = canResume ? 'New Game (reset previous)' : 'New Game';
		} catch (e) {  }
	}
}
SomaMainMenu.tag = 'main-menu';
monogatari.registerComponent (SomaMainMenu);

function _refreshSomaMainMenu () {
	document.querySelectorAll ('main-menu').forEach (el => {
		if (typeof el._refreshSomaMenu === 'function') el._refreshSomaMenu ();
	});
}

let _hudEl = null;
function ensureHUD () {
	if (_hudEl && document.body.contains (_hudEl)) {
		// hideHUD() 가 _hudEl 에 'hud-progress--leaving' (opacity:0) 을 붙이고 400ms 후 DOM 제거 스케줄.
		// resume 이 그 400ms 내에 일어나면 ensureHUD 가 stale 요소를 재사용해서 HUD 가 영영 invisible.
		// 재사용 시점에 leaving 클래스를 떼고 opacity 를 reset 한다.
		_hudEl.classList.remove ('hud-progress--leaving');
		_hudEl.style.opacity = '';
		return _hudEl;
	}
	const game = document.querySelector ('[data-screen="game"]') || document.body;
	const hud = document.createElement ('div');
	hud.className = 'hud-progress';
	hud.innerHTML = `
		<div class="hud-progress__row">
			<span class="hud-progress__label">진행도</span>
			<div class="hud-progress__bar"><div class="hud-progress__fill" style="width:0%"></div></div>
			<span class="hud-progress__pct">0%</span>
		</div>
		<div class="hud-progress__row hud-progress__row--aff">
			<span class="hud-progress__label">호감도</span>
			<span class="hud-progress__affinity">0</span>
		</div>
	`;
	game.appendChild (hud);
	_hudEl = hud;
	return hud;
}

function updateHUD ({ progress, affinity }) {
	const hud = ensureHUD ();
	progress = finiteNumber (progress, undefined);
	affinity = finiteNumber (affinity, undefined);
	if (typeof progress === 'number') {
		const fill = hud.querySelector ('.hud-progress__fill');
		const pct = hud.querySelector ('.hud-progress__pct');
		const clamped = Math.max (0, Math.min (100, progress));
		if (fill) fill.style.width = clamped + '%';
		if (pct) pct.textContent = clamped + '%';
	}
	if (typeof affinity === 'number') {
		const a = hud.querySelector ('.hud-progress__affinity');
		if (a) {
			a.textContent = String (affinity);
			a.classList.remove ('hud-progress__affinity--pos', 'hud-progress__affinity--neg');
			if (affinity > 0) a.classList.add ('hud-progress__affinity--pos');
			else if (affinity < 0) a.classList.add ('hud-progress__affinity--neg');
		}
	}
}

let _hudHideTimer = null;
function hideHUD () {
	if (!_hudEl) return;
	const target = _hudEl;
	target.classList.add ('hud-progress--leaving');
	if (_hudHideTimer) clearTimeout (_hudHideTimer);
	_hudHideTimer = setTimeout (() => {
		_hudHideTimer = null;
		// resume 이 400ms 내에 일어나 ensureHUD 가 같은 요소를 되살린 경우 leaving 클래스가 이미 제거됨.
		// 이때는 element 가 살아있는 'active' HUD 로 보고 제거하지 않는다.
		if (target.classList.contains ('hud-progress--leaving') && target.parentNode) {
			target.parentNode.removeChild (target);
			if (_hudEl === target) _hudEl = null;
		}
	}, 400);
}


function getStoredDialogLogEntries () {
	const raw = monogatari.storage ('dialogLog');
	const entries = Array.isArray (raw) ? raw : (Array.isArray (raw?.entries) ? raw.entries : []);
	return entries
		.filter (entry => entry && entry.dialog)
		.map (entry => ({
			id: entry.id || 'narrator',
			name: entry.name || '',
			color: entry.color || '#fff',
			dialog: entry.dialog || ''
		}));
}

function setStoredDialogLogEntries (entries) {
	monogatari.storage ({
		dialogLog: {
			entries: (Array.isArray (entries) ? entries : []).slice (-DIALOG_LOG_LIMIT)
		}
	});
}

function appendStoredDialogLogEntry (entry) {
	if (!entry?.dialog) return;
	const next = getStoredDialogLogEntries ();
	next.push ({
		id: entry.id || 'narrator',
		name: entry.name || '',
		color: entry.color || '#fff',
		dialog: entry.dialog || ''
	});
	setStoredDialogLogEntries (next);
}

function clearDialogLogDom () {
	const dlogList = document.querySelector ('[data-component="dialog-log"] [data-content="log"]');
	if (dlogList) dlogList.querySelectorAll ('[data-spoke]').forEach (n => n.remove ());
}

function restoreDialogLogFromStorage ({ force = false } = {}) {
	const entries = getStoredDialogLogEntries ();
	if (!entries.length) return;
	if (force) clearDialogLogDom ();
	else if (readDialogLogEntries ().length > 0) return;
	entries.forEach (entry => pushDialogLog (Object.assign ({ persist: false }, entry)));
}

function pushRecentMessagesToDialogLog (recent, playerName) {
	if (!Array.isArray (recent)) return;
	recent.forEach (m => {
		if (!m || !m.content) return;
		if (m.role === 'USER') {
			pushDialogLog ({ id: 'p', name: playerName, color: '#8ad8ff', dialog: escapeDialogText (m.content) });
		} else if (m.role === 'ASSISTANT') {
			pushDialogLog ({ id: 'y', name: 'Sera', color: '#ffb7d8', dialog: escapeDialogText (m.content) });
		} else {
			pushDialogLog ({ id: 'narrator', dialog: escapeDialogText (m.content) });
		}
	});
}

function pushDialogLog ({ id = 'narrator', name = '', color = '#fff', dialog = '', persist = true }) {
	if (!dialog) return;
	if (persist) appendStoredDialogLogEntry ({ id, name, color, dialog });
	try {
		const Component = monogatari?.component?.('dialog-log');
		if (!Component) return;
		Component.instances ((instance) => {
			instance.write ({
				id,
				character: { name, color },
				dialog
			});
		});
	} catch (e) {
	}
}

function readDialogLogEntries () {
	const logEl = document.querySelector ('[data-component="dialog-log"]');
	if (!logEl) return [];
	const entries = [];
	logEl.querySelectorAll ('[data-spoke]').forEach (entry => {
		const id = entry.getAttribute ('data-spoke') || 'narrator';
		const isNamed = entry.classList.contains ('named');
		const nameSpan = entry.querySelector ('span');
		const dialogP = entry.querySelector ('p');
		entries.push ({
			id,
			named: isNamed,
			name: isNamed && nameSpan ? nameSpan.textContent.trim () : '',
			color: isNamed && nameSpan ? (nameSpan.style.color || '') : '',
			dialog: dialogP ? dialogP.innerHTML : ''
		});
	});
	return entries;
}

let _logViewerEl = null;

function _renderUnifiedLog (listEl, entries) {
	listEl.innerHTML = '';
	if (!entries.length) {
        listEl.innerHTML = '<div class="log-viewer__empty">No dialog yet.</div>';
		return;
	}
	const fragment = document.createDocumentFragment ();
	entries.forEach (entry => {
		const row = document.createElement ('div');
		const variant = entry.id === 'p' ? 'user'
			: entry.id === 'y' ? 'assistant'
			: 'narration';
		row.className = `log-viewer__row log-viewer__row--${variant}`;
		const label = entry.named && entry.name
			? entry.name
			: (entry.id === 'centered' ? '' : 'Narrator');
		const colorStyle = entry.color ? ` style="color:${entry.color}"` : '';
		row.innerHTML = `
			<div class="log-viewer__role"${colorStyle}>${escapeDialogText (label)}</div>
			<div class="log-viewer__bubble">${entry.dialog}</div>
		`;
		fragment.appendChild (row);
	});
	listEl.appendChild (fragment);
}

async function openLogViewer () {
	if (_logViewerEl) return;
	const overlay = document.createElement ('div');
	overlay.className = 'log-viewer';
	overlay.innerHTML = `
        <div class="log-viewer__panel" role="dialog" aria-label="Dialog log">
			<div class="log-viewer__header">
                <span class="log-viewer__title">Dialog log</span>
                <button type="button" class="log-viewer__close" aria-label="Close">x</button>
			</div>
			<div class="log-viewer__list" tabindex="0"></div>
		</div>
	`;
	document.body.appendChild (overlay);
	_logViewerEl = overlay;
	void overlay.offsetWidth;
	overlay.classList.add ('log-viewer--visible');

	const listEl = overlay.querySelector ('.log-viewer__list');
	const closeEl = overlay.querySelector ('.log-viewer__close');

	closeEl.addEventListener ('click', closeLogViewer);
	overlay.addEventListener ('click', (e) => { if (e.target === overlay) closeLogViewer (); });

	_renderUnifiedLog (listEl, readDialogLogEntries ());
	listEl.scrollTop = listEl.scrollHeight;
}

function closeLogViewer () {
	if (!_logViewerEl) return;
	_logViewerEl.classList.remove ('log-viewer--visible');
	const el = _logViewerEl;
	setTimeout (() => { if (el.parentNode) el.parentNode.removeChild (el); }, 250);
	_logViewerEl = null;
}

function ensureLogButton () {
	if (document.querySelector ('.log-button')) return;
	const game = document.querySelector ('[data-screen="game"]') || document.body;
	const btn = document.createElement ('button');
	btn.type = 'button';
	btn.className = 'log-button';
	btn.title = 'Dialog log';
	btn.setAttribute ('aria-label', 'Dialog log');
	btn.textContent = 'Log';
	btn.addEventListener ('click', (e) => {
		e.preventDefault ();
		e.stopPropagation ();
		openLogViewer ();
	});
	game.appendChild (btn);
}

function setGameActive (active) {
	if (active) document.body.classList.add ('game-active');
	else document.body.classList.remove ('game-active');
}

function cleanupCustomUI () {
	setGameActive (false);
	if (_resumeSlotSaveTimer) {
		clearTimeout (_resumeSlotSaveTimer);
		_resumeSlotSaveTimer = null;
	}
	if (_shouldAutoSaveScriptState ()) saveResumeSlot ('quit');
	monogatari.global ('playing', false);
	clearSuggestions ();
	hideThinkingDots ();
	hideHUD ();
	if (_logViewerEl) closeLogViewer ();
	document.querySelectorAll ('.log-button, .event-toast, .affinity-vignette').forEach (n => n.remove ());
	document.querySelectorAll ('.main-menu-overlay, .confirm-modal').forEach (n => n.remove ());
	document.querySelectorAll ('text-input').forEach (n => n.remove ());
	const sayEl = document.querySelector ('[data-ui="say"]');
	const whoEl = document.querySelector ('[data-ui="who"]');
	if (sayEl) sayEl.innerHTML = '';
	if (whoEl) whoEl.textContent = '';
	clearDialogLogDom ();
	setStoredDialogLogEntries ([]);
	_sessionBootstrapped = false;
	_seraCurrentSprite = null;
	_playedSceneIntros.clear ();
	const bgEl = document.querySelector ('[data-screen="game"] [data-ui="background"]');
	if (bgEl) {
		bgEl.style.backgroundImage = '';
		bgEl.style.backgroundColor = '';
		bgEl.style.opacity = '';
		bgEl.style.transition = '';
	}
	_refreshSomaMainMenu ();
}

function _syncDistractionFree () {
	const isHidden = !!(monogatari?.global?.('distraction_free'));
	if (document.body) document.body.classList.toggle ('distraction-free', isHidden);
}

function _installLifecycleHooks () {
	if (!document.body) return;
	_installScriptAutoSaveHook ();
	document.addEventListener ('click', (e) => {
		if (e.target?.closest?.('[data-action="distraction-free"]')) {
			setTimeout (_syncDistractionFree, 0);
		}
	});
	document.addEventListener ('keydown', (e) => {
		if (e.key === 'h' || e.key === 'H') {
			if (e.target?.matches?.('input, textarea, select')) return;
			setTimeout (_syncDistractionFree, 0);
		}
	});

	if (typeof MutationObserver === 'undefined') return;
	let _mainScreenWasVisible = false;
	const observer = new MutationObserver (() => {
		const mainScreen = document.querySelector ('[data-screen="main"]');
		const gameScreen = document.querySelector ('[data-screen="game"]');
		if (!mainScreen || !gameScreen) return;
		const mainVisible = mainScreen.offsetParent !== null;
		const gameVisible = gameScreen.offsetParent !== null;
		if (mainVisible && !gameVisible && document.body.classList.contains ('game-active')) {
			cleanupCustomUI ();
		}
		if (mainVisible && !_mainScreenWasVisible) {
			_refreshSomaMainMenu ();
		}
		_mainScreenWasVisible = mainVisible;
	});
	observer.observe (document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['class', 'open', 'data-screen'] });

	const mainScreenEl = document.querySelector ('[data-screen="main"]');
	if (mainScreenEl) {
		let wasActive = mainScreenEl.classList.contains ('active');
		const focusedObs = new MutationObserver (() => {
			const isActive = mainScreenEl.classList.contains ('active');
			if (isActive && !wasActive) _refreshSomaMainMenu ();
			wasActive = isActive;
		});
		focusedObs.observe (mainScreenEl, { attributes: true, attributeFilter: ['class'] });
	}
}

if (document.readyState === 'loading') {
	document.addEventListener ('DOMContentLoaded', _installLifecycleHooks, { once: true });
} else {
	_installLifecycleHooks ();
}

let pendingStreamResponse = null;

monogatari.script ({
	'Start': [
		// 인트로 직전 — blank_white SVG 로 즉시 흰 배경 (fadeIn 없이 instant swap).
		'show scene blank_white',
		// 인트로 로고 오버레이 (스플래시).
		async function () {
			await showIntroLogo ();
			return true;
		},
		// 인트로 끝나면 검은 배경으로 페이드 — 이름 입력 모달 직전.
		'show scene fade_black with fadeIn',
		'jump NewGame'
	],

	'NewGame': [
		// === 씬 1: 이름 입력 (검정 배경 유지, 캐릭터 미노출) ===
		{
			'Input': {
				'Text': '당신의 이름을 알려주세요.',
				'Validation': function (input) {
					// BUILDUP_STORY.md 씬 1 규격: 한글 2~6자 또는 영문 2~12자
					return /^([가-힣]{2,6}|[A-Za-z]{2,12})$/.test (input.trim ());
				},
				'Save': function (input) {
					this.storage ({
						player: {
							name: input.trim ()
						}
					});
					return true;
				},
				'Revert': function () {
					this.storage ({
						player: {
							name: '???'
						}
					});
				},
				'Warning': '한글 2~6자 또는 영문 2~12자로 입력해 주세요.'
			}
		},

		// === 씬 2: 아침 기상 (침실 SVG 배경) ===
		'show scene bedroom_dawn with fadeIn',
		'4월 13일, 월요일. 화창한 아침.',
		'또로로롱~ 오니쨩~! 일어날 시간이에요!!',
		'또로로롱~ 오니쨩~! 일어날 시간이에요!!',
		'…뚝.',
		'p 으… 아침인가… 벌써 시간이…',
		'p 일어나서 씻어야지…',
		'저벅… 저벅… 툭. 샤아아아아—',
		'…툭. 위이이이잉… 딸깍. 툭.',
		'p 하아… 이제야 좀 상쾌하네. 오늘은 처음 센터에 가는 날이니까 빨리 준비해야지.',

		// === 씬 3: 출근길 (현관 SVG → 지하철 SVG) ===
		'show scene apartment_door with fadeIn',
		'철컥— 현관문이 닫힌다.',

		'show scene train_interior with fadeIn',
		'쿠구구궁… 덜컹… 덜컹…',
		'p 이건 탈 때마다 왜 이리 시끄러워…',
		'끼이이익… 덜컹… 슈우우우욱.',

		// === 씬 4: 포스트타워 진입 (실 이미지 + 엘리베이터 분위기) ===
		'show scene posttower_lobby with fadeIn',
		'저벅… 저벅…',
		'p 오, 여기가 소마 건물이구나. 7층이었지, 아마?',

		'show scene elevator_panel with fadeIn',
		'7층 버튼을 누른다.',
		'띵— 문이 열린다.',

		// === 씬 5: 7층 센터 홀 (밝은 분위기) ===
		'show scene center_hall with fadeIn',
		'p 오오! 이곳이 센터구나. 안이 생각보다 훨씬 깔끔한걸?',
		'운 좋게 소프트웨어 마에스트로에 합격한 나는, 워크숍이 끝나고 처음으로 센터에 발을 들였다.',
		'p 센터 오픈 첫날이라 그런지 사람이 꽤 많네…! 워크숍 때는 제대로 얘기를 못해봤지만… 오늘은 꼭 팀원을 구해야지!',
		'p 워크숍 때 봤던 그녀도 있을까…? 꼭 다시 만나보고 싶어.',
		'지난주 워크숍에서 간식을 너무 많이 먹은 탓에 혈당 스파이크가 왔고, 결국 중간에 골아 떨어지는 바람에 네트워킹을 제대로 못했다. 정확히는 18번 테이블의 초코파이 20개가 원흉이었다.',
		'p 앞으로 간식은 자제하자…',
		'안쪽으로 발걸음을 옮긴다.',
		'p 이야, 벌써 서로 안면을 텄구나. 나도 워크숍 때 좀 잘할걸 그랬네…',
		'p 아니야, 지금도 늦지 않았어. 열심히 네트워킹하자!',

		// === 씬 6: S1 룸 첫 조우 (이세라 첫등장 CG 페이드 인 → 스프라이트 등장) ===
		'show scene s1_room with fadeIn',
		'— S1 룸 —',
		'p 아, 여기가 그곳이구나! 내가 면접 봤던 곳… 그땐 좁아 보였는데, 벽을 치우니까 엄청 넓네.',
		'저벅… 저벅… 툭.',
		'p 어?',
		'p 어..? 어…???? 아닛, 저 사람은…?',

		'show image sera_first with fadeIn',
		'창가 앞, 화사한 햇볕이 내리쬐는 자리. 신비로운 분위기의 소녀가 앉아 있었다.',
		'천사의 날개 같은 흰 머리, 사람을 홀리는 듯한 파란 눈, 가녀린 속눈썹, 보호본능을 자극하는 가녀린 체구. 그야말로 나의 이상향과 같은 존재였다.',
		'그녀의 노트북 화면엔 검은 터미널 위로 GDB 프롬프트가 깜빡이고, 옆에는 다 식어버린 아메리카노가 놓여 있었다.',
		'hide image sera_first with fadeOut',

		// === 씬 7: 첫 인사 (이세라 스프라이트 등장; 평온 → 행복 → 평온) ===
		'show character y calm with fadeIn',
		'p 그때 워크숍 때 봤던 사람이잖아…? 다시 봐도 정말 눈에 띄네.',
		'p 그때 잠깐 이야기 듣다 보니 관심사가 나랑 비슷한 것 같았어. 지금이라도 한 번 말을 걸어봐야겠다…!',
		'그녀 앞으로 조심스럽게 다가간다.',
		'p 저… 저기요…!',
		'y …?',
		'p 그… 저… 혹시… 저, 기억하시나요…?',
		'y 응? 아니아니, 누구신데요?',
		'그녀가 잠시 나를 바라보더니, 뭔가 떠오른 듯 눈이 살짝 커졌다.',
		'show character y happy',
		'y 아…! 그때 워크숍 18번 테이블에서 초코파이 드시던 분이세요?',
		'p 네…! 기억해주셨군요!! 저, {{player.name}}이에요.',
		{
			'Function': {
				'Apply': function () {
					this.storage ({ sera: { name: '이세라' } });
					return true;
				},
				'Revert': function () {
					this.storage ({ sera: { name: '???' } });
					return true;
				}
			}
		},
		'y 오, 그분이셨구나? 안녕하세요. 저는 이세라라고 해요.',
		'show character y calm',
		'y 잘 부탁드려요, {{player.name}}씨.',
		'p 반갑습니다…!',
		'p (어색한 첫 인사는 끝났다. 이제 뭐라고 말을 꺼내지…)',
		'jump LLMChat'
	],

	'LLMChat': [
		async function () {
			const boot = this.storage ('boot') || {};
			const game = this.storage ('game') || {};

			const playerName = (this.storage ('player') || {}).name || '플레이어';

			setGameActive (true);
			// resume 경로는 handleResume 이 _sessionBootstrapped=true 로 마킹 → bootstrap 스킵.
			if (boot.mode !== 'resume' && boot.mode !== 'loaded-slot') {
				await bootstrapSessionOnce (playerName);
			}
			ensureHUD ();
			updateHUD ({
				progress: typeof game.progress === 'number' ? game.progress : 0,
				affinity: typeof game.affinity === 'number' ? game.affinity : 0
			});
			_seraCurrentSprite = null;
			ensureLogButton ();

			if (boot.mode === 'resume' || boot.mode === 'loaded-slot') {
				// BE recent_messages 는 chat 의 source of truth (FE storage 는 LLMChat 도중 saveTo 가 자동으로
				// 안 일어나서 종종 stale). 기존 dialog-log DOM + storage 를 비우고 BE 데이터로 다시 채운다.
				const recent = Array.isArray (boot.recent_messages) ? boot.recent_messages : [];
				console.debug ('[resume] restoring dialog log from BE recent_messages:', recent.length, 'entries');
				clearDialogLogDom ();
				setStoredDialogLogEntries ([]);
				if (recent.length > 0) {
					pushRecentMessagesToDialogLog (recent, playerName);
				}
				// 마지막 ASSISTANT 메시지를 textbox 에도 표시 (resume 직후 화면이 비어보이지 않게).
				if (boot.mode === 'resume') {
					const lastAsst = [...recent].reverse ().find (m => m && m.role === 'ASSISTANT');
					if (lastAsst?.content) {
						const sayEl = document.querySelector ('[data-ui="say"]');
						const whoEl = document.querySelector ('[data-ui="who"]');
						if (whoEl) whoEl.textContent = '이세라';
						if (sayEl) sayEl.innerHTML = escapeDialogText (lastAsst.content);
					}
					this.storage ({ boot: Object.assign ({}, boot, { mode: 'resume-played' }) });
				} else {
					this.storage ({ boot: Object.assign ({}, boot, { mode: 'loaded-slot-played' }) });
				}
				// 배경 복원은 monogatari Scene action onLoad 가 자동 처리.
			} else {
				await playSceneIntroIfPending (this);
				// 새 게임에서도 storage 에 누적된 dialog-log 가 있으면 (현재 세션에서 push 된 것) 복원.
				restoreDialogLogFromStorage ({ force: false });
			}
			clearSuggestions ();

			const prevLLM = this.storage ('llm') || {};
			this.storage ({
				llm: Object.assign ({}, prevLLM, {
					prompt: '',
					response: '',
					event_id: '',
					next_scene_id: '',
					shouldEnd: false
				})
			});
			monogatari.state ({ label: 'LLMChat', step: 0 });
			return true;
		},

		{
			'Input': {
				'Text': '',
				'Type': 'textarea',
				'Class': 'llm-input',
				'Attributes': {
					'rows': '1',
					'maxlength': '300',
					'placeholder': '이세라에게 말을 걸어보세요…'
				},
				'Validation': function (input) {
					const trimmed = input.trim ();
					return trimmed.length >= 1 && trimmed.length <= 300;
				},
				'Save': function (input) {
					const prompt = input.trim ();
					appendStoredDialogLogEntry ({
						id: 'p',
						name: (this.storage ('player') || {}).name || 'Player',
						color: '#8ad8ff',
						dialog: escapeDialogText (prompt)
					});
					this.storage ({
						llm: {
							prompt: escapeDialogText (prompt),
							response: '',
							emotion: 'NEUTRAL',
							event_id: '',
							next_scene_id: '',
							shouldEnd: false
						}
					});

					pendingStreamResponse = fetch (`${API_BASE}/chat`, {
						method: 'POST',
						headers: {
							'Content-Type': 'application/json',
							'Accept': 'text/event-stream'
						},
						credentials: 'include',
						body: JSON.stringify ({ message: prompt })
					});

					clearSuggestions ();
					return true;
				},
				'Revert': function () {
					this.storage ({
						llm: {
							prompt: '',
							response: '',
							emotion: 'NEUTRAL',
							event_id: '',
							next_scene_id: '',
							shouldEnd: false
						}
					});
				},
				'Warning': '1자 이상 300자 이하로 입력해 주세요.',
				'actionString': '↑'
			}
		},

		'p {{llm.prompt}}',

		async function () {
			const sayEl = document.querySelector ('[data-ui="say"]');
			const whoEl = document.querySelector ('[data-ui="who"]');
			if (whoEl) whoEl.textContent = '이세라';
			if (!pendingStreamResponse) {
				console.warn ('[chat] skipped stale chat step without a pending stream');
				const prevLLM = this.storage ('llm') || {};
				this.storage ({
					llm: Object.assign ({}, prevLLM, {
						prompt: '',
						response: '',
						event_id: '',
						next_scene_id: '',
						shouldEnd: false
					})
				});
				return true;
			}
			showThinkingDots ();

			let textBuffer = '';
			let streamComplete = false;
			let metaArrived = false;
			let nextSceneId = null;
			let triggeredEventId = null;
			let lastState = null;

			const handleSseEvent = (event, payload) => {
				const evtKey = String (event || '').toLowerCase ();
				switch (evtKey) {
					case 'meta':
						if (payload?.emotion) updateSeraSprite (payload.emotion);
						metaArrived = true;
						hideThinkingDots ();
						break;
					case 'delta':
					case 'message':
						if (typeof payload?.text === 'string') textBuffer += payload.text;
						else if (typeof payload?.chunk === 'string') textBuffer += payload.chunk;
						else if (typeof payload?.content === 'string') textBuffer += payload.content;
						else if (typeof payload?.delta === 'string') textBuffer += payload.delta;
						break;
					case 'state':
						lastState = payload || {};
						if (lastState.emotion) updateSeraSprite (lastState.emotion);
						// 호감도 변동은 typewriter 진행 중에 즉시 시각화 → 답변 정서와 동기화
						flashAffinityVignette (typeof lastState.affinity_delta === 'number' ? lastState.affinity_delta : 0);
						// HUD 진행도/호감도 즉시 갱신 — SSE state 페이로드가 truth.
						updateHUD ({
							progress: typeof lastState.progress === 'number' ? lastState.progress : undefined,
							affinity: typeof lastState.affinity === 'number' ? lastState.affinity : undefined
						});
						break;
					case 'event_trigger':
						triggeredEventId = payload?.event_id || null;
						if (triggeredEventId) showEventToast (triggeredEventId);
						break;
					case 'scene_transition':
						nextSceneId = payload?.next_scene_id || null;
						break;
					case 'error':
						if (!textBuffer) {
							textBuffer = '지금은 연결이 좀 불안정한 것 같아요. 잠시 후에 다시 말을 걸어주실래요?';
						}
						break;
					default:
						console.warn ('[chat] 처리되지 않은 SSE 이벤트:', event, payload);
				}
			};

			const parseSseBlock = (block, doneRef) => {
				let evt = 'message';
				let dataStr = '';
				for (const rawLine of block.split (/\r?\n/)) {
					const line = rawLine;
					if (line.startsWith ('event:')) evt = line.slice (6).trim ();
					else if (line.startsWith ('data:')) {
						const part = line.slice (5).replace (/^\s/, '');
						dataStr += (dataStr ? '\n' : '') + part;
					}
				}
				if (evt === 'end') { doneRef.done = true; return; }
				if (!dataStr) return;
				let payload;
				try { payload = JSON.parse (dataStr); }
				catch (e) {
					console.warn ('[chat] SSE data JSON parse 실패:', dataStr.slice (0, 200));
					return;
				}
				handleSseEvent (evt, payload);
			};

			try {
				const response = await pendingStreamResponse;
				pendingStreamResponse = null;
				if (!response.ok) throw new Error (`HTTP ${response.status}`);

				const reader = response.body.getReader ();
				const decoder = new TextDecoder ();

				(async () => {
					try {
						let buf = '';
						const doneRef = { done: false };
						let processedAny = false;
						while (!doneRef.done) {
							const { done: d, value } = await reader.read ();
							if (d) break;
							buf += decoder.decode (value, { stream: true });
							const blocks = buf.split (/\r?\n\r?\n/);
							buf = blocks.pop () || '';
							for (const block of blocks) {
								if (!block.trim ()) continue;
								parseSseBlock (block, doneRef);
								processedAny = true;
								if (doneRef.done) break;
							}
						}
						buf += decoder.decode ();
						if (buf.trim ()) {
							for (const block of buf.split (/\r?\n\r?\n/)) {
								if (!block.trim ()) continue;
								parseSseBlock (block, doneRef);
								processedAny = true;
							}
						}
						if (!processedAny) {
						}
					} catch (e) {
						console.error ('[chat] stream read error:', e);
					}
					streamComplete = true;
				}) ();
			} catch (error) {
				console.error ('[chat] fetch failed:', error);
				textBuffer = '지금은 연결이 좀 불안정한 것 같아요. 잠시 후에 다시 말을 걸어주실래요?';
				streamComplete = true;
			}

			while (!metaArrived && !streamComplete && textBuffer.length === 0) {
				await new Promise (r => setTimeout (r, 50));
			}
			hideThinkingDots ();
			sayEl.innerHTML = '';

			const PAGE_BREAK_THRESHOLD = 80;
			let typed = 0;
			let pageText = '';
			let skipToBreak = false;

			let pageState = 'typing';
			let resolveAdvance = null;

			const handleInteract = (e) => {
				if (e.type === 'keydown') {
					if (e.isComposing || e.keyCode === 229) return; // IME 조합 중 무시
					if (!['Enter', ' ', 'ArrowRight'].includes (e.key)) return;
				}
				if (e.type === 'click' && e.target?.closest?.('text-input, button, select, input, textarea, .llm-suggestions')) return;
				if (e.type === 'keydown') e.preventDefault ();
				if (pageState === 'typing') {
					skipToBreak = true;
				} else if (pageState === 'waiting' && resolveAdvance) {
					resolveAdvance ();
					resolveAdvance = null;
				}
			};
			document.addEventListener ('click', handleInteract);
			document.addEventListener ('keydown', handleInteract);

			const waitForAdvance = () => {
				pageState = 'waiting';
				if (sayEl) sayEl.classList.add ('say--awaiting');
				return new Promise (r => { resolveAdvance = r; });
			};
			const finishWait = () => {
				if (sayEl) sayEl.classList.remove ('say--awaiting');
			};

			const skipLeadingWhitespace = () => {
				while (typed < textBuffer.length && ' \n\r\t'.includes (textBuffer[typed])) typed++;
			};

			while (typed >= textBuffer.length && !streamComplete) {
				await new Promise (r => setTimeout (r, 10));
			}
			skipLeadingWhitespace ();

			while (true) {
				if (typed >= textBuffer.length) {
					if (streamComplete) break;
					await new Promise (r => setTimeout (r, 10));
					continue;
				}

				const ch = textBuffer[typed++];
				pageText += ch;
				sayEl.innerHTML = escapeDialogText (pageText);

				let dwell = 0;
				if (/[.!?。！？]/.test (ch)) dwell = 70;
				else if (ch === '…' || ch === '⋯') dwell = 180;
				else if (/[,、]/.test (ch)) dwell = 35;

				if (/[.!?。！？]/.test (ch) && pageText.length >= PAGE_BREAK_THRESHOLD) {
					if (typed >= textBuffer.length && !streamComplete) {
						await new Promise (r => setTimeout (r, 50));
					}
					const next = textBuffer[typed];
					if (!next || next === ' ' || next === '\n') {
						await waitForAdvance ();
						finishWait ();
						skipToBreak = false;
						pageState = 'typing';
						pageText = '';
						sayEl.innerHTML = '';
						skipLeadingWhitespace ();
					}
				}

				if (!skipToBreak) {
					await new Promise (r => setTimeout (r, 30 + dwell));
				}
			}

			if (pageText.trim ()) {
				await waitForAdvance ();
				finishWait ();
			}

			document.removeEventListener ('click', handleInteract);
			document.removeEventListener ('keydown', handleInteract);

			if (textBuffer.trim ()) {
				pushDialogLog ({
					id: 'y',
					name: '이세라',
					color: '#ffb7d8',
					dialog: escapeDialogText (textBuffer)
				});
			}


			if (lastState) {
				const prevGame = this.storage ('game') || {};
				this.storage ({
					game: {
						affinity:        typeof lastState.affinity      === 'number' ? lastState.affinity      : prevGame.affinity      || 0,
						affinity_delta:  typeof lastState.affinity_delta=== 'number' ? lastState.affinity_delta: 0,
						progress:        typeof lastState.progress      === 'number' ? lastState.progress      : prevGame.progress      || 0,
						chat_count:      typeof lastState.chat_count    === 'number' ? lastState.chat_count    : prevGame.chat_count    || 0,
						current_scene_id: prevGame.current_scene_id || 'SCENE_FIRST_MEET'
					}
				});
			}

			const shouldEnd = !!(nextSceneId && /^SCENE_ENDING_/.test (nextSceneId));
			this.storage ({
				llm: {
					prompt: this.storage ('llm').prompt,
					response: textBuffer,
					emotion: lastState?.emotion || 'NEUTRAL',
					event_id: triggeredEventId || '',
					next_scene_id: nextSceneId || '',
					shouldEnd
				}
			});
			if (nextSceneId && !shouldEnd) {
				const prevGame = this.storage ('game') || {};
				this.storage ({ game: Object.assign ({}, prevGame, { current_scene_id: nextSceneId }) });
			}

			return true;
		},

		{
			'Conditional': {
				'Condition': function () {
					return (this.storage ('llm') || {}).shouldEnd ? 'end' : 'continue';
				},
				'continue': 'jump LLMChat',
				'end': 'jump LLMEnd'
			}
		}
	],

	'LLMEnd': [
		async function () {
			clearSuggestions ();
			hideThinkingDots ();
			hideHUD ();
			const ending = await fetchEndingContent ();
			if (!ending) {
				// BE 미가용 폴백
				await typewriteAndAwait ('다음에 또 이야기해요, ' + ((this.storage ('player') || {}).name || '플레이어') + '씨.', { who: '이세라' });
				return true;
			}
			await showEndingImageIfAvailable (ending.ending_id);
			if (ending.title) {
				await typewriteAndAwait (`— ${ending.title} —`, { who: '' });
			}
			if (ending.narrative) {
				// narrative가 길면 문장 단위로 분할해 자연스러운 페이지로
				const sentences = String (ending.narrative).split (/(?<=[\.\?\!。！？])\s+/);
				let buf = '';
				for (const s of sentences) {
					if ((buf + ' ' + s).trim ().length > 120 && buf) {
						await typewriteAndAwait (buf.trim (), { who: '' });
						buf = s;
					} else {
						buf = (buf ? buf + ' ' : '') + s;
					}
				}
				if (buf.trim ()) await typewriteAndAwait (buf.trim (), { who: '' });
			}
			return true;
		},
		'end'
	]
});

document.addEventListener('keydown', function (e) {
	if (!e.target.matches?.('.llm-input textarea')) return;
	if (e.key !== 'Enter' || e.shiftKey) return;
	if (e.isComposing || e.keyCode === 229) return;
	e.preventDefault();
	const form = e.target.closest('text-input');
	if (form) {
		const btn = form.querySelector('button');
		if (btn) btn.click();
	}
});

window.somaDebug = {
	show () {
		return monogatari.Storage.get (SAVE_SLOT_KEY)
			.then (data => {
				console.log ('[somaDebug.show]', data);
				return data;
			})
			.catch (e => {
				console.warn ('[somaDebug.show] Storage.get 실패:', e);
				return null;
			});
	},
	keys () {
		if (typeof monogatari.Storage.keys === 'function') {
			return monogatari.Storage.keys ()
				.then (keys => {
					console.log ('[somaDebug.keys]', keys);
					return keys;
				})
				.catch (e => {
					console.warn ('[somaDebug.keys] Storage.keys 실패:', e);
					return Object.keys (localStorage);
				});
		}
		const keys = Object.keys (localStorage);
		console.log ('[somaDebug.keys]', keys);
		return keys;
	},
	clear () {
		Promise.allSettled ([
			monogatari.Storage.remove (SAVE_SLOT_KEY),
			monogatari.Storage.remove ('AutoSave_1')
		]).finally (() => {
			console.log ('[somaDebug] 슬롯 삭제 완료. 새로고침합니다.');
			location.reload ();
		});
	},
	nuke () {
		localStorage.clear ();
		console.log ('[somaDebug] localStorage 전체 비움. 새로고침합니다.');
		location.reload ();
	}
};
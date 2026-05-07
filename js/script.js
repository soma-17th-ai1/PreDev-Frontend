/* global monogatari */

// 게임에서 사용할 메시지 정의
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

// 게임에서 사용할 알림 정의
monogatari.action ('notification').notifications ({
	'Welcome': {
		title: 'Welcome',
		body: 'This is the Monogatari VN Engine',
		icon: ''
	}
});

// 게임에서 사용할 Particles JS 구성 정의
monogatari.action ('particles').particles ({

});

// 게임에서 사용할 캔버스 오브젝트 정의
monogatari.action ('canvas').objects ({

});

// 게임 시작 전 크레딧 정의
monogatari.configuration ('credits', {

});

// 게임 이미지 갤러리 정의
monogatari.assets ('gallery', {
	'sera_first': '이세라 첫등장.png'
});

// 게임 음악 정의
monogatari.assets ('music', {

});

// 게임 음성 파일 정의
monogatari.assets ('voices', {

});

// 게임 효과음 정의
monogatari.assets ('sounds', {

});

// 게임 비디오 정의
monogatari.assets ('videos', {

});

// 게임 이미지 정의
monogatari.assets ('images', {

});

// 배경 이미지 정의 (실 이미지가 있는 씬만 등록; 그라디언트 배경은 함수 액션으로 처리)
monogatari.assets ('scenes', {
	'posttower_lobby': 'entrance.png'
});

// 등장인물 정의
monogatari.characters ({
	'p': {
		name: '{{player.name}}',
		color: '#8ad8ff'
	},
	'y': {
		name: '{{sera.name}}',
		color: '#ffb7d8',
		directory: '이세라_표정/이세라_표정',
		sprites: {
			calm: '평온.png',
			happy: '행복.png',
			shy: '수줍음.png',
			sad: '슬픔.png',
			angry: '화남.png',
			disgust: '혐오.png',
			excited: '흥분(좋은의미).png'
		}
	}
});


monogatari.translation ('English', {
	'보내기': '보내기',
	'↑': '↑'
});

// FastAPI v1.3 명세 기준 (API_SPEC.md §1)
const API_BASE = 'http://127.0.0.1:8000/api/v1';

// PERSONA.md / API_SPEC.md §1.4.1 emotion ENUM → sprite key/file
const SERA_SPRITE_MAP = {
	NEUTRAL:   'calm',
	HAPPY:     'happy',
	EXCITED:   'excited',
	SHY:       'shy',
	SAD:       'sad',
	ANGRY:     'angry',
	DISGUSTED: 'disgust',
	FURIOUS:   'angry'   // 전용 sprite 부재 → 화남 재사용
};
const SERA_SPRITE_FILE = {
	calm:    '평온.png',
	happy:   '행복.png',
	excited: '흥분(좋은의미).png',
	shy:     '수줍음.png',
	sad:     '슬픔.png',
	angry:   '화남.png',
	disgust: '혐오.png'
};
// 강한 감정은 살짝 더 빠르게 전환(놀라움 효과). 부드러운 감정은 길게.
const SERA_FADE_MS = {
	NEUTRAL: 350, HAPPY: 450, EXCITED: 350, SHY: 400, SAD: 400,
	ANGRY: 180, DISGUSTED: 180, FURIOUS: 180
};

function spriteUrl (spriteKey) {
	const file = SERA_SPRITE_FILE[spriteKey] || SERA_SPRITE_FILE.calm;
	return `assets/characters/이세라_표정/이세라_표정/${encodeURI (file)}`;
}

// 씬별 배경. 소마 도착 이후(포스트타워 1F~)는 모두 entrance.png 단일 자산을 임시로 사용.
// 소마 외 씬(아침 침실, 출근길)은 분위기 그라디언트 유지.
const SOMA_BG = 'url("assets/scenes/entrance.png") center / cover no-repeat #1a1a1a';
const SCENE_BG = {
	fade_black:     '#0a0a0f',
	bedroom_dawn:   'linear-gradient(180deg, #161927 0%, #2c2438 45%, #6b5564 100%)',
	apartment_door: 'linear-gradient(180deg, #1f1816 0%, #3b2a23 55%, #5e4334 100%)',
	train_interior: 'linear-gradient(180deg, #0d141c 0%, #1d2a36 55%, #38536a 100%)',
	posttower_lobby: SOMA_BG,
	elevator_panel:  SOMA_BG,
	center_hall:     SOMA_BG,
	s1_room:         SOMA_BG
};

function escapeDialogText (text) {
	return String (text)
		.replace (/&/g, '&amp;')
		.replace (/</g, '&lt;')
		.replace (/>/g, '&gt;')
		.replace (/"/g, '&quot;')
		.replace (/'/g, '&#039;')
		.replace (/\r?\n/g, '<br>');
}

// 게임 화면의 배경 레이어를 부드럽게 교체.
// 그라디언트↔이미지 보간이 깔끔하지 않아 'background' 트랜지션 대신
// opacity 페이드아웃 → 즉시 스왑 → 페이드인 방식으로 일관된 fade 연출을 보장한다.
let _currentSceneBg = null;
async function setSceneBackground (cssValue, fadeMs = 500) {
	const bgEl = document.querySelector ('[data-screen="game"] [data-ui="background"]')
		|| document.querySelector ('[data-ui="background"]');
	if (!bgEl) return;
	// 같은 배경이면 페이드 생략 (예: 포스트타워→엘리베이터→센터홀→S1룸 모두 SOMA_BG)
	if (_currentSceneBg === cssValue) return;
	_currentSceneBg = cssValue;
	const half = Math.max (60, Math.floor (fadeMs / 2));
	// 페이드 아웃
	bgEl.style.transition = `opacity ${half}ms ease`;
	bgEl.style.opacity = '0';
	await new Promise (r => setTimeout (r, half));
	// 배경 즉시 스왑 (트랜지션 없음 → 보간 이상 현상 방지)
	bgEl.style.transition = 'none';
	bgEl.style.backgroundImage = '';
	bgEl.style.backgroundColor = '';
	bgEl.style.background = cssValue;
	void bgEl.offsetWidth; // reflow
	// 페이드 인
	bgEl.style.transition = `opacity ${half}ms ease`;
	bgEl.style.opacity = '1';
	await new Promise (r => setTimeout (r, half));
}

// 인트로 로고 스플래시 (게임 시작 직후 5초 페이드 인 → 유지 → 페이드 아웃)
let _introLogoEl = null;
function showIntroLogo () {
	return new Promise (async (resolve) => {
		if (_introLogoEl) {
			_introLogoEl.remove ();
			_introLogoEl = null;
		}
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

		// reflow then fade in (2.5s)
		void overlay.offsetWidth;
		overlay.classList.add ('intro-logo--visible');
		await new Promise (r => setTimeout (r, 2500));
		// 유지 (2s)
		await new Promise (r => setTimeout (r, 2000));
		// 페이드 아웃 (1.5s)
		overlay.classList.add ('intro-logo--leaving');
		await new Promise (r => setTimeout (r, 1500));
		if (overlay.parentNode) overlay.parentNode.removeChild (overlay);
		_introLogoEl = null;
		resolve ();
	});
}

// 이세라 첫등장 CG 페이드 (visuals 레이어에 오버레이; 텍스트박스는 그대로 위에 보이도록)
let _seraCGEl = null;
function cgFadeIn () {
	if (_seraCGEl) {
		_seraCGEl.remove ();
		_seraCGEl = null;
	}
	const visuals = document.querySelector ('[data-screen="game"] [data-content="visuals"]')
		|| document.querySelector ('[data-screen="game"]')
		|| document.body;
	const cg = document.createElement ('div');
	cg.className = 'cg-overlay';
	cg.style.backgroundImage = `url("${encodeURI ('assets/gallery/이세라 첫등장.png')}")`;
	visuals.appendChild (cg);
	_seraCGEl = cg;

	void cg.offsetWidth;
	cg.classList.add ('cg-overlay--visible');
	return new Promise (r => setTimeout (r, 5000));
}

async function cgFadeOut () {
	if (!_seraCGEl) return;
	const cg = _seraCGEl;
	cg.classList.add ('cg-overlay--leaving');
	await new Promise (r => setTimeout (r, 2000));
	if (cg.parentNode) cg.parentNode.removeChild (cg);
	_seraCGEl = null;
}

// ─────────────────────────────────────────────────────────────────────────────
// 미연시 마이크로 인터랙션 헬퍼
// ─────────────────────────────────────────────────────────────────────────────

// emotion → sprite 크로스페이드 교체. 직접 src 깜빡임 없이 두 장의 IMG를 겹쳐 fade.
let _seraCurrentSprite = null;
function updateSeraSprite (emotion) {
	const spriteKey = SERA_SPRITE_MAP[emotion] || 'calm';
	if (_seraCurrentSprite === spriteKey) return;        // 동일 표정 재요청 무시
	_seraCurrentSprite = spriteKey;

	const charEl = document.querySelector ('[data-character="y"]');
	if (!charEl) return;                                 // 빌드업 전이면 sprite 없음

	const url = spriteUrl (spriteKey);
	const fadeMs = SERA_FADE_MS[emotion] ?? 350;

	const newImg = document.createElement ('img');
	newImg.src = url;
	newImg.alt = '이세라';
	newImg.className = 'sera-sprite-fade-in';
	newImg.style.transition = `opacity ${fadeMs}ms ease`;

	if (charEl.tagName === 'IMG') {
		// Monogatari가 IMG 태그를 직접 character로 사용하는 경우, 부모를 컨테이너로 활용
		const parent = charEl.parentElement;
		if (!parent) return;
		// data-character 속성을 새 IMG로 이전
		newImg.setAttribute ('data-character', 'y');
		newImg.setAttribute ('data-sprite', spriteKey);
		// 클래스/위치/스타일 복사(top/left 등 inline 보존)
		newImg.style.cssText = charEl.style.cssText + `; opacity: 0; transition: opacity ${fadeMs}ms ease`;
		// preserve Monogatari className flags (animated, fadeIn 등)
		newImg.className = charEl.className;
		parent.insertBefore (newImg, charEl);
		// next frame fade-in & 동시에 기존 fade-out
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

// "이세라가 입력 중…" 점 3개 인디케이터
function showThinkingDots () {
	const sayEl = document.querySelector ('[data-ui="say"]');
	if (!sayEl) return;
	sayEl.innerHTML = '<span class="thinking-dots" aria-label="이세라가 입력 중"><i></i><i></i><i></i></span>';
}
function hideThinkingDots () {
	const sayEl = document.querySelector ('[data-ui="say"]');
	const dots = sayEl?.querySelector ('.thinking-dots');
	if (dots) sayEl.innerHTML = '';
}

// 호감도 변동 vignette 글로우 (절제된 컬러 페이드)
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

// 예시 답안(suggestions) 칩 strip
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
		// BE 미가용은 silent — 미연시 흐름은 막지 않는다
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
	refresh.title = '다른 답안 보기';
	refresh.setAttribute ('aria-label', '예시 답안 새로고침');
	refresh.textContent = '↻';
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
	// 잔여 strip(중복 생성 방지)도 정리
	document.querySelectorAll ('.llm-suggestions').forEach (n => n.remove ());
}

// 이벤트 토스트 (호감도 임계 통과 시 BE의 event_trigger 응답을 시각화)
const EVENT_LABELS = {
	EVENT_LIKE_P30:  { sign: '+', text: '마음이 열림 (호감 30)' },
	EVENT_LIKE_P50:  { sign: '+', text: '친밀해짐 (호감 50)' },
	EVENT_LIKE_P70:  { sign: '+', text: '호감 표현 (호감 70)' },
	EVENT_LIKE_P100: { sign: '+', text: '고백 (호감 100)' },
	EVENT_DISLIKE_M30: { sign: '−', text: '거리감 (호감 -30)' },
	EVENT_DISLIKE_M50: { sign: '−', text: '차가워짐 (호감 -50)' },
	EVENT_DISLIKE_M70: { sign: '−', text: '회피 (호감 -70)' }
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

// 새 씬 메타 페치 + 인트로 자동 재생 (API_SPEC §4.1)
async function fetchSceneIntroDialogues () {
	try {
		const res = await fetch (`${API_BASE}/scenes/current`, { credentials: 'include' });
		if (!res.ok) return null;
		const json = await res.json ();
		return json?.data || null;
	} catch (e) { return null; }
}

// 텍스트박스를 직접 조작해 한 줄 typewriter + 진행 대기
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
				if (/[.!?。！？]/.test (ch)) dwell = 70;
				else if (ch === '…' || ch === '⋯') dwell = 180;
				else if (/[,、]/.test (ch)) dwell = 35;
				if (!skip) await new Promise (r => setTimeout (r, 30 + dwell));
			}
			sayEl.classList.add ('say--awaiting');
		}) ();
	});
}

async function playSceneIntroIfPending (storageRef) {
	const llm = storageRef.storage ('llm') || {};
	const target = llm.next_scene_id;
	if (!target || /^SCENE_ENDING_/.test (target)) return;
	const meta = await fetchSceneIntroDialogues ();
	if (!meta || !Array.isArray (meta.intro_dialogues) || meta.intro_dialogues.length === 0) {
		// 페치 실패는 silent — 다음 LLMChat 그대로 진행
		storageRef.storage ({ llm: Object.assign ({}, llm, { next_scene_id: '' }) });
		return;
	}
	for (const d of meta.intro_dialogues) {
		if (d.type === 'character') {
			if (d.emotion) updateSeraSprite (d.emotion);
			await typewriteAndAwait (d.text || '', { who: d.name || '이세라' });
		} else {
			await typewriteAndAwait (d.text || '', { who: '' });
		}
	}
	const game = storageRef.storage ('game') || {};
	storageRef.storage ({
		game: Object.assign ({}, game, { current_scene_id: target }),
		llm: Object.assign ({}, llm, { next_scene_id: '' })
	});
}

// 엔딩 콘텐츠 페치 (API_SPEC §5.1)
async function fetchEndingContent () {
	try {
		const res = await fetch (`${API_BASE}/game/ending`, { credentials: 'include' });
		if (!res.ok) return null;
		const json = await res.json ();
		return json?.data || null;
	} catch (e) { return null; }
}

// ENDING_* → 엔딩 이미지. 자산이 추가되면 키를 등록(예: ENDING_HAPPY: 'assets/gallery/ending_happy.png').
// 등록되지 않은 키는 네트워크 요청 없이 텍스트만 출력해 콘솔 에러를 만들지 않는다.
const ENDING_IMAGE_MAP = {
	// 자산 추가 시 활성화 — 현재 미등록
};
let _endingImageEl = null;
async function showEndingImageIfAvailable (endingId) {
	const url = ENDING_IMAGE_MAP[endingId];
	if (!url) return;                             // 자산 미등록 → 조용히 스킵
	const visuals = document.querySelector ('[data-screen="game"] [data-content="visuals"]') || document.body;
	if (_endingImageEl) _endingImageEl.remove ();
	_endingImageEl = document.createElement ('div');
	_endingImageEl.className = 'cg-overlay ending-cg';
	_endingImageEl.style.backgroundImage = `url("${encodeURI (url)}")`;
	visuals.appendChild (_endingImageEl);
	void _endingImageEl.offsetWidth;
	_endingImageEl.classList.add ('cg-overlay--visible');
}

// 세션 부트스트랩 (1회). BE 미가용 시 silent fail.
let _sessionBootstrapped = false;
async function bootstrapSessionOnce (playerName) {
	if (_sessionBootstrapped) return;
	try {
		await fetch (`${API_BASE}/sessions`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			credentials: 'include',
			body: JSON.stringify ({ force_reset: true })
		});
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

let pendingStreamResponse = null; // Promise<Response> — Save에서 즉시 시작하는 fetch

monogatari.script ({
	'Start': [
		// === 씬 0: 인트로 로고 (게임 시작 버튼 클릭 직후) ===
		async function () {
			await setSceneBackground ('#ffffff', 0);
			await showIntroLogo ();
			await setSceneBackground (SCENE_BG.fade_black, 400);
			return true;
		},

		// === 씬 1: 이름 입력 (검정 배경, 캐릭터 미노출) ===
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

		// === 씬 2: 아침 기상 (침실 천장 분위기, 내레이션·독백만) ===
		async function () {
			await setSceneBackground (SCENE_BG.bedroom_dawn, 500);
			return true;
		},
		'4월 13일, 월요일. 화창한 아침.',
		'또로로롱~ 오니쨩~! 일어날 시간이에요!!',
		'또로로롱~ 오니쨩~! 일어날 시간이에요!!',
		'…뚝.',
		'p 으… 아침인가… 벌써 시간이…',
		'p 일어나서 씻어야지…',
		'저벅… 저벅… 툭. 샤아아아아—',
		'…툭. 위이이이잉… 딸깍. 툭.',
		'p 하아… 이제야 좀 상쾌하네. 오늘은 처음 센터에 가는 날이니까 빨리 준비해야지.',

		// === 씬 3: 출근길 (현관 → 6호선) ===
		async function () {
			await setSceneBackground (SCENE_BG.apartment_door, 500);
			return true;
		},
		'철컥— 현관문이 닫힌다.',

		async function () {
			await setSceneBackground (SCENE_BG.train_interior, 500);
			return true;
		},
		'쿠구구궁… 덜컹… 덜컹…',
		'p 이건 탈 때마다 왜 이리 시끄러워…',
		'끼이이익… 덜컹… 슈우우우욱.',

		// === 씬 4: 포스트타워 진입 (실 이미지 + 엘리베이터 분위기) ===
		async function () {
			await setSceneBackground (SCENE_BG.posttower_lobby, 500);
			return true;
		},
		'저벅… 저벅…',
		'p 오, 여기가 소마 건물이구나. 7층이었지, 아마?',

		async function () {
			await setSceneBackground (SCENE_BG.elevator_panel, 500);
			return true;
		},
		'7층 버튼을 누른다.',
		'띵— 문이 열린다.',

		// === 씬 5: 7층 센터 홀 (밝은 분위기) ===
		async function () {
			await setSceneBackground (SCENE_BG.center_hall, 500);
			return true;
		},
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
		async function () {
			await setSceneBackground (SCENE_BG.s1_room, 500);
			return true;
		},
		'— S1 룸 —',
		'p 아, 여기가 그곳이구나! 내가 면접 봤던 곳… 그땐 좁아 보였는데, 벽을 치우니까 엄청 넓네.',
		'저벅… 저벅… 툭.',
		'p 어?',
		'p 어..? 어…???? 아닛, 저 사람은…?',

		// CG 페이드 인을 트리거 (5s) — 사용자가 내레이션을 클릭으로 넘기는 동안 자연스럽게 떠오름
		async function () {
			cgFadeIn (); // fire-and-forget: 내레이션이 진행되는 동안 5초에 걸쳐 떠오르도록
			return true;
		},
		'창가 앞, 화사한 햇볕이 내리쬐는 자리. 신비로운 분위기의 소녀가 앉아 있었다.',
		'천사의 날개 같은 흰 머리, 사람을 홀리는 듯한 파란 눈, 가녀린 속눈썹, 보호본능을 자극하는 가녀린 체구. 그야말로 나의 이상향과 같은 존재였다.',
		'그녀의 노트북 화면엔 검은 터미널 위로 GDB 프롬프트가 깜빡이고, 옆에는 다 식어버린 아메리카노가 놓여 있었다.',

		// CG 페이드 아웃 (2s) → 본격적인 이세라 등장
		async function () {
			await cgFadeOut ();
			return true;
		},

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
		// 1) 진입 직후: pending 씬 인트로(있다면) 자동 재생 → 세션 부트스트랩 (suggestions UI는 미노출)
		async function () {
			const playerName = (this.storage ('player') || {}).name || '플레이어';
			await bootstrapSessionOnce (playerName);
			await playSceneIntroIfPending (this);
			clearSuggestions ();
			return true;
		},

		// 2) 사용자 입력 (textarea 모달)
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

					// 입력 즉시 SSE 스트림 시작 (API_SPEC.md §3.2)
					pendingStreamResponse = fetch (`${API_BASE}/chat`, {
						method: 'POST',
						headers: {
							'Content-Type': 'application/json',
							'Accept': 'text/event-stream'
						},
						credentials: 'include',
						body: JSON.stringify ({ message: prompt })
					});

					// 입력창 사용 끝났으니 suggestions strip 정리, 곧바로 thinking 인디케이터 띄움
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

		// 3) 사용자 발화 에코
		'p {{llm.prompt}}',

		// 4) 이세라 응답 (SSE: meta → delta×N → state → [event_trigger] → [scene_transition] → end)
		async function () {
			const sayEl = document.querySelector ('[data-ui="say"]');
			const whoEl = document.querySelector ('[data-ui="who"]');
			if (whoEl) whoEl.textContent = '이세라';
			showThinkingDots ();

			let textBuffer = '';
			let streamComplete = false;
			let metaArrived = false;
			let nextSceneId = null;
			let triggeredEventId = null;
			let lastState = null;

			const handleSseEvent = (event, payload) => {
				switch (event) {
					case 'meta':
						if (payload?.emotion) updateSeraSprite (payload.emotion);
						metaArrived = true;
						hideThinkingDots ();
						break;
					case 'delta':
						if (typeof payload?.text === 'string') textBuffer += payload.text;
						break;
					case 'state':
						lastState = payload || {};
						if (lastState.emotion) updateSeraSprite (lastState.emotion);
						// 호감도 변동은 typewriter 진행 중에 즉시 시각화 → 답변 정서와 동기화
						flashAffinityVignette (typeof lastState.affinity_delta === 'number' ? lastState.affinity_delta : 0);
						break;
					case 'event_trigger':
						triggeredEventId = payload?.event_id || null;
						// 이벤트 도달은 즉시 토스트로 알림 (씬 전환과 무관하게 발동되므로)
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
				}
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
						let done = false;
						while (!done) {
							const { done: d, value } = await reader.read ();
							if (d) break;
							buf += decoder.decode (value, { stream: true });
							// SSE 이벤트 블록은 빈 줄(\n\n)로 구분
							const blocks = buf.split ('\n\n');
							buf = blocks.pop () || '';
							for (const block of blocks) {
								if (!block.trim ()) continue;
								let evt = 'message';
								let dataStr = '';
								for (const line of block.split ('\n')) {
									if (line.startsWith ('event:')) evt = line.slice (6).trim ();
									else if (line.startsWith ('data:')) dataStr += line.slice (5).trim ();
								}
								if (evt === 'end') { done = true; break; }
								if (!dataStr) continue;
								let payload;
								try { payload = JSON.parse (dataStr); }
								catch { continue; }
								handleSseEvent (evt, payload);
							}
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

			// thinking dots: meta 도착 또는 첫 delta가 올 때까지 표시
			while (!metaArrived && !streamComplete && textBuffer.length === 0) {
				await new Promise (r => setTimeout (r, 50));
			}
			hideThinkingDots ();
			sayEl.innerHTML = '';

			// [Consumer] 타이프라이터 (호흡 보정 + IME-safe 진행)
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

				// 호흡 보정: 마침표/물음표류 70ms, 말줄임 180ms, 쉼표 35ms
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

			// state는 SSE 도착 시점에 이미 vignette를 발사했으므로 여기서는 storage만 정리
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

		// 5) 종료 결정은 BE의 scene_transition이 한다 — shouldEnd 면 LLMEnd, 아니면 자유 채팅 루프
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
			// API_SPEC §5.1 — 엔딩 콘텐츠 페치 후 narrative + (가능하면) 엔딩 이미지 출력
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

// 전역 이벤트 리스너 추가: 엔터키 전송 (IME-safe)
document.addEventListener('keydown', function (e) {
	if (!e.target.matches?.('.llm-input textarea')) return;
	if (e.key !== 'Enter' || e.shiftKey) return;
	// 한글 등 IME 조합 중 Enter는 텍스트 확정용이므로 전송하지 않는다
	if (e.isComposing || e.keyCode === 229) return;
	e.preventDefault();
	const form = e.target.closest('text-input');
	if (form) {
		const btn = form.querySelector('button');
		if (btn) btn.click();
	}
});
